# Reading Tool Backend

Turns a selected passage (1-3 paragraphs of dense academic text) into a structured
explanation object: concepts and people, typed relations between them, plain-language
glosses for jargon, and a one-sentence takeaway - every element anchored to a
character span in the original passage.

This backend does not draw anything. It produces the content a hand-designed
frontend renderer draws.

## Setup

```bash
python3.11 -m venv .venv
.venv/bin/pip install -r requirements.txt
cp .env.example .env
# edit .env and set GROQ_API_KEY (get one free at console.groq.com)
```

## Run

```bash
.venv/bin/uvicorn app.main:app --reload --port 8000
```

Open http://localhost:8000/ for the test page, http://localhost:8000/docs for an
interactive Swagger UI (try requests straight from the browser, no curl needed), or
http://localhost:8000/healthz to check status.

If `GROQ_API_KEY` is unset, or the Groq call fails twice, or it times out after 30s,
the backend serves a pre-baked fixture response instead (`meta.model = "fixture"`).
The test page and all three sample passages work fully with no network access.

## Testing the pipeline directly (fastest option)

No server, no browser — calls `run_explain_pipeline()` in-process, the exact same
code path `/v1/explain` uses (cache, extraction, repair, span verification, fixture
fallback):

```bash
.venv/bin/python scripts/try_explain.py --sample trust
.venv/bin/python scripts/try_explain.py --sample climate_feedback --mode explain_to_others
.venv/bin/python scripts/try_explain.py --file my_passage.txt
.venv/bin/python scripts/try_explain.py --text "any passage of 200-4000 characters..."
echo "..." | .venv/bin/python scripts/try_explain.py --stdin
.venv/bin/python scripts/try_explain.py --sample trust --json   # raw JSON instead of the formatted view
```

Prints a colorized breakdown: pattern/layout, takeaway, nodes grouped by emphasis
with their source spans, edges tagged `[stated]`/`[inferred]`, glossary, and the
`meta` block (model, cache hit, latency, span verification counts) — the fastest way
to sanity-check a prompt change or a new passage without touching a server or a UI.

## Tests

```bash
.venv/bin/pytest tests/ -v
```

Covers span verification (exact match, offset drift, missing/duplicate quote) and
schema validation (known-good and known-bad payloads).

## API

- `POST /v1/explain` - `{passage, context?, mode?}` -> `ExplainResponse`
- `GET /v1/explain/{id}` - fetch a previously computed explanation
- `POST /v1/explain/{id}/relayout` - `{layout_hint}` -> same object, new hint, no LLM call
- `GET /v1/samples` - 3 built-in sample passages
- `GET /healthz` - `{status, model, has_api_key, cache_entries}`

Passages must be 200-4000 characters; anything outside that range returns 422.

## Pipeline

1. **Cache lookup** - SQLite (`cache.db`), keyed by `sha256(passage + mode + schema_version + model)`.
2. **LLM extraction** - one Groq call (`moonshotai/kimi-k2-instruct` by default), JSON
   mode, temperature 0.2, one few-shot example.
3. **Repair loop** - on schema validation failure, one repair call with the raw
   output and the validation errors. A second failure falls back to a fixture, or
   502 with the validation errors if no fixture matches.
4. **Span verification** (`app/verify.py`, deterministic, no LLM) - every
   `source_span`/quote pair is checked against the exact passage string. An exact
   match is `verified`. A quote found exactly once elsewhere is `repaired` (offsets
   rewritten). Anything else is `dropped`: a node's span is nulled and its emphasis
   demoted to 3, an edge is marked `inferred` with its span nulled, a glossary term
   is removed entirely. Counts land in `meta`.

Every request is appended as one line to `logs/runs.jsonl` (timestamp, passage hash,
length, model, latency, cache hit, validation attempts, span verification counts).

## Example

Request:

```bash
curl -X POST http://localhost:8000/v1/explain \
  -H "Content-Type: application/json" \
  -d '{"passage": "Giddens and Luhmann both treat trust as central to modernity, but they define it in incompatible ways. For Giddens, trust is confidence in the reliability of a person or system, given a background of risk that could not otherwise be managed; trust is what allows an actor to act despite incomplete information about outcomes. Luhmann, by contrast, frames trust as a mechanism for reducing social complexity: because a fully rational calculation of every possible future is impossible, trust lets an actor bracket that complexity and proceed as if only a few outcomes were relevant. Where Giddens ties trust to the psychological experience of risk, Luhmann ties it to the systemic problem of complexity reduction. This difference matters because Giddens'\''s account implies trust is chosen under uncertainty, while Luhmann'\''s implies trust is a precondition that makes choice possible at all."}'
```

Response (truncated):

```json
{
  "id": "8f2b62d5-218a-4569-ad5e-4f81ff4946d7",
  "schema_version": "1.0",
  "passage_pattern": "definition_dispute",
  "layout_hint": "comparison_table",
  "takeaway": "Giddens ties trust to accepting risk, while Luhmann ties it to ignoring complexity.",
  "explain_script": "Giddens and Luhmann both write about trust but mean different things by it...",
  "nodes": [
    {
      "id": "giddens",
      "label": "Giddens",
      "plain_label": "Giddens",
      "kind": "theorist",
      "one_line": "Says trust is confidence in reliability despite risk.",
      "emphasis": 1,
      "source_span": [0, 7],
      "quote": "Giddens"
    }
  ],
  "edges": [
    {
      "id": "e1",
      "source": "giddens",
      "target": "luhmann",
      "relation": "contrasts_with",
      "label": "defines trust differently than",
      "evidentiality": "stated",
      "source_span": [92, 123],
      "quote": "define it in incompatible ways"
    }
  ],
  "glossary": [
    {
      "term": "modernity",
      "plain_definition": "The recent historical period shaped by industrial, rational society.",
      "in_this_passage": "The era where both theorists say trust becomes especially important.",
      "source_span": [45, 54]
    }
  ],
  "simplifications": [
    "Flattens a longer disagreement about modernity into a single contrast over trust."
  ],
  "meta": {
    "model": "moonshotai/kimi-k2-instruct",
    "latency_ms": 1834,
    "cached": false,
    "spans_verified": 10,
    "spans_repaired": 0,
    "spans_dropped": 0
  }
}
```

## Repo layout

```
app/__init__.py  main.py  schema.py  llm.py  prompts.py  verify.py  cache.py  samples.py  pipeline.py
app/static/index.html
fixtures/*.json
logs/.gitkeep
scripts/try_explain.py
tests/test_verify.py  tests/test_schema.py
.env.example  requirements.txt  README.md
```

## Non-goals

No PDF parsing, no auth, no real frontend or styling, no streaming, no whole-paper
analysis, no deployment, no other LLM providers, no pictures (SVG/Mermaid/HTML
diagrams) - all of that belongs to a separately designed frontend renderer.
