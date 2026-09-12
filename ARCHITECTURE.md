# Architecture

## Stack choice

**Electron + React + TypeScript + Vite (via `electron-vite`), with `better-sqlite3` for storage.**

One-line reason: Electron has the most mature, best-documented path to the three things
this app actually needs — a tray/menu-bar app, a synchronous local SQLite connection in
a long-lived Node process, and a local HTTP server for the browser extension — with the
lowest integration risk to get all of it working reliably in a single session. Tauri
would mean writing the tracking daemon and SQLite layer in Rust, which is more work for
no functional benefit here.

## Extension-communication choice

**A local-only HTTP server (`127.0.0.1:47850`) run by the desktop app's main process, that
the browser extension's service worker POSTs to.**

One-line reason: it's transport-agnostic (works identically across Chrome/Edge/Brave with
zero per-browser setup), requires no native-messaging host manifest to install per OS, and
is trivial to inspect (`curl http://127.0.0.1:47850/health`). Native messaging was the
alternative; it needs a registry entry (Windows) or a manifest file in a browser-specific
directory (macOS/Linux) per browser, which is more moving parts for no real benefit in a
single-user, single-machine tool.

## Data flow

```
                         ┌─────────────────────────┐
                         │   OS (macOS / Windows)   │
                         │  active window, idle,    │
                         │  Wi-Fi SSID              │
                         └────────────┬─────────────┘
                                      │ polled every ~7.5s
                                      │ (AppleScript / PowerShell,
                                      │  Electron powerMonitor,
                                      │  networksetup / netsh)
                                      ▼
                         ┌─────────────────────────┐        ┌──────────────────────────┐
                         │   TrackingDaemon         │        │  Browser (Chrome/Edge/    │
                         │   (main/tracking/)       │        │  Brave) + TimeAware       │
                         └────────────┬─────────────┘        │  Companion extension      │
                                      │                       │  (browser-extension/)     │
                                      │ insertDesktopEvent()   │  tracks focused-tab       │
                                      │                       │  domain + duration        │
                                      │                       └────────────┬─────────────┘
                                      │                                    │ POST JSON
                                      │                                    │ http://127.0.0.1:47850
                                      │                                    │ /events/browser
                                      │                       ┌────────────▼─────────────┐
                                      │                       │   ingestServer.ts         │
                                      │                       │   (loopback-only HTTP)    │
                                      │                       └────────────┬─────────────┘
                                      │                                    │ insertBrowserEvent()
                                      ▼                                    ▼
                         ┌─────────────────────────────────────────────────────────┐
                         │                  raw_events (SQLite)                     │
                         │   append-only: source, timestamp, duration_ms, app_name, │
                         │   window_title, domain, is_idle, ssid                    │
                         └───────────────────────────┬─────────────────────────────┘
                                                       │ read-only SQL queries
                                                       │ (main/aggregation/)
                                                       ▼
                         ┌─────────────────────────────────────────────────────────┐
                         │  categorize.ts + trends.ts                               │
                         │  - resolves app/domain -> category (category_rules)      │
                         │  - resolves ssid -> location label (ssid_labels)         │
                         │  - avoids double-counting desktop-vs-extension overlap   │
                         │  - compares against goals (goals, append-only history)   │
                         └───────────────────────────┬─────────────────────────────┘
                                                       │ ipcMain.handle(...)
                                                       │ (main/ipcHandlers.ts)
                                                       ▼
                         ┌─────────────────────────────────────────────────────────┐
                         │  preload/index.ts  ->  window.timeaware.*                │
                         │  (contextBridge, narrow typed surface, no logic)         │
                         └───────────────────────────┬─────────────────────────────┘
                                                       ▼
                         ┌─────────────────────────────────────────────────────────┐
                         │  React dashboard (renderer/)                             │
                         │  trend charts, goal-vs-actual, location split,           │
                         │  category rules + SSID labeling settings                 │
                         └─────────────────────────────────────────────────────────┘
```

## Module boundaries

| Module | Path | Responsibility | Depends on |
|---|---|---|---|
| Tracking daemon | `desktop-app/src/main/tracking/` | Polls OS for active window/idle/SSID, writes raw events | `db/rawEventsRepo` |
| Local ingest server | `desktop-app/src/main/server/` | Accepts browser-extension POSTs, validates, writes raw events | `db/rawEventsRepo` |
| Data layer | `desktop-app/src/main/db/` | Schema, migrations-on-boot, typed repos (raw events, category rules, SSID labels, goals) | `better-sqlite3` only |
| Aggregation logic | `desktop-app/src/main/aggregation/` | Turns raw events into category/location trends, week-over-week deltas, goal progress | `db/*Repo` (read-only) |
| IPC layer | `desktop-app/src/main/ipcHandlers.ts`, `preload/` | The only bridge between main-process data/logic and the renderer | `aggregation/`, `db/` |
| UI | `desktop-app/src/renderer/` | Dashboard + settings screens, chart rendering | `window.timeaware.*` only, via `hooks.ts` |
| Browser extension | `browser-extension/` | Tracks focused-tab domain time, POSTs to the local ingest server | Nothing in `desktop-app/` — communicates only over HTTP |

Each module only talks to the next one through the interfaces above — the tracking daemon
and ingest server never know about categorization or goals; the aggregation layer never
knows how an event was captured; the renderer never touches SQLite or the filesystem
directly, only `window.timeaware.*`.

## Why raw events and aggregation are kept separate

`raw_events` is append-only and never rewritten. All trend/goal/category math in
`aggregation/trends.ts` is plain SQL run against that table (or small config tables like
`category_rules`), not a materialized rollup. That means adding a new data source (e.g. a
mobile app, a second browser's extension) or a new metric only requires a new query or a
new `source` value — never a migration of historical data, and never a change to how
existing data was already summarized.

## Double-counting avoidance (desktop app-level vs. extension domain-level)

When a recognized browser (Chrome/Edge/Brave/Safari/Firefox/Arc) is the focused app, the
desktop daemon still records it as e.g. `app_name = "Google Chrome"`. If the browser
extension is installed and also reported a domain for that same one-minute window, the
aggregation layer (`getAppMsByDate` in `trends.ts`) excludes that desktop-level row from
category totals — the more specific domain-level row (with its own category, e.g.
`github.com` → "Deep Work") is used instead. If the extension isn't installed, or the tab
was idle, the generic app-level "Chrome" time is used, uncategorized by default. This is
why the extension is optional: the app degrades gracefully to app-level-only tracking
without it.

## Future extension points

These were explicitly scoped out of v1 (see README "Future extension points" for the
full, user-facing list): cloud sync/multi-device, mobile tracking, browsers without a
Chromium-based Manifest V3 engine (e.g. legacy Firefox WebExtensions differences), a
persistent retry queue for extension events sent while the desktop app is closed, and a
packaged/signed installer (the `build` config in `desktop-app/package.json` is present
but only the `npm run dev` path was exercised in this session).
