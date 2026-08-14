// popup.js

const toggle = document.getElementById("enableToggle");
const statusText = document.getElementById("statusText");

function renderState(enabled) {
  toggle.checked = enabled;
  statusText.textContent = enabled ? "Enabled" : "Disabled";
  statusText.className = "status-text " + (enabled ? "enabled" : "disabled");
}

// Load current state
chrome.storage.local.get({ qaAlertEnabled: true }, (result) => {
  renderState(result.qaAlertEnabled);
});

// Update state on toggle
toggle.addEventListener("change", () => {
  const enabled = toggle.checked;
  chrome.storage.local.set({ qaAlertEnabled: enabled }, () => {
    renderState(enabled);
  });
});
