# Gist (browser extension)

A floating icon, present on every page, that turns a selected passage into a
verified reading diagram - the same `ExplainResponse` JSON the `gist-backend`
API returns, rendered in place. Nothing is ever sent to an image-generation
service: every mark on the card is drawn from the schema's own fields (a
node's `emphasis` sets its card weight, `basis` sets the stated/inferred ink
mark, `provenance` sets the plate badge), the same way the
[gist-backend test page](../gist-backend/static/index.html) does. The visual
language is near-black glass panels, one neon accent, and a circular badge
icon on the right edge.

## How it works

- **Floating icon** (`src/content.ts`), fixed on the right edge of every
  page. Click it to enter picking mode; drag-select a passage (200+
  characters - a short selection is automatically expanded to its containing
  paragraph). Release the mouse to send it off.
- **Background service worker** (`src/background.ts`) is the only piece that
  calls the backend - `POST http://localhost:8000/api/explain`. Content
  scripts run in the page's own origin and would be blocked by CORS calling
  localhost directly; the extension's `host_permissions` cover this instead,
  so the backend itself needed no changes.
- **On-device library**: every result is saved to `chrome.storage.local`
  (`src/storage.ts`) - up to 60 most recent - and shown as a badge count on
  the icon. Click the icon again (once you have graphics stored) to open the
  library instead of starting a new selection; use "+ New" inside the panel
  to start one from there.
- **Rendering** (`src/render.ts`) covers all five diagram forms (spectrum,
  comparison, concept map, process, axis), not just the two in the demo
  data - ported from the plain test page's generic renderers.

## Build and load it

```bash
cd gist-extension
npm install
npm run build
```

Then in Chrome: `chrome://extensions` → enable **Developer mode** (top
right) → **Load unpacked** → select the `gist-extension/dist` folder.
That last step needs a native file picker, which nothing can drive on your
behalf - it's the one part of this you have to do yourself.

Make sure `gist-backend` is running first
(`uvicorn app.main:app --reload`, from `gist-backend/`) - the extension
talks to it at `localhost:8000`. `LLM_PROVIDER=mock` in `.env` works fine for
trying the extension out with zero API calls; switch to `groq` for live
extraction once you're ready.

To iterate on the extension itself: `npm run watch` rebuilds on save, but
Chrome doesn't auto-reload an unpacked extension - click the refresh icon on
its card at `chrome://extensions` after a rebuild, and refresh any open page
tab to reinject the content script.

## What's not done yet

- No options page - the backend URL is hardcoded to `localhost:8000` in
  `src/background.ts`. Fine for local development; a real ship would need a
  settings UI (and a packaged, non-localhost backend to point at).
- No per-graphic delete confirmation, no "copy image" export - the schema
  stays live/structured rather than becoming a shareable flattened image,
  which is deliberate (see the root README's stance on image generation),
  but an "export as a rendered PNG of this exact HTML" affordance would be a
  reasonable, non-generative addition later.
- Selection-to-passage expansion is a simple containing-block heuristic; it
  won't always grab the "right" surrounding paragraph on unusual page
  layouts (e.g. text split across many small `<span>`s).
