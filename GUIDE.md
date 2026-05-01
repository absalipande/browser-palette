# Browser Palette Implementation Guide

This guide is the internal working reference for Browser Palette. For the public
project overview, see `README.md`. For planned work, see `ROADMAP.md`.

## Product Shape

Browser Palette is a local-first command palette for browser navigation.

Primary jobs:

- switch to an open tab
- reopen personally relevant history
- open a typed URL
- search the web
- run small browser-palette commands

The palette should feel closer to a browser command bar than a generic launcher:
Arc/Zen for the search surface, Raycast for keyboard clarity.

## Current Shortcut

- Current reliable shortcut: `Command+Shift+K`
- Product ideal: `Command+T`

Most browsers reserve `Command+T`, so `Command+Shift+K` is the practical local
development shortcut.

## Implemented Architecture

```txt
src/
  background/
    index.ts          # service worker: tabs, commands, settings, ranking
    history-db.ts     # IndexedDB history store
    ranking.ts        # history scoring
  content/
    index.tsx         # content script, Shadow DOM mount, visit capture
  components/ui/
    command.tsx       # local cmdk wrapper
    dialog.tsx        # local Radix Dialog wrapper
    button.tsx
  ui/
    palette.tsx       # palette UI
    palette.css       # isolated palette CSS
  url/
    normalize-url.ts  # cleanup/display helpers
  types.ts            # runtime message and result types

public/
  manifest.json
  options.html
  options.css
  options.js
```

## Content Script Responsibilities

- Mount the palette into a Shadow DOM host.
- Inject `palette.css` into that shadow root.
- Listen for `Command+Shift+K`.
- Send visits to the background worker.
- Ask the background worker for tab zoom and compensate for page zoom.
- Recreate the palette host when stale versions are detected.

Important: do not inject palette CSS globally into pages. That causes host page
CSS/reset/font differences to leak into the palette.

## Background Worker Responsibilities

- Toggle palette in the active tab.
- Inject current content script into stale normal webpages.
- Reject restricted pages and open settings instead.
- Query open tabs.
- Rank tab/history/url/search/command results.
- Activate selected results.
- Delete selected tab/history entries.
- Store settings in `chrome.storage.local`.
- Run daily history garbage collection.

## Runtime Messages

Defined in `src/types.ts`.

Current key message families:

- `palette:status`
- `palette:toggle`
- `tab:zoom`
- `palette:results`
- `palette:activate`
- `palette:delete`
- `visit:record`
- `theme:*`
- `open-behavior:*`

Keep message contracts typed. The background worker and content/UI code rely on
these as the extension boundary.

## Result Types

Current palette result kinds:

- `tab`
- `history`
- `url`
- `search`
- `command`

Rows may include optional `meta` for right-side display, such as:

- `Current tab`
- `4 visits • 2d ago`
- `Open`
- `Theme`
- `Open mode`

## Ranking Rules

Empty query:

- show up to 5 open tabs first
- show up to 5 history results next
- open tabs are ordered by active tab first, then tab index
- history is ordered by behavior score

Typed query:

- open tabs are scored by title, URL, hostname, and active-tab boost
- history is scored by text match + behavior score
- first row becomes `BEST MATCH`
- URL fallback appears only after local matches
- web search remains available

## History Storage

History uses IndexedDB under the extension origin.

Stored fields:

- `normalizedUrl`
- `url`
- `displayUrl`
- `hostname`
- `title`
- `firstVisitedAt`
- `lastVisitedAt`
- `visitCount`
- `faviconUrl`
- `faviconExpiresAt`

Daily garbage collection:

- delete entries older than 30 days with fewer than 2 visits
- clear expired favicons after 7 days

## URL Normalization

`src/url/normalize-url.ts` removes common tracking noise:

- `utm_*`
- `fbclid`
- `gclid`
- `igshid`
- `mibextid`
- `rdt`
- empty query params
- selected referral params

It also strips:

- hash fragments
- `www.`
- trailing slashes
- default index filenames like `index.html` and `index.php`

## UI Notes

The palette UI must remain:

- consistent across websites
- keyboard-first
- compact
- clear at different page zoom levels
- theme-aware

Important implementation details:

- Use Shadow DOM for isolation.
- Use explicit focus handling on dialog open.
- Use explicit wheel handling for scroll reliability.
- Use `chrome.tabs.getZoom` to compensate for per-tab page zoom.
- Keep row heights stable.
- Keep right-side shortcut/meta text bounded.

## Local Development

Install:

```bash
npm install
```

Build:

```bash
npm run build
```

Watch build:

```bash
npm run dev
```

Load locally:

1. Open `chrome://extensions`
2. Enable Developer Mode
3. Click `Load unpacked`
4. Select `dist/`
5. Reload extension after each build

## Safari Plan

Safari support should come after the Chromium local v1 feels stable.

Planned approach:

1. Keep the extension source WebExtension-compatible.
2. Build `dist/`.
3. Create a Safari Web Extension wrapper in Xcode.
4. Copy or sync `dist/` into the wrapper.
5. Test local installation in Safari.
6. Patch browser API differences only where necessary.

## Testing Checklist

Manual smoke tests:

- open palette on Facebook, YouTube, Reddit, Twitch
- test a tab at 80% zoom and another at 100% zoom
- type common domains like `you`, `face`, `red`
- activate tab, history, URL, search, and command results
- delete one tab result
- delete one history result
- open restricted page like `chrome://extensions`
- verify options page opens
- switch light/dark/system themes
- switch current/new-tab open mode
