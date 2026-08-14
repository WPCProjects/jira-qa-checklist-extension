// content.js
// Main logic: runs on JIRA ticket pages, checks status + required fields,
// and shows/hides a banner accordingly. Re-evaluates on DOM changes (SPA).

(function () {
  "use strict";

  const cfg = QA_ALERT_CONFIG;
  let extensionEnabled = true; // updated from chrome.storage.local
  let debounceTimer = null;

  function log(...args) {
    if (cfg.debug) console.log("[QA Alert]", ...args);
  }

  log("Content script loaded on", window.location.href);

  // ---------- Guard: only run on pages whose URL starts with the JIRA prefix ----------
  if (cfg.restrictToJiraHost && !window.location.href.startsWith(cfg.allowedUrlPrefix)) {
    log(`URL does not start with "${cfg.allowedUrlPrefix}", stopping.`, window.location.href);
    return;
  }
  if (!cfg.restrictToJiraHost) {
    log("TEST MODE: host restriction is OFF — running on", window.location.href);
  }

  // ---------- Storage helpers ----------
  function loadEnabledState(callback) {
    chrome.storage.local.get({ qaAlertEnabled: true }, (result) => {
      extensionEnabled = result.qaAlertEnabled;
      log("Extension enabled state loaded:", extensionEnabled);
      callback();
    });
  }

  // React live if the user toggles the extension from the popup
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "local" && Object.prototype.hasOwnProperty.call(changes, "qaAlertEnabled")) {
      extensionEnabled = changes.qaAlertEnabled.newValue;
      log("Extension toggled to:", extensionEnabled);
      if (!extensionEnabled) {
        removeBanner();
      } else {
        runCheck();
      }
    }
  });

  // ---------- Helper: query with primary + fallback selectors ----------
  function queryAllWithFallback(primarySelector, fallbackSelectors) {
    let els = document.querySelectorAll(primarySelector);
    if (els.length > 0) return els;
    for (const sel of fallbackSelectors || []) {
      els = document.querySelectorAll(sel);
      if (els.length > 0) {
        log(`Primary selector "${primarySelector}" found nothing, fallback "${sel}" matched ${els.length} element(s).`);
        return els;
      }
    }
    return els; // empty NodeList
  }

  // ---------- Status check ----------
  // Returns true if the ticket status text matches any of the required
  // statuses (e.g. "Production QA" or "Final QA"). Comparison is
  // case-insensitive and normalizes internal whitespace/line breaks,
  // since JIRA sometimes renders the status text with extra spacing.
  function normalizeText(str) {
    return (str || "").replace(/\s+/g, " ").trim().toLowerCase();
  }

  function isTicketInRequiredStatus() {
    const matched = getMatchedStatus();
    return !!matched;
  }

  // Returns the exact required status text that matched (e.g. "Final QA" or
  // "Production QA"), or null if none matched.
  function getMatchedStatus() {
    const statusEls = queryAllWithFallback(cfg.statusSelector, cfg.statusFallbackSelectors);
    log(`Status elements found: ${statusEls.length}`, Array.from(statusEls).map((el) => el.textContent.trim()));
    for (const el of statusEls) {
      const text = normalizeText(el.textContent);
      for (const required of cfg.requiredStatusTexts) {
        const normalizedRequired = normalizeText(required);
        if (text === normalizedRequired || text.includes(normalizedRequired)) {
          log("Matched required status:", required, "| raw text was:", el.textContent.trim());
          return required;
        }
      }
    }
    return null;
  }

  // ---------- Field 1: Production QA Checklist File ----------
  // Returns: true (submitted/OK), false (explicitly not submitted / unknown)
  function isChecklistFieldSubmitted() {
    const els = queryAllWithFallback(cfg.checklistFieldSelector, cfg.checklistFieldFallbackSelectors);
    log(`Checklist field elements found: ${els.length}`, Array.from(els).map((el) => el.textContent.trim()));

    if (els.length === 0) {
      // Field not found on page at all — don't false-alert, likely not loaded yet.
      log("Checklist field not found on page — skipping this check for now.");
      return true;
    }

    for (const el of els) {
      const text = (el.textContent || "").trim().toLowerCase();

      if (cfg.checklistOkValues.some((val) => text === val || text.includes(val))) {
        log("Checklist field value recognized as OK:", text);
        return true;
      }
      if (cfg.checklistNotOkValues.some((val) => text === val || text.includes(val))) {
        log("Checklist field value recognized as NOT submitted:", text);
        return false;
      }
    }

    // Found the field but the text didn't match any known value —
    // treat as not-submitted so it doesn't silently pass.
    log("Checklist field found but value did not match known OK/NOT-OK strings — treating as missing.");
    return false;
  }

  // ---------- Field 2: Athena Report URL ----------
  // Detection rule (per real JIRA behavior on this instance):
  //   <strong class="name"><label for="customfield_20200">Athena Report URL:</label></strong>
  // is present in the DOM only when the field has been filled with a link.
  // So: label found -> OK (filled). Label not found -> alert (missing).
  function findAthenaLabel() {
    let label = document.querySelector(cfg.athenaLabelSelector);
    if (label) return label;

    // Fallback: search by visible text among candidate labels
    const candidates = document.querySelectorAll(cfg.athenaLabelFallbackSelector);
    for (const el of candidates) {
      if (el.textContent && el.textContent.trim().startsWith(cfg.athenaLabelText)) {
        return el;
      }
    }
    return null;
  }

  function isAthenaUrlFilled() {
    const label = findAthenaLabel();
    const filled = !!label;
    log("Athena Report URL label found on page?", filled);
    return filled;
  }

  // ---------- Message builder ----------
  // Builds a single-line message like:
  //   "Missing information: Athena missing/Checklist missing"
  //   "Missing information: Checklist missing"
  //   "Missing information: Athena missing"
  function buildMissingMessage(athenaOk, checklistOk) {
    const parts = [];
    if (!athenaOk) parts.push("Athena missing");
    if (!checklistOk) parts.push("Checklist missing");
    if (parts.length === 0) return null;
    return `Missing information: ${parts.join("/")}`;
  }

  // ---------- Banner rendering (single line, top of page) ----------
  function showBanner(message) {
    let banner = document.getElementById(cfg.bannerId);
    if (!banner) {
      banner = document.createElement("div");
      banner.id = cfg.bannerId;
      document.body.appendChild(banner);
    }

    banner.innerHTML = `
      <div class="qa-alert-content">
        <span class="qa-alert-icon">⚠️</span>
        <span class="qa-alert-text">${message}</span>
        <button class="qa-alert-close" title="Dismiss">&times;</button>
      </div>
    `;

    banner.querySelector(".qa-alert-close").addEventListener("click", () => {
      banner.style.display = "none";
    });

    banner.style.display = "flex";
    log("Banner shown with:", message);
  }

  function removeBanner() {
    const banner = document.getElementById(cfg.bannerId);
    if (banner) {
      banner.remove();
      log("Banner removed.");
    }
  }

  // ---------- Modal rendering (centered box, only for Final QA) ----------
  function showModal(message) {
    let modal = document.getElementById(cfg.modalId);
    if (!modal) {
      modal = document.createElement("div");
      modal.id = cfg.modalId;
      document.body.appendChild(modal);
    }

    modal.innerHTML = `
      <div class="qa-alert-modal-box">
        <span class="qa-alert-modal-text">${message}</span>
        <button class="qa-alert-modal-close" title="Close">&times;</button>
      </div>
    `;

    modal.querySelector(".qa-alert-modal-close").addEventListener("click", () => {
      modal.style.display = "none";
    });

    modal.style.display = "flex";
    log("Modal shown with:", message);
  }

  function removeModal() {
    const modal = document.getElementById(cfg.modalId);
    if (modal) {
      modal.remove();
      log("Modal removed.");
    }
  }

  // ---------- Main check ----------
  function runCheck() {
    log("Running check...");

    if (!extensionEnabled) {
      log("Extension is disabled — skipping.");
      removeBanner();
      removeModal();
      return;
    }

    const matchedStatus = getMatchedStatus();
    log(
      "Matched required status:",
      matchedStatus,
      cfg.requireQAStatus ? "" : "(requirement is OFF - test mode)"
    );

    if (cfg.requireQAStatus && !matchedStatus) {
      removeBanner();
      removeModal();
      return;
    }

    const checklistOk = isChecklistFieldSubmitted();
    const athenaOk = isAthenaUrlFilled();
    const message = buildMissingMessage(athenaOk, checklistOk);

    log("checklistOk:", checklistOk, "| athenaOk:", athenaOk, "| message:", message);

    if (!message) {
      removeBanner();
      removeModal();
      return;
    }

    // Single-line banner at the top: shown for any required status
    // (Production QA or Final QA).
    showBanner(message);

    // Centered modal popup: only for Final QA specifically.
    if (matchedStatus === "Final QA") {
      showModal(message);
    } else {
      removeModal();
    }
  }

  function scheduleCheck() {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(runCheck, cfg.debounceMs);
  }

  // ---------- Observe SPA content changes ----------
  function startObserving() {
    const target = document.body;
    const observer = new MutationObserver(() => {
      scheduleCheck();
    });
    observer.observe(target, { childList: true, subtree: true, characterData: true });
    log("MutationObserver started.");
  }

  // ---------- Allow manual trigger from the popup for debugging ----------
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message && message.type === "QA_ALERT_RUN_CHECK_NOW") {
      log("Manual check triggered from popup.");
      runCheck();
      sendResponse({ ok: true });
    }
  });

  // ---------- Init ----------
  loadEnabledState(() => {
    runCheck();
    startObserving();
  });
})();
