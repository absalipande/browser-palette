# Browser Palette Roadmap

This roadmap tracks the extension as a local personal tool and portfolio project.

## Implemented

### Browser Command Palette

- Keyboard-opened overlay via `Command+Shift+K`
- Open tab search and switching
- URL opening
- Google search fallback
- `Command+1` through `Command+9` quick activation
- Delete selected open tab/history result
- Light, dark, and system themes
- New-tab/current-tab open preference

### Local-First History

- IndexedDB-backed history database
- Page title, URL, normalized URL, hostname, first/last visited, visit count
- Favicon URL/data URL storage
- Favicon expiry after 7 days
- Daily garbage collection for low-value old entries
- URL cleanup for tracking/referral noise

### Ranking

- Open tabs first on empty state
- Best match on typed query
- History score based on recency, frequency, and text/domain match quality
- Local tab/history results outrank generic search fallbacks

### UI Hardening

- Shadow DOM isolation from host page CSS
- Zoom compensation for tabs using non-100% page zoom
- Scroll handling inside the palette
- Stable row layout and keyboard helper footer
- Extension options page
- Restricted-page fallback to settings

## Next

### Daily Use Hardening

- Use the extension for several normal browsing sessions
- Track rough edges in `Bugs.txt`
- Add regression cases from real URLs that behave strangely

### History Quality

- Better redirect/original typed-domain preservation
- More URL cleanup rules for noisy websites
- Import/export local history JSON
- Manual history viewer/management in settings

### Search Quality

- Smarter domain/TLD handling
- Better no-results state
- Optional search suggestions when no local result is strong enough

### Visual Polish

- Better icon set and portfolio screenshots
- Optional dominant favicon color indicators for open tabs
- Refined settings page
- Better small-screen behavior

### Safari

- Create Xcode Safari Web Extension wrapper
- Copy or sync `dist/` into the Safari wrapper
- Test local Safari installation
- Audit API differences between Chromium and Safari
- Document Safari local install steps

### Publishing Readiness

- Privacy policy
- Release builds
- Store screenshots
- Versioned changelog
- Browser compatibility notes
