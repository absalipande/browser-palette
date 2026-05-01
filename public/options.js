const themeControls = document.getElementById("theme-controls");
const openControls = document.getElementById("open-controls");
const statusEl = document.getElementById("status");
const clearButton = document.getElementById("clear-history");

let currentTheme = "system";
let currentOpenBehavior = "new-tab";

init();

async function init() {
  const [themeResponse, openBehaviorResponse] = await Promise.all([
    chrome.runtime.sendMessage({ type: "theme:get" }),
    chrome.runtime.sendMessage({ type: "open-behavior:get" })
  ]);

  if (themeResponse.ok) currentTheme = themeResponse.theme;
  if (openBehaviorResponse.ok) currentOpenBehavior = openBehaviorResponse.behavior;

  renderControls();
}

function renderControls() {
  themeControls.replaceChildren(
    ...["system", "light", "dark"].map((theme) =>
      createButton(label(theme), currentTheme === theme, () => updateTheme(theme))
    )
  );

  openControls.replaceChildren(
    createButton("New tab", currentOpenBehavior === "new-tab", () => updateOpenBehavior("new-tab")),
    createButton("Current tab", currentOpenBehavior === "current-tab", () =>
      updateOpenBehavior("current-tab")
    )
  );
}

function createButton(text, active, onClick) {
  const button = document.createElement("button");
  button.className = "options-button";
  button.dataset.active = String(active);
  button.type = "button";
  button.textContent = text;
  button.addEventListener("click", onClick);
  return button;
}

async function updateTheme(theme) {
  const response = await chrome.runtime.sendMessage({ type: "theme:set", theme });

  if (response.ok) {
    currentTheme = theme;
    statusEl.textContent = "Theme updated.";
    renderControls();
  }
}

async function updateOpenBehavior(behavior) {
  const response = await chrome.runtime.sendMessage({ type: "open-behavior:set", behavior });

  if (response.ok) {
    currentOpenBehavior = behavior;
    statusEl.textContent = "Open behavior updated.";
    renderControls();
  }
}

clearButton.addEventListener("click", async () => {
  const response = await chrome.runtime.sendMessage({
    type: "palette:activate",
    result: {
      type: "command",
      id: "command:clear-history",
      title: "Clear local history",
      subtitle: "Remove stored Browser Palette history",
      command: "clear-history"
    }
  });

  statusEl.textContent = response.ok ? "Local history cleared." : response.error;
});

function label(value) {
  return value[0].toUpperCase() + value.slice(1);
}
