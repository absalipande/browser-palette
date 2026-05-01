# Browser Palette

A local-first command palette for browsing, inspired by Arc, Zen, and Raycast.

Browser Palette is a personal browser extension that gives you one fast command
surface for open tabs, local browsing memory, direct URL opening, web search, and
small browser commands. It is designed for a macOS workflow where Chrome/Arc is
used for work and Safari support is planned for personal browsing.

The project is intentionally local-first: browsing memory is stored inside the
extension instead of relying on browser history APIs. That makes the behavior
portable to Safari later and gives the palette its own ranking, cleanup, and URL
normalization rules.

## Current Status

This is a working local v1 for Chromium-based browsers.

Implemented:

- Command palette overlay opened by `Command+Shift+K`
- Open tab search and switching
- Local IndexedDB history database
- History ranking based on recency, frequency, and text/domain match quality
- Smart URL fallback such as `youtube` -> `https://youtube.com`
- Google search fallback
- Delete selected tab/history result with delete/backspace behavior
- Light, dark, and system appearance modes
- New-tab/current-tab open behavior preference
- Simple extension options page
- Shadow DOM UI isolation so host page CSS does not affect the palette
- Page zoom compensation so the palette stays consistent across tabs using 80%, 100%, etc.
- URL cleanup for common tracking/referral noise
- Favicon fallback and small favicon data-URL caching with TTL
- Daily local history garbage collection

Not implemented yet:

- Safari Web Extension wrapper
- App Store packaging
- Dominant favicon color indicators
- Search suggestion provider beyond web search fallback
- Import/export of local history/settings
- Public-store privacy policy and release assets

## Why This Exists

Browser search bars are good at searching the web, but less good at understanding
personal browsing intent:

- "I want the YouTube tab that is already open."
- "I want the exact URL I keep visiting, not a search results page."
- "I want my frequently used personal history to outrank older one-off pages."
- "I want this to work in Safari eventually, where history access is limited."

Browser Palette solves that by building its own small local history database and
ranking layer.

## Core UX

Empty palette:

1. Shows open tabs first.
2. Shows local history next.
3. Keeps keyboard shortcuts visible for fast activation.

Typed query:

1. Shows a `BEST MATCH`.
2. Prioritizes open tabs and strong history matches.
3. Shows URL/open fallbacks only after local matches.
4. Always keeps web search available.

Keyboard behavior:

- `Command+Shift+K`: open palette
- `Enter`: activate selected result
- `Command+1` to `Command+9`: quick open visible results
- `Backspace` / `Delete`: delete selected tab/history result when not typing
- `Escape`: close palette

## Architecture

```txt
browser-palette/
  public/
    manifest.json       # MV3 extension manifest
    options.html        # static settings page
    options.css
    options.js
  src/
    background/
      index.ts          # extension service worker, tabs, ranking, commands
      history-db.ts     # IndexedDB history store and garbage collection
      ranking.ts        # history scoring
    content/
      index.tsx         # page injection, Shadow DOM mount, visit capture
    components/ui/
      command.tsx       # local shadcn/cmdk primitive
      dialog.tsx        # local Radix Dialog wrapper
      button.tsx
    ui/
      palette.tsx       # command palette UI
      palette.css       # isolated palette styling
    url/
      normalize-url.ts  # URL cleanup and display helpers
    types.ts            # runtime message/result contracts
```

### Content Script

The content script:

- mounts the React palette in a Shadow DOM
- injects palette CSS into that shadow root
- listens for `Command+Shift+K`
- captures page visits
- asks the background script for zoom compensation
- sends normalized page metadata to the background script

The Shadow DOM is important because pages like Facebook, YouTube, Reddit, and
Twitch all have aggressive CSS. Without isolation, fonts, resets, and layout
rules leak into the palette.

### Background Service Worker

The background worker:

- reads current-window tabs
- injects/upgrades stale content scripts
- switches to selected tabs
- opens URLs/search results
- closes selected tabs
- runs commands
- reads and ranks local history
- handles extension settings

Restricted pages such as `chrome://extensions` cannot receive content scripts,
so the extension opens the options page instead of failing silently.

### Local History Database

History is stored in IndexedDB under the extension origin.

Stored fields include:

- normalized URL
- original URL
- display URL
- hostname
- title
- first/last visited timestamps
- visit count
- favicon URL/data URL
- favicon expiry timestamp

Garbage collection runs at most once per day:

- entries older than 30 days with fewer than 2 visits are removed
- favicon data expires after 7 days

### Ranking

History ranking combines:

- exact hostname/query matches
- hostname starts-with matches
- title matches
- display URL matches
- visit frequency
- recency

Open tabs are ranked separately and generally win over history when query
quality is close.

## Privacy

Browser Palette does not send browsing data to a server.

Local data is stored in:

- Chrome extension storage for settings
- IndexedDB for local history

The extension requests tab, storage, scripting, and host permissions because it
needs to:

- inspect open tabs
- inject the palette UI into normal webpages
- store local history/settings
- collect page title, URL, and favicon for ranking

## Local Development

Install dependencies:

```bash
npm install
```

Build the extension:

```bash
npm run build
```

Load it locally:

1. Open `chrome://extensions`
2. Enable Developer Mode
3. Click `Load unpacked`
4. Select the `dist/` folder
5. Open a normal webpage
6. Press `Command+Shift+K`

For watch builds:

```bash
npm run dev
```

After changes, reload the extension in `chrome://extensions`.

## Notes On `Command+T`

The ideal shortcut is `Command+T`, because this palette is conceptually a
replacement for the browser's new-tab/search bar.

Most browsers reserve `Command+T` before extensions can intercept it, so the
current reliable shortcut is `Command+Shift+K`.

## Portfolio Notes

This project demonstrates:

- browser extension architecture with MV3
- content script and service worker communication
- React UI inside Shadow DOM
- keyboard-first command palette UX
- local-first data modeling with IndexedDB
- ranking heuristics using personal behavior
- URL normalization and cleanup
- extension settings/options design
- practical cross-site CSS and zoom isolation problems

## Roadmap

Near-term:

- Use the Chrome/Arc version in daily browsing and record friction
- Improve edge cases from real history examples
- Add import/export for local history and settings
- Add a more complete no-results/search suggestions experience
- Improve extension icon and portfolio screenshots

Safari milestone:

- Create an Xcode Safari Web Extension wrapper
- Copy/build the existing `dist/` extension into the Safari wrapper
- Test local installation in Safari
- Adjust APIs where Safari differs from Chromium

Longer-term:

- Dominant favicon color indicators for open tabs
- Better redirect/original typed-domain preservation
- Optional known-TLD domain matching
- Richer settings page
- Release packaging and privacy policy if published
