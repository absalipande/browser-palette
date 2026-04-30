# Browser Palette Guide

## What We Are Building

Browser Palette is a local-first command palette for everyday browsing on macOS.
It is inspired by Arc and Zen style command bars, but it is built around personal
workflow rather than publishing to an extension store.

The first target is a Chromium-compatible WebExtension because it is easiest to
develop and load locally. Safari support can come later through Apple's Safari
Web Extension tooling.

## Product Goals

- Open quickly from a keyboard shortcut.
- Search open tabs, local history, and web search from one place.
- Keep a private local history database independent of browser history.
- Rank results by personal behavior: recent visits, repeated visits, and strong
  title/domain matches.
- Make tab switching and cleanup fast.
- Stay lightweight, calm, and useful.

## Product Contract

This project is a local-first browser command palette built around personal
browsing memory, not just a visual search box.

Core feature set:

- Maintain a built-in history database because Safari does not expose browser
  history in the way this project needs.
- Store useful page metadata:
  - page title
  - URL
  - normalized/display URL
  - last visited date
  - visit count
  - favicon data, eventually base64 with a 7 day TTL
- Prune low-value URL noise:
  - tracking parameters
  - referral parameters
  - pagination/noisy parameters where safe
  - trailing slashes
  - `index.html`, `index.php`, and similar default index files
- Preserve user intent where possible:
  - if the user types one domain and it redirects to another, keep the typed
    domain as a strong historical result while also recording the final URL.
- Rank history with personal behavior:
  - recent repeated visits should beat old high-count visits
  - title, hostname, and exact domain matches should get strong boosts
  - open tabs should generally beat history when match quality is close
- Support fast cleanup:
  - `Backspace` / `Delete` on an open tab result closes the tab
  - `Backspace` / `Delete` on a history result deletes that stored result
- Add polish where it improves recognition:
  - use favicons in results
  - eventually derive an open-tab color indicator from favicon dominant color
- Run automatic garbage collection:
  - daily cleanup
  - delete history entries older than 30 days with fewer than 2 visits
  - expire favicon data after 7 days
- Show search suggestions only when there are no strong local tab/history
  matches.
- Behave like a browser command bar:
  - selected tab result switches to that tab
  - selected history result opens in a new tab
  - selected URL result opens the URL
  - selected search result searches the web
  - smart domain matching turns `youtube` into `youtube.com`

## Keyboard Shortcut Goal

The ideal shortcut is `Command+T`, because the palette should feel like a
replacement for the browser's new-tab/search flow.

Important limitation: most browsers reserve `Command+T` before extensions or
content scripts can intercept it. During development, use a reliable extension
shortcut such as `Command+Shift+K`, then test whether the target browser allows
remapping or overriding `Command+T`.

## MVP Behavior

- `Command+T` is the preferred product shortcut when the browser allows it.
- `Command+Shift+K` is the reliable development fallback.
- `Escape` closes the palette.
- Typing filters available results.
- Results include:
  - open tab matches
  - local history matches
  - a web search fallback
- `Enter` activates the selected result.
- `Backspace` or `Delete` closes a selected open tab.
- `Backspace` or `Delete` removes a selected local history result.

## Architecture

```txt
browser-palette/
  package.json
  tsconfig.json
  vite.config.ts
  tailwind.config.ts
  public/
    manifest.json
  src/
    background/
      index.ts
    components/
      ui/
        button.tsx
        command.tsx
        dialog.tsx
    content/
      index.tsx
    lib/
      cn.ts
    types.ts
    ui/
      palette.tsx
      palette.css
```

## Stack Decision

Use TypeScript for the extension code. The browser APIs, message contracts,
command result types, and local history records benefit from explicit types.

Use React for the injected palette UI, Tailwind CSS for styling, and local
shadcn/ui components for a modern command surface. The current primitives are
owned in `src/components/ui` so they stay extension-safe:

- typed components
- Radix Dialog
- `cmdk` Command
- `cn(...)` class merging
- CSS variables for theme tokens
- restrained component classes
- system light/dark appearance via `prefers-color-scheme`

Recommended path:

1. Build with Vite + TypeScript.
2. Style with Tailwind CSS.
3. Keep shadcn-style components local and extension-safe.
4. Add Radix/shadcn pieces only when they solve a real interaction problem.

## Main Pieces

### Content Script

Responsible for:

- injecting the palette UI into pages
- listening for the keyboard shortcut
- capturing page title and URL
- sending visit information to the background script

### Background Script

Responsible for:

- reading open tabs
- switching tabs
- closing tabs
- opening search results
- opening web searches
- later: writing local visit records and running cleanup tasks

### Local History Database

Stored in IndexedDB.

Initial history record shape:

```ts
type HistoryEntry = {
  id: string;
  url: string;
  displayUrl: string;
  normalizedUrl: string;
  title: string;
  hostname: string;
  lastVisitedAt: number;
  visitCount: number;
  favicon?: string;
  faviconExpiresAt?: number;
};
```

### URL Normalization

Normalize stored URLs so the palette is cleaner than raw browser history.

Initial cleanup rules:

- remove common tracking params such as `utm_*`, `fbclid`, `gclid`
- strip trailing slashes
- strip `index.html`, `index.php`, and similar index filenames
- preserve a pretty display URL
- keep enough original URL information for useful matching

### Ranking

Result scoring should consider:

- exact query match
- title match
- hostname match
- URL match
- visit count
- last visited date
- whether the result is an open tab

Open tabs should generally beat history results when the match quality is close.

## Later Features

- favicon capture
- dominant favicon color for tab indicators
- smart domain matching with known TLDs
- search suggestions when there are no strong local matches
- daily garbage collection
- manual clear history command
- Safari conversion

## Garbage Collection Rules

Daily cleanup should:

- delete history entries older than 30 days with fewer than 2 visits
- expire favicon data after 7 days

## Local Development Plan

1. Scaffold the extension.
2. Load it unpacked in a Chromium browser.
3. Build the palette UI.
4. Add open tab search.
5. Add IndexedDB local history.
6. Add ranking and URL cleanup.
7. Polish keyboard actions.
8. Convert to Safari after the core experience feels right.

## Current Local Run Steps

The current version uses a Vite build step.

Install dependencies once:

```bash
npm install
```

Build the extension:

```bash
npm run build
```

In Chrome, Arc, Brave, or another Chromium browser:

1. Open `chrome://extensions`.
2. Enable developer mode.
3. Choose `Load unpacked`.
4. Select the `browser-palette/dist` folder.
5. Open any normal webpage.
6. Press `Command+Shift+K` to open the palette.

`Command+T` remains the product goal, but the current MVP uses
`Command+Shift+K` because browsers usually reserve `Command+T`.

For development, run:

```bash
npm run dev
```

This runs a watch build. When files change, return to `chrome://extensions` and
reload the extension.
