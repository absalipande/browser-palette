import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Palette } from "../ui/palette";
import type { RuntimeMessage, RuntimeResponse, VisitRecord } from "../types";
import { hostnameFromUrl, normalizeUrl, prettifyUrl } from "../url/normalize-url";
import paletteStyles from "../ui/palette.css?inline";

const CONTENT_SCRIPT_VERSION = "0.1.2";
let root: ReturnType<typeof createRoot> | null = null;
let host: HTMLDivElement | null = null;
let open = false;

ensurePalette();
recordCurrentVisit();
window.addEventListener("pageshow", recordCurrentVisit, { once: true });

chrome.runtime.onMessage.addListener((message: RuntimeMessage, _sender, sendResponse) => {
  if (message.type === "palette:status") {
    sendResponse({ ok: true, version: CONTENT_SCRIPT_VERSION });
    return;
  }

  if (message.type === "palette:toggle") {
    togglePalette();
  }
});

document.addEventListener(
  "keydown",
  (event) => {
    const key = event.key.toLowerCase();

    if (event.metaKey && event.shiftKey && key === "k") {
      event.preventDefault();
      event.stopPropagation();
      togglePalette();
    }
  },
  true
);

function ensurePalette() {
  if (root) {
    return;
  }

  const staleHost = document.getElementById("browser-palette-root");

  if (staleHost) {
    staleHost.remove();
  }

  host = document.createElement("div");
  host.id = "browser-palette-root";
  document.documentElement.appendChild(host);

  const shadowRoot = host.attachShadow({ mode: "open" });
  const style = document.createElement("style");
  const mount = document.createElement("div");

  style.textContent = paletteStyles;
  shadowRoot.append(style, mount);

  root = createRoot(mount);
  root.render(
    <StrictMode>
      <Palette
        onOpenChange={(nextOpen) => {
          open = nextOpen;
        }}
      />
    </StrictMode>
  );
}

function togglePalette() {
  open = !open;
  ensurePalette();

  window.dispatchEvent(
    new CustomEvent("browser-palette:open-change", {
      detail: { open }
    })
  );
}

function recordCurrentVisit() {
  const visit = buildVisitRecord();

  if (!visit) {
    return;
  }

  chrome.runtime
    .sendMessage<RuntimeMessage, RuntimeResponse>({
      type: "visit:record",
      visit
    })
    .catch(() => {});
}

function buildVisitRecord(): VisitRecord | null {
  const normalizedUrl = normalizeUrl(window.location.href);

  if (!normalizedUrl) {
    return null;
  }

  return {
    normalizedUrl,
    url: window.location.href,
    displayUrl: prettifyUrl(normalizedUrl),
    title: document.title,
    hostname: hostnameFromUrl(normalizedUrl),
    faviconUrl: getBestFavicon()
  };
}

function getBestFavicon() {
  const icon = document.querySelector<HTMLLinkElement>(
    'link[rel~="icon"], link[rel="shortcut icon"], link[rel="apple-touch-icon"]'
  );

  if (!icon?.href) {
    return "";
  }

  try {
    return new URL(icon.href, window.location.href).toString();
  } catch {
    return "";
  }
}
