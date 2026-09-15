# Reading Graphic

Select a passage of dense text on any page, and get back a verified reading
diagram — concepts, typed relations, plain-language glosses for jargon, and a
one-sentence takeaway — drawn from a structured object, never a generated
image. Every mark on the card is anchored to a character span in the original
passage; nothing is hand-waved by an LLM's drawing.

See [ARCHITECTURE.md](./ARCHITECTURE.md) for the pipeline, the schema, and
the reasoning behind the "no generated images" stance.

## Project layout

```
reading-backend/    FastAPI service: LLM extraction, span verification, cache, fixture fallback
reading-extension/  Manifest V3 browser extension: floating icon, on-device library, diagram renderer
```

There's also a native macOS app (`gist`, an Electron floating widget that
does the same thing system-wide instead of just in the browser) on the
`backup/gist-v2-2026-09-15` branch — it isn't on `main` yet.

## Setup — backend

```bash
cd reading-backend
python3.11 -m venv .venv
.venv/bin/pip install -r requirements.txt
cp .env.example .env
# edit .env: set GROQ_API_KEY (free at console.groq.com), or leave LLM_PROVIDER=mock
.venv/bin/uvicorn app.main:app --reload --port 8000
```

Open http://localhost:8000/ for a plain test page, http://localhost:8000/docs
for interactive Swagger, or http://localhost:8000/healthz to check status. With
no API key (or on a Groq failure/timeout), it serves a pre-baked fixture
response instead — the test page and extension both work fully offline.

## Setup — browser extension

```bash
cd reading-extension
npm install
npm run build
```

Then in Chrome: `chrome://extensions` → enable **Developer mode** → **Load
unpacked** → select `reading-extension/dist/`.

Click the floating icon on any page to enter picking mode, drag-select a
passage (200+ characters), and release to send it off. Results are saved to
an on-device library (`chrome.storage.local`, up to 60 most recent) — click
the icon again once something's stored to open it instead of starting a new
selection.

`npm run watch` rebuilds the extension on save; Chrome still needs a manual
refresh (the icon on the extension's card at `chrome://extensions`) plus a
page reload to pick up a new build.

## API

- `POST /v1/explain` — `{passage, context?, mode?}` → `ExplainResponse`
- `GET /v1/explain/{id}` — fetch a previously computed explanation
- `POST /v1/explain/{id}/relayout` — same object, new layout hint, no LLM call
- `GET /v1/samples` — 3 built-in sample passages
- `GET /healthz` — `{status, model, has_api_key, cache_entries}`

Passages must be 200–4000 characters; anything outside that returns 422.

> **Known mismatch:** `reading-extension/src/background.ts` currently POSTs
> to `/api/explain`, but the backend only exposes `/v1/explain` (see above) —
> that path doesn't exist on this backend yet, on either `localhost:8000` or
> the deployed Render URL the extension now points to. Worth fixing before
> relying on the extension end-to-end.

## Non-goals

No PDF parsing, no auth, no streaming, no whole-paper analysis, no other LLM
providers, no image generation (SVG/Mermaid/HTML diagrams are drawn from the
schema by the frontend renderer, never by an image model) — see
ARCHITECTURE.md for why.
