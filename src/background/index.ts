import type {
  HistoryEntry,
  OpenBehaviorPreference,
  PaletteResult,
  RuntimeMessage
} from "../types";
import {
  clearHistoryEntries,
  deleteHistoryEntry,
  getHistoryEntries,
  recordVisit,
  runHistoryGarbageCollection
} from "./history-db";
import { scoreHistoryEntry } from "./ranking";

const SEARCH_URL = "https://www.google.com/search?q=";
const CONTENT_SCRIPT_VERSION = "0.1.11";
chrome.commands.onCommand.addListener(async (command) => {
  if (command !== "open-palette") {
    return;
  }

  await togglePaletteInActiveTab();
});

chrome.action.onClicked.addListener(async () => {
  await togglePaletteInActiveTab();
});

chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.set({
    lastGarbageCollectionAt: 0,
    openBehaviorPreference: "new-tab"
  });
});

chrome.runtime.onStartup.addListener(() => {
  maybeRunGarbageCollection();
});

async function togglePaletteInActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  if (!tab?.id) {
    return;
  }

  if (!isInjectableTab(tab)) {
    await chrome.runtime.openOptionsPage();
    return;
  }

  try {
    await ensureCurrentContentScript({ ...tab, id: tab.id });
    await chrome.tabs.sendMessage(tab.id, { type: "palette:toggle" });
  } catch {
    await injectPaletteIntoTab({ ...tab, id: tab.id });
    await chrome.tabs.sendMessage(tab.id, { type: "palette:toggle" }).catch(() => {});
  }
}

async function ensureCurrentContentScript(tab: chrome.tabs.Tab & { id: number }) {
  const response = await chrome.tabs.sendMessage(tab.id, { type: "palette:status" });

  if (response?.version !== CONTENT_SCRIPT_VERSION) {
    await injectPaletteIntoTab(tab);
  }
}

async function injectPaletteIntoTab(tab: chrome.tabs.Tab & { id: number }) {
  if (!isInjectableTab(tab)) {
    return;
  }

  await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    files: ["content.js"]
  });
}

