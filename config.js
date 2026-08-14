// config.js
// Centralized selectors and constants.
// If JIRA's HTML structure changes, update selectors here first.

const QA_ALERT_CONFIG = {
  // Set to true to print detailed logs in the browser console (prefixed
  // with "[QA Alert]"). Useful for diagnosing why a check did/didn't fire.
  // Turn off once everything is confirmed working.
  debug: true,

  // ============================================================
  // RULES (production mode)
  //   - restrictToJiraHost: only run on pages whose URL starts with
  //     allowedUrlPrefix (e.g. "https://jira...")
  //   - requireQAStatus: only alert when the ticket status is one of
  //     requiredStatusTexts (e.g. "Production QA" or "Final QA")
  // ============================================================
  restrictToJiraHost: true,
  requireQAStatus: true,

  // The page URL must START WITH this prefix. Covers any JIRA host
  // beginning with "jira" (e.g. https://jira.secext.samsung.net,
  // https://jira-na.secext.samsung.net, etc.)
  allowedUrlPrefix: "https://jira",

  // Ticket status labels that trigger validation. If the status text on
  // the page matches ANY of these, the checks below run.
  requiredStatusTexts: ["Production QA", "Final QA"],
  statusSelector: ".dropdown-text",

  // --- Field 1: Production QA Checklist File ---
  // Real HTML on the ticket:
  //   <div id="customfield_20000-val" class="value type-scripted-field" ...>
  //       Nonsubmission
  //   </div>
  // Known values:
  //   "Submitted"      -> checklist was attached (OK)
  //   "Nonsubmission"  -> checklist was NOT attached (must alert)
  checklistFieldSelector: "#customfield_20000-val.value.type-scripted-field",
  checklistOkValues: ["submitted"],
  checklistNotOkValues: ["nonsubmission", "non-submission", "not submitted"],

  // Extra fallback selectors, tried if the primary one above finds nothing.
  // Helps if the customfield id or exact classes differ.
  checklistFieldFallbackSelectors: [
    "[id$='-val'].value.type-scripted-field",
    ".value.type-scripted-field",
    "[class*='type-scripted-field']",
    "[id*='customfield'][class*='value']"
  ],

  // --- Field 2: Athena Report URL ---
  // On this JIRA instance, the field's label markup:
  //   <strong class="name"><label for="customfield_20200">Athena Report URL:</label></strong>
  // is only rendered on the page WHEN the field actually has a value/link
  // filled in. So the detection rule is simple:
  //   - label found on page  -> field is filled (OK)
  //   - label NOT found      -> field is empty, must alert
  athenaLabelSelector: 'strong.name > label[for="customfield_20200"]',
  athenaLabelText: "Athena Report URL",
  // Fallback: any label whose text starts with "Athena Report URL", in case
  // the customfield id changes on this instance.
  athenaLabelFallbackSelector: "strong.name label",

  statusFallbackSelectors: [
    "[class*='dropdown-text']",
    "[class*='status'] [class*='text']"
  ],

  // How long to wait after a DOM mutation before re-checking (ms)
  debounceMs: 400,

  // Banner element id (used to find/remove/update it)
  bannerId: "qa-checklist-alert-banner",

  // Centered modal element id (only shown when status is exactly "Final QA")
  modalId: "qa-checklist-alert-modal"
};
