# Gist

Select a passage of dense text on any page, and get back a verified reading
diagram — concepts, typed relations, plain-language glosses for jargon, and a
one-sentence takeaway — drawn from a structured object, never a generated
image. Every mark on the card is anchored to a character span in the original
passage; nothing is hand-waved by an LLM's drawing.

See [ARCHITECTURE.md](./ARCHITECTURE.md) for the pipeline, the schema, and
the reasoning behind the "no generated images" stance.

## Project layout

```
gist-backend/    FastAPI service: LLM extraction, span verification, cache, fixture fallback
gist-extension/  Manifest V3 browser extension: floating icon, on-device library, diagram renderer
gist/            Native macOS app (Electron): floating widget, works system-wide (not just in-browser)
```

## Setup — backend

```bash
cd gist-backend
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

## Setup — native macOS app

```bash
cd gist
npm install
npm start        # dev mode, or: npm run dist for a real .app
```

Select text in any app, then press **⌘⇧G** (or click the floating icon) to
capture it. See [gist/README.md](./gist/README.md) for Accessibility
permissions, building a real `.app`, and known limitations (macOS only).

## API

- `POST /v1/explain` — `{passage, context?, mode?}` → `ExplainResponse`
- `GET /v1/explain/{id}` — fetch a previously computed explanation
- `POST /v1/explain/{id}/relayout` — same object, new layout hint, no LLM call
- `GET /v1/samples` — 3 built-in sample passages
- `GET /healthz` — `{status, model, has_api_key, cache_entries}`

Passages must be 200–4000 characters; anything outside that returns 422.

> **Known mismatch:** both `gist-extension/src/background.ts` and
> `gist/lib/backend.js` + `gist/main.js` call `/api/health` and
> `/api/explain`, but the backend only exposes `/healthz` and `/v1/explain`
> (see above) — those paths don't exist on this backend, whether it's
> `localhost:8000` or the deployed Render URL. In the native app this also
> means `ensureBackend()`'s liveness check always reports the backend as
> down. Worth fixing before relying on either consumer end-to-end.

## Non-goals

No PDF parsing, no auth, no streaming, no whole-paper analysis, no other LLM
providers, no image generation (SVG/Mermaid/HTML diagrams are drawn from the
schema by the frontend renderer, never by an image model) — see
ARCHITECTURE.md for why.
