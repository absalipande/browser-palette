import {
  CornerDownLeft,
  Eraser,
  Globe,
  Moon,
  Monitor,
  Settings2,
  Sun
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList
} from "../components/ui/command";
import { Dialog, DialogContent, DialogTitle } from "../components/ui/dialog";
import type {
  PaletteResult,
  OpenBehaviorPreference,
  RuntimeMessage,
  RuntimeResponse,
  ThemePreference
} from "../types";

type ResultsResponse = RuntimeResponse<{ results: PaletteResult[] }>;
type ThemeResponse = RuntimeResponse<{ theme: ThemePreference }>;
type OpenBehaviorResponse = RuntimeResponse<{ behavior: OpenBehaviorPreference }>;

export function Palette({ onOpenChange }: { onOpenChange: (open: boolean) => void }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PaletteResult[]>([]);
  const [theme, setTheme] = useState<ThemePreference>("system");
  const [openBehavior, setOpenBehavior] = useState<OpenBehaviorPreference>("current-tab");
  const [selectedResultId, setSelectedResultId] = useState<string>("");
  const inputRef = useRef<HTMLInputElement | null>(null);
  const requestIdRef = useRef(0);

  const groupedResults = useMemo(() => groupResults(results), [results]);

  const close = useCallback(() => {
    setOpen(false);
    onOpenChange(false);
  }, [onOpenChange]);

  const refreshResults = useCallback(async (nextQuery: string) => {
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;

    const response = await chrome.runtime.sendMessage<RuntimeMessage, ResultsResponse>({
      type: "palette:results",
      query: nextQuery
    });

    if (response.ok && requestId === requestIdRef.current) {
      setResults(response.results);
      setSelectedResultId((currentId) =>
        response.results.some((result) => result.id === currentId)
          ? currentId
          : response.results[0]?.id || ""
      );
    }
  }, []);

  useEffect(() => {
    chrome.runtime
      .sendMessage<RuntimeMessage, ThemeResponse>({ type: "theme:get" })
      .then((response) => {
        if (response.ok) {
          setTheme(response.theme);
        }
      })
      .catch(() => {});

    chrome.runtime
      .sendMessage<RuntimeMessage, OpenBehaviorResponse>({ type: "open-behavior:get" })
      .then((response) => {
        if (response.ok) {
          setOpenBehavior(response.behavior);
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const handleOpenChange = (event: Event) => {
      const nextOpen = Boolean((event as CustomEvent<{ open: boolean }>).detail.open);
      setOpen(nextOpen);
      onOpenChange(nextOpen);

      if (nextOpen) {
        setQuery("");
        refreshResults("");
        requestAnimationFrame(() => inputRef.current?.focus());
      }
    };

    window.addEventListener("browser-palette:open-change", handleOpenChange);
    return () => window.removeEventListener("browser-palette:open-change", handleOpenChange);
  }, [onOpenChange, refreshResults]);

  useEffect(() => {
    if (open) {
      refreshResults(query);
    }
  }, [open, query, refreshResults]);

  async function activateResult(result: PaletteResult) {
    await chrome.runtime.sendMessage<RuntimeMessage, RuntimeResponse>({
      type: "palette:activate",
      result
    });

    if (result.type === "command") {
      await syncPreferences();
    }

    close();
  }

  async function deleteResult(result: PaletteResult) {
    const deletedIndex = results.findIndex((item) => item.id === result.id);
    const response = await chrome.runtime.sendMessage<RuntimeMessage, RuntimeResponse>({
      type: "palette:delete",
      result
    });

    if (response.ok) {
      const nextResultsResponse = await chrome.runtime.sendMessage<RuntimeMessage, ResultsResponse>({
        type: "palette:results",
        query
      });

      if (nextResultsResponse.ok) {
        const nextResults = nextResultsResponse.results;
        const nextIndex = Math.min(Math.max(deletedIndex, 0), nextResults.length - 1);
        setResults(nextResults);
        setSelectedResultId(nextResults[nextIndex]?.id || "");
      }
    }
  }

  function handleCommandKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (
      (event.key === "Backspace" || event.key === "Delete") &&
      (document.activeElement !== inputRef.current || query === "")
    ) {
      const selected = getSelectedResult();

      if (selected && (selected.type === "tab" || selected.type === "history")) {
        event.preventDefault();
        event.stopPropagation();
        deleteResult(selected);
      }

      return;
    }

    if (!event.metaKey) {
      return;
    }

    const shortcutIndex = Number(event.key);

    if (!Number.isInteger(shortcutIndex) || shortcutIndex < 1 || shortcutIndex > 9) {
      return;
    }

    const result = results[shortcutIndex - 1];

    if (!result) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    activateResult(result);
  }

  async function cycleTheme() {
    const nextTheme = theme === "system" ? "light" : theme === "light" ? "dark" : "system";
    setTheme(nextTheme);
    await chrome.runtime.sendMessage<RuntimeMessage, ThemeResponse>({
      type: "theme:set",
      theme: nextTheme
    });
  }

  async function syncPreferences() {
    const [themeResponse, behaviorResponse] = await Promise.all([
      chrome.runtime.sendMessage<RuntimeMessage, ThemeResponse>({ type: "theme:get" }),
      chrome.runtime.sendMessage<RuntimeMessage, OpenBehaviorResponse>({
        type: "open-behavior:get"
      })
    ]);

    if (themeResponse.ok) setTheme(themeResponse.theme);
    if (behaviorResponse.ok) setOpenBehavior(behaviorResponse.behavior);
  }

  function getSelectedResult() {
    return results.find((result) => result.id === selectedResultId) || results[0];
  }

  return (
    <div className="bp-root" data-theme={theme}>
      <Dialog open={open} onOpenChange={(nextOpen) => (nextOpen ? setOpen(true) : close())}>
        <DialogContent aria-label="Browser Palette">
          <DialogTitle className="bp-sr-only">Browser Palette</DialogTitle>
          <Command
            filter={() => 1}
            onKeyDown={handleCommandKeyDown}
            onValueChange={setSelectedResultId}
            shouldFilter={false}
            value={selectedResultId}
          >
            <div className="bp-command-topbar">
              <CommandInput
                autoFocus
                onValueChange={setQuery}
                placeholder="Search tabs or the web"
                ref={inputRef}
                value={query}
              />
              <button
                aria-label={`Theme: ${theme}`}
                className="bp-theme-button"
                onClick={cycleTheme}
                title={`Theme: ${theme}`}
                type="button"
              >
                {themeIcon(theme)}
              </button>
            </div>
            <CommandList>
              <CommandEmpty>Start typing to search.</CommandEmpty>
              {groupedResults.map((group) => (
                <CommandGroup heading={group.label} key={group.label || "action"}>
                  {group.results.map((result) => {
                    const resultIndex = results.findIndex((item) => item.id === result.id);
                    const shortcut =
                      resultIndex >= 0 && resultIndex < 9 ? `⌘${resultIndex + 1}` : kindFor(result);

                    return (
                      <CommandItem
                        data-result-id={result.id}
                        data-manual-selected={result.id === selectedResultId}
                        data-type={result.type}
                        key={result.id}
                        onMouseEnter={() => setSelectedResultId(result.id)}
                        onSelect={() => activateResult(result)}
                        value={result.id}
                      >
                        <span className="bp-icon">
                          {"faviconUrl" in result && result.faviconUrl ? (
                            <img alt="" src={result.faviconUrl} />
                          ) : (
                            iconFor(result)
                          )}
                        </span>
                        <span className="bp-copy">
                          <span className="bp-title">{result.title}</span>
                          <span className="bp-subtitle">{result.subtitle}</span>
                        </span>
                        <span className="bp-kind">{shortcut}</span>
                      </CommandItem>
                    );
                  })}
                </CommandGroup>
              ))}
            </CommandList>
          </Command>
          <div className="bp-footer">
            <span>↵ Open</span>
            <span>⌘1-9 Quick open</span>
            <span>⌫ Delete tab/history</span>
            <span>{openBehavior === "current-tab" ? "Opens in current tab" : "Opens in new tab"}</span>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function groupResults(results: PaletteResult[]) {
  const groups: Array<{ label: string; results: PaletteResult[] }> = [];

  for (const result of results) {
    const label =
      result.type === "url"
        ? "GO TO"
        : result.type === "tab"
          ? "OPEN TABS"
          : result.type === "history"
            ? "HISTORY"
            : "SEARCH";
    const existing = groups.find((group) => group.label === label);

    if (existing) {
      existing.results.push(result);
    } else {
      groups.push({ label, results: [result] });
    }
  }

  return groups;
}

function iconFor(result: PaletteResult) {
  if (result.type === "url") {
    return <Globe size={16} />;
  }

  if (result.type === "search") {
    return <CornerDownLeft size={16} />;
  }

  if (result.type === "history") {
    return "H";
  }

  if (result.type === "command") {
    if (result.command === "clear-history") return <Eraser size={16} />;
    if (result.command === "toggle-open-behavior") return <Settings2 size={16} />;
    return <Sun size={16} />;
  }

  return "T";
}

function kindFor(result: PaletteResult) {
  if (result.type === "tab") return "Tab";
  if (result.type === "url") return "Open";
  if (result.type === "history") return "History";
  if (result.type === "command") return "Command";
  return "Search";
}

function themeIcon(theme: ThemePreference) {
  if (theme === "light") return <Sun size={16} />;
  if (theme === "dark") return <Moon size={16} />;
  return <Monitor size={16} />;
}
