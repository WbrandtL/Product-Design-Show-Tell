# Architecture

## Stack choice

**FastAPI + Pydantic backend, native macOS app (Electron) for the frontend.**

The backend's only job is producing a validated, schema-shaped explanation of
a passage — no rendering, no styling, no images. The app's only job is
capturing a selection (system-wide, over any other app) and drawing the
diagram from that schema. Keeping them as separate processes (HTTP between
them, not a shared runtime) means the rendering logic could be swapped for a
different capture surface entirely without touching the backend at all.

## Why no image generation

Every mark on a card is drawn from a structured field in `ExplainResponse`
(a node's `emphasis` sets its weight, whether it still carries a `quote`
after span verification sets the verified-vs-unattributed ink mark), never
from an image model asked to "draw a diagram." This is a deliberate,
load-bearing choice: an image model has no way to guarantee a claim it draws
is actually in the source passage, while every node/edge/glossary term here
carries a `source_span` that's checked against the literal passage text (see
"Span verification" below). Fidelity to the source is the entire value
proposition; a generated image would trade that for a nicer-looking result
that might be wrong.

## Pipeline (`gist-backend`)

```
┌──────────────────┐
│  Passage (200–    │
│  4000 chars)      │
└─────────┬─────────┘
          │
          ▼
┌──────────────────────────┐   hit    ┌─────────────────────────┐
│  Cache lookup (SQLite)    ├─────────▶│  Return cached response  │
│  sha256(passage+mode+     │          └─────────────────────────┘
│  schema_version+model)    │
└─────────┬─────────────────┘
          │ miss
          ▼
┌──────────────────────────┐
│  LLM extraction           │  one Groq call, JSON mode,
│  (app/llm.py)              │  temperature 0.2, one few-shot example
└─────────┬─────────────────┘
          │ schema validation fails
          ▼
┌──────────────────────────┐   fails again   ┌────────────────────────┐
│  Repair call               ├────────────────▶│  Fixture response, or   │
│  (raw output + errors)     │                 │  502 with the errors    │
└─────────┬───────────────── ┘                 └────────────────────────┘
          │ passes
          ▼
┌──────────────────────────────────────────────────────────┐
│  Span verification (app/verify.py, deterministic, no LLM) │
│  - exact match in passage           -> verified            │
│  - quote found exactly once else    -> repaired (offsets   │
│                                         rewritten)          │
│  - anything else                    -> dropped (span       │
│      nulled, node emphasis demoted, edge marked inferred,  │
│      glossary term removed)                                │
└─────────┬──────────────────────────────────────────────────┘
          ▼
┌──────────────────────────┐
│  ExplainResponse           │  cached, logged to logs/runs.jsonl
└──────────────────────────┘
```

If `GROQ_API_KEY` is unset, the Groq call fails twice, or it times out after
30s, the backend serves a pre-baked fixture instead (`meta.model =
"fixture"`) rather than erroring — the test page and all sample passages work
with zero network access.

## Module boundaries

| Module | Path | Responsibility |
|---|---|---|
| API | `gist-backend/app/main.py` | Routes: `/v1/explain`, `/v1/explain/{id}`, `/v1/explain/{id}/relayout`, `/v1/samples`, `/healthz` |
| Pipeline | `gist-backend/app/pipeline.py` | Orchestrates cache → LLM → repair → verify |
| LLM client | `gist-backend/app/llm.py`, `prompts.py` | Groq call, few-shot prompt, JSON-mode parsing |
| Span verification | `gist-backend/app/verify.py` | Deterministic exact/repaired/dropped classification against the literal passage |
| Cache | `gist-backend/app/cache.py` | SQLite (`cache.db`), keyed by passage+mode+schema+model hash |
| Schema | `gist-backend/app/schema.py` | Pydantic models for `ExplainRequest`/`ExplainResponse` |
| Selection capture | `gist/lib/selection.js` | System-wide "grab whatever's selected" via a simulated Cmd+C plus clipboard read, over any app |
| Backend client | `gist/lib/backend.js` | Spawns/reuses a local `gist-backend`, or talks to a hosted one; the only piece that calls the backend |
| On-device library | `gist/lib/library.js` | Per-capture JSON files under Electron's userData dir |
| Diagram renderer | `gist/renderer/diagrams.js` | Draws all five `layout_hint` values (comparison_table, flow, timeline, hierarchy, quadrant) from `ExplainResponse` fields only |

Each module only talks to the next one through the interfaces above — the
app never touches the LLM or the cache directly, only `POST /v1/explain`;
the pipeline never knows whether the caller is the app, the test page, or
`scripts/try_explain.py`.

## Non-goals

No PDF parsing, no auth, no real frontend styling beyond the app's own CSS,
no streaming, no whole-paper analysis, no other LLM providers, no browser
extension, no deployment tooling beyond what's needed to point the app at a
hosted backend URL. All scoped out deliberately, not by oversight.
