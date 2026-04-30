export type PaletteResult =
  | {
      type: "tab";
      id: string;
      tabId: number;
      windowId: number;
      title: string;
      subtitle: string;
      faviconUrl?: string;
    }
  | {
      type: "search";
      id: string;
      title: string;
      subtitle: string;
      query: string;
    }
  | {
      type: "url";
      id: string;
      title: string;
      subtitle: string;
      url: string;
      faviconUrl?: string;
    }
  | {
      type: "history";
      id: string;
      normalizedUrl: string;
      url: string;
      title: string;
      subtitle: string;
      faviconUrl?: string;
      visitCount: number;
      lastVisitedAt: number;
    }
  | {
      type: "command";
      id: string;
      title: string;
      subtitle: string;
      command: "clear-history" | "theme-system" | "theme-light" | "theme-dark" | "toggle-open-behavior";
    };

export type HistoryEntry = {
  normalizedUrl: string;
  url: string;
  displayUrl: string;
  title: string;
  hostname: string;
  firstVisitedAt: number;
  lastVisitedAt: number;
  visitCount: number;
  faviconUrl?: string;
  faviconExpiresAt?: number;
};

export type VisitRecord = Pick<
  HistoryEntry,
  "normalizedUrl" | "url" | "displayUrl" | "title" | "hostname" | "faviconUrl"
>;

export type ThemePreference = "system" | "light" | "dark";
export type OpenBehaviorPreference = "current-tab" | "new-tab";

export type RuntimeMessage =
  | { type: "palette:status" }
  | { type: "palette:toggle" }
  | { type: "palette:results"; query: string }
  | { type: "palette:activate"; result: PaletteResult }
  | { type: "palette:delete"; result: PaletteResult }
  | { type: "visit:record"; visit: VisitRecord }
  | { type: "theme:get" }
  | { type: "theme:set"; theme: ThemePreference }
  | { type: "open-behavior:get" }
  | { type: "open-behavior:set"; behavior: OpenBehaviorPreference };

export type RuntimeResponse<T = unknown> =
  | ({ ok: true } & T)
  | { ok: false; error: string };
