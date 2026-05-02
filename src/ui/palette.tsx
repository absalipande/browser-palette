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
  const [openBehavior, setOpenBehavior] = useState<OpenBehaviorPreference>("new-tab");
  const [selectedResultId, setSelectedResultId] = useState<string>("");
  const inputRef = useRef<HTMLInputElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);
  const requestIdRef = useRef(0);
  const deletingResultIdRef = useRef<string | null>(null);
  const selectTopOnNextResultsRef = useRef(false);

  const groupedResults = useMemo(() => groupResults(results, query), [results, query]);

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
      setSelectedResultId((currentId) => {
        if (selectTopOnNextResultsRef.current) {
          selectTopOnNextResultsRef.current = false;
          return response.results[0]?.id || "";
        }

        return response.results.some((result) => result.id === currentId)
          ? currentId
          : response.results[0]?.id || "";
      });

      listRef.current?.scrollTo({ top: 0 });
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
        selectTopOnNextResultsRef.current = true;
        setQuery("");
        setSelectedResultId("");
        refreshResults("");
        focusInput();
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
    if (deletingResultIdRef.current || (result.type !== "tab" && result.type !== "history")) {
      return;
    }

    deletingResultIdRef.current = result.id;
    try {
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
    } finally {
      deletingResultIdRef.current = null;
    }
  }

  function handleCommandKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    event.stopPropagation();
    event.nativeEvent.stopImmediatePropagation();

    if (event.repeat) {
      return;
    }

    if (
      (event.key === "Backspace" || event.key === "Delete") &&
      selectedResultId &&
      (!isInputFocused() || (event.key === "Delete" && query === ""))
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

  function handleDialogWheel(event: React.WheelEvent<HTMLDivElement>) {
    const list = listRef.current;

    if (!list || !open) {
      return;
    }

    const maxScrollTop = list.scrollHeight - list.clientHeight;

    if (maxScrollTop <= 0) {
      return;
    }

    const nextScrollTop = Math.max(0, Math.min(maxScrollTop, list.scrollTop + event.deltaY));

    if (nextScrollTop !== list.scrollTop) {
      list.scrollTop = nextScrollTop;
      event.preventDefault();
    }
  }

  function handleOpenAutoFocus(event: Event) {
    event.preventDefault();
    focusInput();
  }

  function focusInput() {
    requestAnimationFrame(() => {
      inputRef.current?.focus({ preventScroll: true });
      setTimeout(() => inputRef.current?.focus({ preventScroll: true }), 25);
    });
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
    return results.find((result) => result.id === selectedResultId);
  }

  function isInputFocused() {
    const input = inputRef.current;

    if (!input) {
      return false;
    }

    const root = input.getRootNode();
    return root instanceof ShadowRoot
      ? root.activeElement === input
      : document.activeElement === input;
  }

  return (
    <div className="bp-root" data-theme={theme}>
      <Dialog open={open} onOpenChange={(nextOpen) => (nextOpen ? setOpen(true) : close())}>
        <DialogContent
          aria-label="Browser Palette"
          onOpenAutoFocus={handleOpenAutoFocus}
          onWheelCapture={handleDialogWheel}
        >
          <DialogTitle className="bp-sr-only">Browser Palette</DialogTitle>
          <Command
            filter={() => 1}
            onKeyDown={handleCommandKeyDown}
            onValueChange={setSelectedResultId}
            shouldFilter={false}
            vimBindings={false}
            value={selectedResultId}
          >
            <div className="bp-command-topbar">
              <CommandInput
                autoFocus
                onValueChange={setQuery}
                placeholder="Search tabs, history, or the web"
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
            <CommandList ref={listRef}>
              <CommandEmpty>Start typing to search.</CommandEmpty>
              {groupedResults.length === 0 ? (
                <div className="bp-empty-state">
                  <span className="bp-empty-title">Nothing here yet</span>
                  <span className="bp-empty-copy">
                    Browse a few pages, then reopen the palette to see open tabs and local history.
                  </span>
                </div>
              ) : (
                groupedResults.map((group) => (
                  <CommandGroup heading={group.label} key={group.label || "action"}>
                    {group.results.map((result) => {
                      const resultIndex = results.findIndex((item) => item.id === result.id);
                      const shortcut =
                        resultIndex >= 0 && resultIndex < 9 ? `⌘${resultIndex + 1}` : result.meta || kindFor(result);

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
                ))
              )}
            </CommandList>
          </Command>
          <div className="bp-footer">
            <span>↵ Open</span>
            <span>⌘1-9 Quick open</span>
            <span>⌫ Delete selected</span>
            <span>{openBehavior === "current-tab" ? "Current tab mode" : "New tab mode"}</span>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function groupResults(results: PaletteResult[], query: string) {
  const groups: Array<{ label: string; results: PaletteResult[] }> = [];
  const trimmedQuery = query.trim();
  const groupedInput = trimmedQuery ? results.slice(1) : results;

  if (trimmedQuery && results[0]) {
    groups.push({ label: "BEST MATCH", results: [results[0]] });
  }

  for (const result of groupedInput) {
    const label = labelForResult(result);
    const existing = groups.find((group) => group.label === label);

    if (existing) {
      existing.results.push(result);
    } else {
      groups.push({ label, results: [result] });
    }
  }

  return groups;
}

function labelForResult(result: PaletteResult) {
  if (result.type === "tab") return "OPEN TABS";
  if (result.type === "history") return "HISTORY";
  if (result.type === "url") return "GO TO";
  if (result.type === "command") return "COMMANDS";
  return "SEARCH WEB";
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
  if (result.type === "tab") return "Open tab";
  if (result.type === "url") return "Open";
  if (result.type === "history") return "History";
  if (result.type === "command") return "Command";
  return "Google";
}

function themeIcon(theme: ThemePreference) {
  if (theme === "light") return <Sun size={16} />;
  if (theme === "dark") return <Moon size={16} />;
  return <Monitor size={16} />;
}
