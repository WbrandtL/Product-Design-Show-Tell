# Gist

A floating desktop icon, pinned to the right edge of the screen, on top of
every app. Select a passage anywhere on your Mac, click the icon (or press
`Cmd+Shift+G`), and it turns the selection into a verified reading diagram via
the local `gist-backend`. Results are stored in a small on-device library
you open from the icon.

This is a native macOS app (Electron), not a browser extension - that's the
point: it has to work over a PDF reader, Mail, Notes, a native app, anything,
not just browser tabs.

## Setup

The backend must already be set up (see `../gist-backend/README.md` - venv
created, deps installed, `.env` with a Groq key if you want live extraction).

```bash
cd gist
npm install
npm start        # dev mode, or: npm run dist for a real .app (see below)
```

### Run from source instead of the .dmg

The packaged `.app`/`.dmg` is unsigned (no Apple Developer identity on this
machine), and a `.dmg` downloaded through a browser gets macOS's quarantine
flag - Gatekeeper then reports it as "damaged" or "from an unidentified
developer" and can be flaky to get past even with right-click → Open. Running
from source never touches that flag at all, so it's the more reliable way to
hand this to someone else:

```bash
git clone <this-repo-url>
cd <repo>

cd gist-backend
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
cp .env.example .env   # add a Groq key for live extraction, optional

cd ../gist
npm install
npm start
```

Requires Node.js (and Python 3 for the backend) already installed on the
other machine. On first launch, grant **Accessibility** permission to
whatever process is running it - your terminal app in this dev-mode case,
since Electron runs as its child (see below).

On launch it looks for a gist-backend already running on port 8731 and, if
none is found, spawns `../gist-backend/.venv/bin/uvicorn` itself. It shuts
that subprocess down when you quit.

### macOS Accessibility permission (required)

Capturing "whatever is currently selected" system-wide works by simulating
Cmd+C on the frontmost app and reading the clipboard, the same technique most
menu-bar clipboard/lookup utilities use. That requires **Accessibility**
permission:

**System Settings → Privacy & Security → Accessibility** → enable it for
whichever process is actually running the app - in dev mode (`npm start`)
that's your terminal, since Electron runs as its child; for the packaged
`.app` (below), the permission is requested for Gist itself.

Until this is granted, clicking the icon or pressing the shortcut shows a
notification explaining exactly this, rather than failing silently.

## Building the real app

```bash
npm run dist
```

Produces `dist/mac-arm64/Gist.app` and a `.dmg` alongside it. It's
**unsigned** (no Apple Developer identity on this machine, so electron-builder
falls back to an ad-hoc build) - the first launch needs right-click → Open
instead of a plain double-click (Gatekeeper), after which it opens normally.
Move `Gist.app` to `/Applications` if you want it to stick around; it'll
still find `gist-backend` via the absolute fallback path in
`lib/backend.js` regardless of where the `.app` itself lives, as long as
`gist-backend` stays where it is on this machine - see the note in that
file about why this isn't a fully portable build.

## Using it

1. Select text in any app.
2. Click the floating icon, or press `Cmd+Shift+G`.
3. The icon pulses while it's working. A native notification tells you when
   it's done - click the notification, or the "open gist" button that
   appears under the icon once something's stored, to open the library.
4. In the library: step through captures with the prev/next arrows,
   **Re-generate** re-runs live extraction on the same passage, **Copy PNG**
   / **Download PNG** export the currently-visible card, **Delete** removes
   an entry.
5. Right-click the icon for a menu (Open Library, Capture Selection Now, Quit).

If a selection is too short or otherwise doesn't produce a diagram, it's
still stored - it just renders as a plain "this didn't turn into a diagram"
card with the reason, instead of vanishing.

## Visual design

Built against the `Gist.dc.html` mockup you provided (not the darker
`Highlight to Graphic.dc.html` prototype in the same zip, which is a
different, Gemini-based concept): warm paper (`#EBE5DD`/`#F4F0EA`/`#FBF9F5`),
ink `#1A1815`, Newsreader serif + IBM Plex Mono, the dial-style ring-and-dot
icon. The library card shows only the diagram itself - no headline, subhead
or glossary chrome - per an explicit "just the visual for now" direction.
One necessary departure from the mockup: captions/badges have their own
opaque background chip rather than transparent text, since this floats over
your actual desktop (any app, any wallpaper) rather than the mockup's own
page background.

"Regenerate" re-runs live extraction rather than reshuffling a visual theme -
there's no image generation in this pipeline, by design (see
`../gist-backend/README.md` for why).

## Real bugs found and fixed along the way