function isInjectableTab(tab: chrome.tabs.Tab) {
  return Boolean(tab.url && /^https?:\/\//i.test(tab.url));
}

chrome.runtime.onMessage.addListener(
  (message: RuntimeMessage, sender, sendResponse) => {
    handleMessage(message, sender)
      .then(sendResponse)
      .catch((error: Error) => {
        console.error(error);
        sendResponse({ ok: false, error: error.message });
      });

    return true;
  }
);

async function handleMessage(message: RuntimeMessage, sender: chrome.runtime.MessageSender) {
  switch (message.type) {
    case "visit:record":
      await maybeRunGarbageCollection();
      return { ok: true, entry: await recordVisit(message.visit) };

    case "theme:get":
      return { ok: true, theme: await getThemePreference() };

    case "theme:set":
      await chrome.storage.local.set({ themePreference: message.theme });
      return { ok: true, theme: message.theme };

    case "open-behavior:get":
      return { ok: true, behavior: await getOpenBehaviorPreference() };

    case "open-behavior:set":
      await chrome.storage.local.set({ openBehaviorPreference: message.behavior });
      return { ok: true, behavior: message.behavior };

    case "tab:zoom":
      return { ok: true, zoom: await getSenderTabZoom(sender.tab) };

    case "palette:results":
      return { ok: true, results: await getPaletteResults(message.query) };

    case "palette:activate":
      return activateResult(message.result, sender.tab);

    case "palette:delete":
      return deleteResult(message.result);

    default:
      return { ok: false, error: "Unknown message type" };
  }
}

async function getSenderTabZoom(tab?: chrome.tabs.Tab) {
  if (!tab?.id) {
    return 1;
  }

  try {
    return await chrome.tabs.getZoom(tab.id);
  } catch {
    return 1;
  }
}

async function getPaletteResults(query: string): Promise<PaletteResult[]> {
  const normalizedQuery = query.trim().toLowerCase();
  const [tabs, historyEntries] = await Promise.all([
    chrome.tabs.query({ currentWindow: true }),
    getHistoryEntries()
  ]);

  const scoredTabResults = tabs
    .filter((tab): tab is chrome.tabs.Tab & { id: number; windowId: number } =>
      Boolean(tab.id && tab.windowId)
    )
    .map((tab) => ({
      type: "tab" as const,
      id: `tab:${tab.id}`,
      tabId: tab.id,
      windowId: tab.windowId,
      title: tab.title || tab.url || "Untitled tab",
      subtitle: tab.url || "",
      faviconUrl: tab.favIconUrl || "",
      meta: tab.active ? "Current tab" : undefined,
      active: Boolean(tab.active),
      index: tab.index ?? 0,
      score: scoreTabResult(tab, normalizedQuery)
    }))
    .filter((result) => {
      if (!normalizedQuery) {
        return true;
      }

      return `${result.title} ${result.subtitle}`.toLowerCase().includes(normalizedQuery);
    });

  const tabResults = (normalizedQuery
    ? scoredTabResults.sort((a, b) => b.score - a.score).slice(0, 5)
    : scoredTabResults.sort((a, b) => Number(b.active) - Number(a.active) || a.index - b.index).slice(0, 5)
  ).map(({ active: _active, index: _index, score: _score, ...result }) => result);

  const results: PaletteResult[] = [];

  results.push(...tabResults);

  const historyResults = historyEntries
    .map((entry) => ({
      type: "history" as const,
      id: `history:${entry.normalizedUrl}`,
      normalizedUrl: entry.normalizedUrl,
      url: entry.url,
      title: entry.title || entry.hostname || entry.url,
      subtitle: entry.displayUrl || entry.url,
      faviconUrl: entry.faviconUrl || "",
      visitCount: entry.visitCount,
      lastVisitedAt: entry.lastVisitedAt,
      meta: formatHistoryMeta(entry),
      score: scoreHistoryEntry(entry, normalizedQuery)
    }))
    .filter((result) => result.score > (normalizedQuery ? 12 : 0))
    .sort((a, b) => b.score - a.score)
    .slice(0, normalizedQuery ? 5 : 5)
    .map(({ score: _score, ...result }) => result);

  results.push(...historyResults);

  if (normalizedQuery) {
    const urlResult = getHistoryUrlResult(query.trim(), historyEntries) || getUrlResult(query.trim());

    if (urlResult && !results.some((result) => resultUrl(result) === urlResult.url)) {
      results.push(urlResult);
    }

    const commandResults = getCommandResults(normalizedQuery);

    if (commandResults.length > 0) {
      results.push(...commandResults);
    }

    results.push({
      type: "search",
      id: `search:${normalizedQuery}`,
      title: `Search for "${query.trim()}"`,
      subtitle: "Google Search",
      query: query.trim(),
      meta: "Search"
    });
  }

  return results;
}

function formatHistoryMeta(entry: HistoryEntry) {
  const visitLabel = entry.visitCount === 1 ? "1 visit" : `${entry.visitCount} visits`;
  const ageLabel = formatRelativeTime(entry.lastVisitedAt);
  return `${visitLabel} • ${ageLabel}`;
}

function formatRelativeTime(timestamp: number) {
  const ageMinutes = Math.max(0, Math.floor((Date.now() - timestamp) / 60000));

  if (ageMinutes < 1) return "just now";
  if (ageMinutes < 60) return `${ageMinutes}m ago`;

  const ageHours = Math.floor(ageMinutes / 60);
  if (ageHours < 24) return `${ageHours}h ago`;

  const ageDays = Math.floor(ageHours / 24);
  if (ageDays < 30) return `${ageDays}d ago`;

  const ageMonths = Math.floor(ageDays / 30);
  return `${ageMonths}mo ago`;
}

function resultUrl(result: PaletteResult) {
  if (result.type === "url" || result.type === "history") {
    return result.url;
  }

  if (result.type === "tab") {
    return result.subtitle;
  }

  return "";
}

async function activateResult(result: PaletteResult, currentTab?: chrome.tabs.Tab) {
  if (result.type === "tab") {
    await chrome.tabs.update(result.tabId, { active: true });
    await chrome.windows.update(result.windowId, { focused: true });
    return { ok: true };
  }

  if (result.type === "search") {
    const url = SEARCH_URL + encodeURIComponent(result.query);
    await openUrl(url, currentTab);
    return { ok: true };
  }

  if (result.type === "url") {
    await openUrl(result.url, currentTab);
    return { ok: true };
  }

  if (result.type === "history") {
    await chrome.tabs.create({ url: result.url });
    return { ok: true };
  }

  if (result.type === "command") {
    return runCommand(result.command);
  }

  return { ok: false, error: "Unsupported result type" };
}

async function deleteResult(result: PaletteResult) {
  if (result.type === "tab") {
    await chrome.tabs.remove(result.tabId);
    return { ok: true };
  }

  if (result.type === "history") {
    await deleteHistoryEntry(result.normalizedUrl);
    return { ok: true };
  }

  return { ok: false, error: "This result cannot be deleted" };
}

async function runCommand(command: Extract<PaletteResult, { type: "command" }>["command"]) {
  if (command === "clear-history") {
    await clearHistoryEntries();
    return { ok: true };
  }

  if (command === "theme-system" || command === "theme-light" || command === "theme-dark") {
    await chrome.storage.local.set({ themePreference: command.replace("theme-", "") });
    return { ok: true };
  }

  if (command === "open-current-tab" || command === "open-new-tab") {
    const openBehaviorPreference = command === "open-current-tab" ? "current-tab" : "new-tab";
    await chrome.storage.local.set({ openBehaviorPreference });
    return { ok: true, behavior: openBehaviorPreference };
  }

  if (command === "toggle-open-behavior") {
    const current = await getOpenBehaviorPreference();
    const next = current === "current-tab" ? "new-tab" : "current-tab";
    await chrome.storage.local.set({ openBehaviorPreference: next });
    return { ok: true, behavior: next };
  }

  if (command === "open-settings") {
    await chrome.runtime.openOptionsPage();
    return { ok: true };
  }

  return { ok: false, error: "Unknown command" };
}

function getUrlResult(query: string): Extract<PaletteResult, { type: "url" }> | null {
  const url = normalizeOpenUrl(query);

  if (!url) {
    return null;
  }

  return {
    type: "url",
    id: `url:${url}`,
    title: `Open ${formatUrlTitle(url)}`,
    subtitle: url,
    url,
    faviconUrl: faviconUrlForUrl(url),
    meta: "Open"
  };
}

function normalizeOpenUrl(query: string) {
  const trimmed = query.trim();

  if (!trimmed || /\s/.test(trimmed)) {
    return null;
  }

  if (/^https?:\/\//i.test(trimmed)) {
    try {
      return new URL(trimmed).toString();
    } catch {
      return null;
    }
  }

  if (trimmed.includes(".") && /^[a-z0-9.-]+\.[a-z]{2,}(\/.*)?$/i.test(trimmed)) {
    return `https://${trimmed}`;
  }

  if (/^[a-z0-9-]+$/i.test(trimmed)) {
    return `https://${trimmed}.com`;
  }

  return null;
}

function formatUrlTitle(url: string) {
  try {
    const parsed = new URL(url);
    return `${parsed.hostname.replace(/^www\./, "")}${parsed.pathname === "/" ? "" : parsed.pathname}`;
  } catch {
    return url;
  }
}

function getHistoryUrlResult(
  query: string,
  historyEntries: HistoryEntry[]
): Extract<PaletteResult, { type: "url" }> | null {
  const normalizedQuery = query.toLowerCase();
  const match = historyEntries
    .filter((entry) => {
      const hostname = entry.hostname.toLowerCase();
      const title = entry.title.toLowerCase();
      const displayUrl = entry.displayUrl.toLowerCase();
      return (
        hostname === normalizedQuery ||
        hostname.startsWith(normalizedQuery) ||
        title.startsWith(normalizedQuery) ||
        displayUrl.startsWith(normalizedQuery)
      );
    })
    .sort((a, b) => scoreHistoryEntry(b, normalizedQuery) - scoreHistoryEntry(a, normalizedQuery))[0];

  if (!match) {
    return null;
  }

  return {
    type: "url",
    id: `url:${match.url}`,
    title: `Open ${formatUrlTitle(match.url)}`,
    subtitle: match.displayUrl || match.url,
    url: match.url,
    faviconUrl: match.faviconUrl || faviconUrlForUrl(match.url),
    meta: "Open"
  };
}

function scoreTabResult(tab: chrome.tabs.Tab, query: string) {
  const title = (tab.title || "").toLowerCase();
  const url = (tab.url || "").toLowerCase();
  const hostname = hostnameFromRawUrl(tab.url || "");

  if (!query) {
    return 0;
  }

  let score = 0;

  if (hostname === query) score += 120;
  if (hostname.startsWith(query)) score += 90;
  if (title.startsWith(query)) score += 55;
  if (title.includes(query)) score += 35;
  if (url.includes(query)) score += 25;
  if (tab.active) score += 10;

  return score;
}

function getCommandResults(query: string): PaletteResult[] {
  const commands: Array<Extract<PaletteResult, { type: "command" }>> = [
    {
      type: "command",
      id: "command:clear-history",
      title: "Clear local history",
      subtitle: "Remove stored Browser Palette history",
      command: "clear-history",
      meta: "Reset"
    },
    {
      type: "command",
      id: "command:theme-system",
      title: "Theme: system",
      subtitle: "Follow macOS appearance",
      command: "theme-system",
      meta: "Theme"
    },
    {
      type: "command",
      id: "command:theme-light",
      title: "Theme: light",
      subtitle: "Use light palette appearance",
      command: "theme-light",
      meta: "Theme"
    },
    {
      type: "command",
      id: "command:theme-dark",
      title: "Theme: dark",
      subtitle: "Use dark palette appearance",
      command: "theme-dark",
      meta: "Theme"
    },
    {
      type: "command",
      id: "command:open-current-tab",
      title: "Open in current tab",
      subtitle: "Use the current tab for URL and search results",
      command: "open-current-tab",
      meta: "Open mode"
    },
    {
      type: "command",
      id: "command:open-new-tab",
      title: "Open in new tab",
      subtitle: "Create a new tab for URL and search results",
      command: "open-new-tab",
      meta: "Open mode"
    },
    {
      type: "command",
      id: "command:toggle-open-behavior",
      title: "Toggle open behavior",
      subtitle: "Switch URL/search between current tab and new tab",
      command: "toggle-open-behavior",
      meta: "Open mode"
    },
    {
      type: "command",
      id: "command:open-settings",
      title: "Open Browser Palette settings",
      subtitle: "Manage theme, open behavior, and local history",
      command: "open-settings",
      meta: "Settings"
    }
  ];

  if (
    !["clear", "theme", "dark", "light", "system", "open", "new", "tab", "current", "settings"].some((term) =>
      query.includes(term)
    )
  ) {
    return [];
  }

  return commands.filter((command) =>
    `${command.title} ${command.subtitle}`.toLowerCase().includes(query)
  );
}

function hostnameFromRawUrl(rawUrl: string) {
  try {
    return new URL(rawUrl).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return "";
  }
}

function faviconUrlForUrl(rawUrl: string) {
  try {
    const url = new URL(rawUrl);
    return `${url.origin}/favicon.ico`;
  } catch {
    return "";
  }
}

async function maybeRunGarbageCollection() {
  const stored = await chrome.storage.local.get(
    "lastGarbageCollectionAt"
  );
  const lastGarbageCollectionAt =
    typeof stored.lastGarbageCollectionAt === "number" ? stored.lastGarbageCollectionAt : 0;
  const now = Date.now();
  const oneDay = 24 * 60 * 60 * 1000;

  if (now - lastGarbageCollectionAt < oneDay) {
    return;
  }

  await runHistoryGarbageCollection();
  await chrome.storage.local.set({ lastGarbageCollectionAt: now });
}

async function getThemePreference() {
  const stored = await chrome.storage.local.get("themePreference");

  if (
    stored.themePreference === "light" ||
    stored.themePreference === "dark" ||
    stored.themePreference === "system"
  ) {
    return stored.themePreference;
  }

  return "system";
}

async function getOpenBehaviorPreference(): Promise<OpenBehaviorPreference> {
  const stored = await chrome.storage.local.get("openBehaviorPreference");

  if (stored.openBehaviorPreference === "current-tab") {
    return "current-tab";
  }

  return "new-tab";
}

async function openUrl(url: string, currentTab?: chrome.tabs.Tab) {
  const behavior = await getOpenBehaviorPreference();

  if (behavior === "current-tab" && currentTab?.id) {
    await chrome.tabs.update(currentTab.id, { url });
    return;
  }

  await chrome.tabs.create({ url });
}
