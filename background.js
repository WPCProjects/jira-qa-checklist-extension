// background.js - service worker
// Keeps the toolbar icon badge in sync with the enabled/disabled state.

function updateBadge(enabled) {
  chrome.action.setBadgeText({ text: enabled ? "ON" : "OFF" });
  chrome.action.setBadgeBackgroundColor({
    color: enabled ? "#36B37E" : "#8993A4"
  });
}

// Set initial state on install
chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.get({ qaAlertEnabled: true }, (result) => {
    updateBadge(result.qaAlertEnabled);
  });
});

// Keep badge in sync whenever the popup toggles the setting
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && Object.prototype.hasOwnProperty.call(changes, "qaAlertEnabled")) {
    updateBadge(changes.qaAlertEnabled.newValue);
  }
});

// Also set the badge correctly whenever the browser starts
chrome.runtime.onStartup.addListener(() => {
  chrome.storage.local.get({ qaAlertEnabled: true }, (result) => {
    updateBadge(result.qaAlertEnabled);
  });
});
