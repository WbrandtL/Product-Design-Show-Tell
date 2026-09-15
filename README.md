# Gist

Select a passage of dense text anywhere on your Mac, and get back a verified
reading diagram — concepts, typed relations, plain-language glosses for
jargon, and a one-sentence takeaway — drawn from a structured object, never a
generated image. Every mark on the card is anchored to a character span in
the original passage; nothing is hand-waved by an LLM's drawing.

See [ARCHITECTURE.md](./ARCHITECTURE.md) for the pipeline, the schema, and
the reasoning behind the "no generated images" stance.

## Project layout

```
gist-backend/    FastAPI service: LLM extraction, span verification, cache, fixture fallback
gist/            Native macOS app (Electron): floating icon, on-device library, diagram renderer
```

## Before you start

You need two things installed on your Mac first:

- **Python 3.11** — runs the backend. Check if you have it by running
  `python3.11 --version` in a terminal. If that fails, install it with
  [Homebrew](https://brew.sh): `brew install python@3.11`.
- **Node.js** (which includes `npm`) — runs the app. Check with `node -v`.
  If that fails, install it with: `brew install node`.

Don't have Homebrew? Install it first from [brew.sh](https://brew.sh), then
run the two `brew install` commands above.

## Setup — backend

This installs the backend's own Python packages into a private folder
(a "virtual environment") so they don't clash with anything else on your
Mac, then starts the backend server.

```bash
cd gist-backend                          # go into the backend folder
python3.11 -m venv .venv                 # create the private folder for its packages
.venv/bin/pip install -r requirements.txt # install the packages it needs
cp .env.example .env                     # copy the example settings file
# edit .env: set GROQ_API_KEY (free at console.groq.com), or leave it blank for fixture mode
.venv/bin/uvicorn app.main:app --reload --port 8000  # start the backend
```

Open http://localhost:8000/ for a plain test page, http://localhost:8000/docs
for interactive Swagger, or http://localhost:8000/healthz to check status. With
no API key (or on a Groq failure/timeout), it serves a pre-baked fixture
response instead — the test page and the app both work fully offline.

## Setup — app

This installs the app's own packages (including Electron, the framework it's
built with) into a `node_modules` folder, then opens the app.

```bash
cd gist        # go into the app folder
npm install    # download and install the packages the app needs
npm start      # open the app
```

The first `npm start` also downloads the Electron program itself, so it can
take a minute or two and may look stuck — that's normal, just let it finish.

On first launch, grant **Accessibility** permission to whatever process is
running it — your terminal, since Electron runs as its child in dev mode —
in **System Settings → Privacy & Security → Accessibility**. See
[gist/README.md](./gist/README.md) for why this is required and how the
packaged `.app` build differs. In dev mode the app spawns/reuses a local
`gist-backend` on port 8731 automatically.

## API

- `POST /v1/explain` — `{passage, context?, mode?}` → `ExplainResponse`
- `GET /v1/explain/{id}` — fetch a previously computed explanation
- `POST /v1/explain/{id}/relayout` — same object, new layout hint, no LLM call
- `GET /v1/samples` — 3 built-in sample passages
- `GET /healthz` — `{status, model, has_api_key, cache_entries}`

Passages must be 200–4000 characters; anything outside that returns 422.

## Non-goals

No PDF parsing, no auth, no streaming, no whole-paper analysis, no other LLM
providers, no browser extension, no image generation (SVG diagrams are drawn
from the schema by the app's renderer, never by an image model) — see
ARCHITECTURE.md for why.