Worth knowing about if you're touching `lib/selection.js` or `main.js`:

- **`clipboard.readText()`/`writeText()` are asynchronous in this Electron
  version** (resolve to/return a Promise), not synchronous as in essentially
  every prior Electron release. An unawaited call silently produced a
  `Promise` object where a string was expected, so every clipboard read came
  back empty regardless of actual content - the original "stuck spinning"
  crash traced back to this too (an unresolved Promise passed to
  `writeText()` threw on a value it didn't expect). Every clipboard call is
  now awaited and type-checked.
- **Clicking the widget's own window disrupts keyboard-event routing** to
  the app you actually meant to copy from, even though "frontmost
  application" never visibly changes on either side of the click (confirmed
  empirically: triggering a capture via the native right-click menu instead
  - which never touches the window's content view - worked instantly, while
  a raw click on the window did not). Fixed by explicitly re-activating the
  target app, captured at click time, immediately before sending the Cmd+C.
- Two duplicate app instances running at once (from an incomplete restart
  during development) produced flaky, hard-to-diagnose behavior - duplicate
  global shortcuts, duplicate windows fighting over events. Not a code bug,
  but worth checking (`ps aux | grep Gist`) if things ever misbehave.

Multiple defense-in-depth layers now guard against a repeat of the "stuck
spinning" failure mode specifically: `captureSelection()` can never throw,
`runCapture()` wraps everything in try/catch, and a process-wide
`unhandledRejection` handler is the last line of defense.

## Known limitations, honestly

- **Copy/Download PNG captures only the currently visible scroll region**,
  not the whole card if it's taller than the window. Stitching a full-height
  capture is a reasonable follow-up if this matters to you.
- **No custom app icon** - uses Electron's default for now.
- Groq's free-tier rate limit (discovered while building the backend: ~8000
  tokens/minute on this account) means rapid back-to-back captures will hit
  a clean 429 rather than a diagram. Captures queue and retry after the
  server's `Retry-After` rather than firing concurrently, but the underlying
  rate limit is still a real constraint on how fast you can use this.
- **macOS only.** The core mechanic - a floating overlay that captures
  whatever's selected in *any* other app - is inherently OS-level: this
  build does it via a non-activating NSPanel plus an AppleScript-simulated
  Cmd+C, both macOS APIs. A Windows build is a real second implementation,
  not a recompile: it needs its own always-on-top/click-through window
  behavior and its own selection-capture mechanism (no AppleScript
  equivalent - likely a global hook plus a simulated Ctrl+C, verified
  separately against Windows' own focus/clipboard timing quirks). Given the
  time available, the honest call was to make the macOS version fully real
  - live extraction, hosted backend, no shortcuts - rather than split effort
  and risk a shaky port of both. Reach exceeded what landed here; this is
  the specific gap, not a vague caveat.

## Schema v2

The backend's extraction contract was replaced wholesale to match
`../gist-backend/PROMPT_SPEC.md` ("figure-selection") - see that file's
README section for what changed. `renderer/diagrams.js` and `renderer/
modal.js` were rewritten to match: forms are now SPECTRUM/QUADRANT/
COMPARISON/PROCESS/CONCEPT_MAP (uppercase), nodes carry `body`/
`attribution`/`hedge`/`off_axis`/`placement` instead of the old `plain`/
`icon`/`basis`, and a response can validly have zero figures (`NO_FIGURE`) -
rendered as an honest "this didn't need a diagram" card with the model's
stated reasons, not an error state.

Verified: all 6 mock fixtures (five forms plus a NO_FIGURE example) render
correctly with zero console errors, confirmed via an isolated browser
harness loading the actual `diagrams.js` + `modal.html` CSS against real
`/api/explain` responses. **Not re-verified end-to-end inside the packaged
Electron app after this rewrite** - the session's screen locked mid-test
right as an integration check was starting (a seeded library record was in
place and the app was running cleanly, but the click-through visual
confirmation didn't complete). Rebuild (`npm run dist`) and click through
the library once before trusting this fully; the individual pieces (backend
API, renderer in isolation) are confirmed working, but the last-mile glue
in `modal.js` reading a real library record through Electron's IPC wasn't
watched render with your own eyes.

Known cosmetic issue: SPECTRUM markers placed close together on the axis
can overlap their labels (a collision-avoidance pass was attempted, made
things render worse due to a layout interaction that wasn't worth chasing
down, and was reverted - see the comment in `renderSpectrum()`). QUADRANT,
CONCEPT_MAP and PROCESS all have working collision avoidance; SPECTRUM
doesn't yet.
