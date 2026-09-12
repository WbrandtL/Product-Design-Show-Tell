# TimeAware

A personal, on-device time-awareness tool. It is **not** a productivity blocker — it only
observes: tracks how you spend time across apps, domains, and locations, shows trends
over 7/30 days, and lets you set goals against those trends. Everything stays on your
machine; there is no cloud, no backend, no account.

See [ARCHITECTURE.md](./ARCHITECTURE.md) for the stack choice, data-flow diagram, and
module boundaries.

## Project layout

```
desktop-app/        Electron + React/TS/Vite app: tracking daemon, SQLite, aggregation, UI
browser-extension/  Manifest V3 extension: reports active-tab domain time to desktop-app
```

## Setup — desktop app

```bash
cd desktop-app
npm install
npm run dev
```

This starts the app in dev mode: a window opens, a tray/menu-bar icon appears, and
tracking starts automatically (toggle it from the tray menu or the status bar in the
window's header). The SQLite database lives at your OS's app-data path for "TimeAware"
(e.g. `~/Library/Application Support/TimeAware/timeaware.sqlite3` on macOS,
`%APPDATA%\TimeAware\timeaware.sqlite3` on Windows).

**macOS permissions**: the first time it polls, macOS will prompt for **Accessibility**
access (needed to read the frontmost window's *title* — the app name itself doesn't need
it) and may prompt for **Location Services** access (needed for some macOS versions to
report a real Wi-Fi SSID). Both are optional in the sense that the app degrades
gracefully without them — you just get a generic window title / no location split.

To type-check and build a production bundle without running it:

```bash
npm run build
```

`npm run dist` (electron-builder) is wired up in `package.json` for a packaged
`.dmg`/NSIS installer, but packaging was not exercised in this build session — only
`npm run dev` was verified end-to-end.

## Setup — browser extension

```bash
cd browser-extension
npm install
npm run build
```

This produces `browser-extension/dist/`. To load it as an unpacked extension:

1. Open `chrome://extensions` (Chrome/Brave) or `edge://extensions` (Edge).
2. Enable **Developer mode** (top-right toggle).
3. Click **Load unpacked** and select `browser-extension/dist/`.
4. Click the TimeAware icon in the toolbar — the popup shows "Connected to TimeAware"
   once the desktop app is running (it polls `http://127.0.0.1:47850/health`).

The extension only works while the desktop app is running (it POSTs to a server the
desktop app hosts on `127.0.0.1:47850`). If the desktop app is closed, the extension logs
a console warning and drops the event — there's no retry queue in v1 (see "Future
extension points" below).

During development, `npm run watch` in `browser-extension/` rebuilds on file change; you
still need to click the refresh icon on `chrome://extensions` for the service worker to
pick up the new build.

## How tracking works, and what's stored where

- **Desktop app-level tracking** (`desktop-app/src/main/tracking/`): every ~7.5 seconds,
  the tracking daemon reads the frontmost app name + window title (AppleScript on macOS,
  a Win32-API PowerShell script on Windows), whether the system has been idle 60+ seconds
  (via Electron's built-in `powerMonitor`), and the current Wi-Fi SSID (`networksetup` +
  `ipconfig getsummary` on macOS, `netsh wlan show interfaces` on Windows). Every poll
  writes one row to the `raw_events` table with `source = 'desktop'`. Every command run is
  a plain OS CLI call logged to the console — nothing is captured beyond what's in that
  one row, and nothing is sent anywhere off your machine.

- **Browser extension tracking** (`browser-extension/src/background.ts`): while the
  browser window is focused, the active tab is a regular http/https page, and the user
  isn't idle, the extension times how long each domain stays focused and POSTs
  `{ timestamp, durationMs, domain, isIdle }` to the desktop app whenever that changes
  (tab switch, navigation, window blur, idle) or every 1 minute for a long-running tab.
  These land in the same `raw_events` table with `source = 'browser_extension'`.

- **Everything lives in one SQLite file** (`desktop-app/src/main/db/schema.ts`):
  - `raw_events` — append-only, one row per sample from either source. Never rewritten.
  - `category_rules` — app-name/domain → category mappings (seeded with defaults, user-editable).
  - `ssid_labels` — SSID → location label (e.g. "Home").
  - `goals` — append-only history: editing a goal closes the old row (`valid_to`) and
    inserts a new one, so trend charts can mark exactly when a goal changed.

- **The tracking daemon and the SQLite writes are the entire "background process."**
  There's no separate OS-level service, no telemetry, and no network calls other than the
  loopback HTTP server the extension talks to.

## How to add a new tracked data source

1. Pick a `source` value (e.g. `'mobile'`) and, if it needs a new capture path, write a
   small module that produces the same shape as `DesktopEventInput`/`BrowserEventInput`
   in `desktop-app/src/shared/types.ts`.
2. Add an `insertXEvent()` function in `desktop-app/src/main/db/rawEventsRepo.ts` (see
   `insertDesktopEvent`/`insertBrowserEvent` for the pattern) — it just inserts into
   `raw_events` with your new `source` value. You do **not** need a new table or a
   migration of existing data.
3. If the new source needs its own categorization dimension (like domains do), add a
   resolver function in `desktop-app/src/main/aggregation/categorize.ts` and fold it into
   `getCategoryTrend` in `trends.ts`, following how `getDomainMsByDate`/`getAppMsByDate`
   are combined there.
4. If it can double-count against an existing source (the way browser app-level and
   domain-level data can), add the same kind of `NOT EXISTS` minute-bucket exclusion used
   for browser apps in `getAppMsByDate` — see ARCHITECTURE.md "Double-counting avoidance."

## How to extend categorization rules

- **From the UI**: Settings → Categorization rules → pick "app name" or "domain", type the
  exact app name (as the OS reports it, e.g. "Figma") or domain (e.g. "notion.so"), type a
  category, and click Add Rule. Matching is an exact, case-insensitive string match — this
  is intentionally simple for v1 rather than glob/regex.
- **Programmatically / in bulk**: add entries to `DEFAULT_CATEGORY_RULES` in
  `desktop-app/src/main/db/schema.ts` — new entries are seeded (via `INSERT OR IGNORE`) on
  every app launch without touching rules a user has already customized.
- Rule changes only affect **future** aggregation queries (categorization happens at
  read-time from `raw_events`, not at write-time), so re-categorizing history is free —
  just change the rule and the trend chart reflects it on next refresh.

## Future extension points (explicitly out of scope for v1)

- **Cloud sync / multi-device** — everything is a single local SQLite file by design.
- **Mobile tracking** — no mobile app; see "How to add a new tracked data source" above
  for the shape a future one would need to fit.
- **Browsers beyond Manifest V3** (e.g. old Firefox WebExtensions quirks) — not targeted.
- **A persistent retry queue** for browser events sent while the desktop app is closed —
  today those events are silently dropped (logged to the service worker console).
- **A signed, packaged installer** — `electron-builder` config exists in
  `desktop-app/package.json`, but only `npm run dev` was verified in this session.
- **Glob/regex categorization rules** — today it's exact-match only.
