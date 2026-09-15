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

## API

- `POST /v1/explain` — `{passage, context?, mode?}` → `ExplainResponse`
- `GET /v1/explain/{id}` — fetch a previously computed explanation
- `POST /v1/explain/{id}/relayout` — same object, new layout hint, no LLM call
- `GET /v1/samples` — 3 built-in sample passages
- `GET /healthz` — `{status, model, has_api_key, cache_entries}`

Passages must be 200–4000 characters; anything outside that returns 422.

> **Known mismatch:** `gist-extension/src/background.ts` currently POSTs
> to `/api/explain`, but the backend only exposes `/v1/explain` (see above) —
> that path doesn't exist on this backend yet, on either `localhost:8000` or
> the deployed Render URL the extension now points to. Worth fixing before
> relying on the extension end-to-end.

## Non-goals

No PDF parsing, no auth, no streaming, no whole-paper analysis, no other LLM
providers, no image generation (SVG/Mermaid/HTML diagrams are drawn from the
schema by the frontend renderer, never by an image model) — see
ARCHITECTURE.md for why.
