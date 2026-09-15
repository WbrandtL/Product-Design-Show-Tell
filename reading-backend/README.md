# Reading Tool Backend

Turns a passage of any text into structured figure data - zero, one, or several
figures, each in a form the backend chooses (SPECTRUM, QUADRANT, COMPARISON,
PROCESS, CONCEPT_MAP), or none at all when a figure would assert more structure
than the text has. The LLM never draws anything - it emits strict JSON matching
`app/schema.py`; a separate renderer (the Gist app, `../gist/`) turns that JSON
into a picture. That separation is the central architectural decision in this
codebase: the visual language can be redesigned at any point without touching
the model layer, because nothing about rendering lives in the prompt, the
schema, or the route.

## Schema v2 (PROMPT_SPEC.md)

The extraction contract was replaced wholesale to match **`PROMPT_SPEC.md`**
("figure-selection") - a substantially more rigorous spec than the original
brief's schema: it adds a two-score gate (`fit`/`need`) that has to clear
before a figure is emitted at all, an explicit `NO_FIGURE` outcome (empty
`figures[]`) as a valid, honest success rather than an error, per-node
`attribution`/`hedge`/`off_axis` modality, a mechanically-enforced "hub test"
for CONCEPT_MAP, and a `left_in_text[]` residue trail explaining every span
the model chose not to draw and why. Read `PROMPT_SPEC.md` for the full spec,
including its worked examples - it's also the literal system prompt body (see
`app/prompt.py`).

`app/static/index.html`, the original plain test page, is **stale** - it was
written against the v1 schema (headline/plain/icon/basis/at_a_glance) and was
not updated for this rewrite, given where the effort went instead (the Gist
app's renderer, which *is* current). Use `../gist/` to actually exercise this
end-to-end, or `curl`/the fixtures directly.

## Run it (three commands)

```bash
python3.11 -m venv .venv && .venv/bin/pip install -r requirements.txt
cp .env.example .env   # defaults to LLM_PROVIDER=mock - no key needed to try it
.venv/bin/uvicorn app.main:app --reload
```

Open http://localhost:8000/ for the test page, or http://localhost:8000/api/health
to check status. To use live Groq extraction instead of the mock fixtures, set
`GROQ_API_KEY` and `GROQ_MODEL` in `.env` (get a free key at console.groq.com) and
either set `LLM_PROVIDER=groq` or just leave it unset - the app defaults to `groq`
whenever `GROQ_API_KEY` is present and to `mock` otherwise.

## API

| Method | Path | Body | Returns |
|---|---|---|---|
| GET | `/api/health` | - | `{status, provider, model, cache_entries}` |
| POST | `/api/explain` | `{passage, context?, force?, provider?}` | `ExplainResponse` |
| GET | `/api/samples` | - | 3 built-in sample passages, Appendix A first |
| GET | `/` | - | the test page |

`passage` must be 200-8000 characters; shorter is rejected with a 422, longer is
truncated with a warning. `provider` is an optional per-request override
(`"mock"` or `"groq"`) on top of the server's default - it's what lets the test
page's provider toggle work without an env var round-trip, and is additive to the
documented body shape. `force: true` bypasses the cache.

Errors: `422` invalid model output (validation errors included), `429` provider
rate limit (with `Retry-After` passed through), `502` provider unreachable or
misconfigured (e.g. a retired `GROQ_MODEL`, which fails with a message naming
that env var). The route never returns `200` with a broken diagram.

## Pipeline

1. **Cache lookup** - one JSON file per `sha256(passage + context + provider:model)`
   under `cache/`. A hit returns in milliseconds with `meta.cached: true`.
2. **Extraction** (`app/llm.py`) - `mock` returns a hand-written fixture from
   `app/fixtures.py`, chosen by a keyword heuristic (or an explicit
   `context: "fixture:<form>"` hint, which is how the test page's fixture
   buttons force a specific form). `groq` calls Groq's OpenAI-compatible chat
   completions endpoint in JSON mode. Either way `extract()` returns the same
   shape: a payload dict with no `id`/`meta`, plus a meta dict.
3. **Repair loop** - if the payload fails schema validation, one follow-up
   message is sent with the raw output and the validation errors, asking for
   corrected JSON only. A second failure returns a clean `422`.
4. **Assembly + validation** - the route adds `id` and `meta`, then validates
   the whole thing against `ExplainResponse`, which enforces every
   cross-reference rule in the brief (edge/figure node references resolve,
   node counts per figure and overall, layout type matches form, spectrum
   group coverage, comparison cell completeness, process/axis node coverage,
   grouped-figure `group_id` validity) in one `model_validator`.
5. **Span verification** (`app/verify.py`, deterministic, no LLM) - every
   `Span` and `Node.quote` is searched for in the actual passage (exact, then
   whitespace-normalised). A hit rewrites the offsets from scratch; a miss
   nulls the quote/span, flips `basis` to `"inferred"`, and appends a warning.
   A figure marked `provenance: "stated"` with more than a third of its nodes
   inferred after verification is downgraded to `"arranged"`, with a warning -
   the tool should never claim the source text drew a diagram it arranged itself.
6. **Run logging** - every call, live or mock, is written to
   `runs/<timestamp>-<hash>.json`: passage, prompt, raw response, parsed
   result, warnings, latency.

## Repo layout

```
app/schema.py    Pydantic v2 contract - the source of truth every other file follows
app/prompt.py    system prompt + JSON-schema injection (generated from schema.py)
app/llm.py       mock | groq provider, repair loop, run logging
app/verify.py    span verification and provenance downgrade
app/cache.py     disk cache
app/fixtures.py  one hand-written payload per form, plus the two-figure Appendix A fixture
app/main.py      FastAPI app, routes, static mount
static/index.html   unstyled test page: textarea + sample/fixture buttons, rendered
                     figures, raw JSON, warnings box
samples/agency.txt              Appendix A (verbatim) - the benchmark passage
samples/permafrost_feedback.txt  a causal/mechanism passage -> process form
samples/trust_definitions.txt    a definitional-dispute passage -> comparison form
runs/   cache/   gitignored
```

## Acceptance check results

1. **Mock provider, all forms** - `LLM_PROVIDER=mock`; the test page's five
   fixture buttons plus the "agency (2 figures)" button each force a distinct
   `context: "fixture:<form>"` hint, so all five forms and the two-figure
   Appendix A response render with zero reload errors and zero network calls.
   Verified via `curl` against every fixture - each validates and renders.
2. **Live provider on Appendix A** - **run against `openai/gpt-oss-120b`,
   confirmed**: returned a `spectrum` figure with `axis_label_low/high` =
   "Structure dominates" / "Agency dominates" and three groups. Marx sits in
   the structure-dominant group; Giddens, Bhaskar and Layder all sit in the
   dialectical/mutual group - all four are placed defensibly against the
   passage. It also correctly caught a live hallucination: a glossary item's
   source quote didn't match the passage verbatim and `verify.py` dropped it
   with a warning, exactly as designed - this was the anti-hallucination path
   firing for real, not a synthetic test.
   Two real bugs surfaced and were fixed in the process (see below): the
   embedded JSON schema was large enough to blow this account's 8000
   tokens/minute cap on its own, and Groq's "ran out of completion tokens
   before finishing valid JSON" failure wasn't routed through the repair loop
   and crashed as a raw 500 instead of a clean error.
3. **Second figure relevance on Appendix A (live)** - the live run above
   produced only the spectrum figure, not the axis figure the brief's target
   describes. That's a legitimate outcome under the "default to one figure"
   rule, not a bug, but it means the prompt isn't yet reliably surfacing the
   second question ("what counts as an act of agency?") the way the
   hand-written fixture does. Next step: tighten Step 1 with a more concrete
   trigger, or re-run at a lower temperature / with an explicit nudge.
4. **Live provider on the causal sample -> `process`** - **confirmed**: the
   permafrost passage produced `form: "process"` with a complete 5-step order.
   It also surfaced a second real finding: several node/edge quotes failed
   verification purely because the model wrote a non-breaking hyphen
   (`‑`, e.g. "by‑products") where the passage has a plain ASCII
   `-`. That's a typographic substitution, not a fabrication, so `verify.py`
   was too strict - `find_span` now tolerates hyphen and smart-quote
   variants (see `_flexible_pattern` in `app/verify.py`) while still
   requiring everything else, including capitalization, to match exactly.
   Replaying the same live response through the fixed matcher dropped the
   warning count from 6 to 2; the 2 remaining are a genuine quoting error
   (the model lowercased a sentence-initial "Where" when lifting a
   mid-sentence quote) and are correctly still caught.
5. **Fabricated-quote case** - confirmed directly: a node given a source
   quote that does not appear in `samples/agency.txt` has its span nulled,
   `basis` flipped to `"inferred"`, and a warning naming the node appended.
6. **Cache hit** - confirmed: a second `/api/explain` call for the same
   passage/context/provider returns `meta.cached: true` in well under 50ms.
7. **Malformed model output -> repair -> clean 422** - confirmed by
   monkeypatching the Groq call to always return schema-invalid JSON: exactly
   one repair round-trip is attempted (visible in `runs/`), then a `422` with
   the validation errors.

## What I cut

- No streaming, no auth, no database, no icon artwork (icons render as an emoji
  placeholder from a closed vocabulary - the real glyph set is a renderer concern).
- The test page's SVG renderers (concept map, process, axis) are intentionally
  crude: circle-packed nodes, straight edges, no collision avoidance. Correct
  and legible for 3-9 nodes, not pretty.
- `scripts/`-style CLI testing and a pytest suite were both left out - the brief
  scopes tests to the seven checks above, not a test suite.

## What's fragile

- **This account's Groq free tier is tightly capped: 8000 tokens/minute for
  `openai/gpt-oss-120b`, input side, on-demand service tier.** Our prompt
  (system prompt + schema + an ~5000-character passage) runs close to that
  ceiling even after trimming the schema (see below), so back-to-back live
  calls routinely 429/413 until the per-minute window clears. This is an
  account/tier property, not something the code can fix - budget for it if
  you're iterating on the prompt live rather than against fixtures.
- The embedded JSON schema originally cost ~11K characters because Pydantic
  auto-adds a `title` to every single field (pure repetition of the field
  name) and a `description` per submodel (its class docstring) - together
  these alone pushed a single request over this tier's TPM cap before the
  model produced a single output token. `app/prompt.py` now strips both
  recursively before the schema is embedded (`_strip_bloat`), cutting it by
  roughly a third. If you add fields to `app/schema.py`, re-check the prompt
  size against your tier's TPM limit.
- Groq's own failure mode for "ran out of completion tokens before closing
  valid JSON" arrives as a `400` with `code: json_validate_failed`, not as
  malformed JSON in the response body - there's no content to hand to the
  schema validator at all. `_call_groq` now detects this specifically and
  routes it into the same one-shot repair loop as a schema-validation failure
  (`GenerationFailedError` in `app/llm.py`), and `max_completion_tokens` is
  set explicitly (8192) to make it less likely to happen in the first place.
  Before this fix it surfaced as an unhandled `500`, not the `502`/`422` the
  brief specifies - worth knowing if you see other Groq error shapes this
  code doesn't recognize yet; the catch-all in `_call_groq` maps anything
  else `>= 400` to a `502` rather than crashing, but it won't route through
  repair unless the failure mode is explicitly matched, and it can't invent a
  category for one it doesn't recognize.
- The live Appendix A run only produced the spectrum figure, not the second
  (axis) figure the brief's target describes - see check 3 above. Worth a
  prompt-tuning pass before trusting the two-figure behavior in production.
- The `provider` field on `POST /api/explain` is an addition beyond the literal
  API table in the brief (which lists only `passage/context/force`). It's
  additive and optional - omitting it preserves the documented contract exactly
  - but it exists specifically to make the test page's provider toggle
  functional per-request instead of requiring an env var change and restart.
- The comparison-form "missing cell -> `422`" rule is strict: the model must
  emit an explicit `"not stated"` cell for every (node, dimension) pair. A live
  model that skips a cell instead of writing `"not stated"` will fail
  validation and burn the one repair attempt. This is deliberate (a gap in the
  source is itself information, never a missing field) but it is the most
  likely live-only failure mode of the whole schema.

## One schema field I'd change after seeing real output

`Node.quote` and `Node.source.quote` are two separate verbatim-text fields with
overlapping purpose (one is "what shows on the card," the other is "what proves
the claim"), and nothing stops a model from putting different, unrelated
verbatim phrases in each. In practice they're almost always the same span. I'd
collapse them into one `Span` field (`source`) and derive the card's displayed
quote from `source.quote` directly, rather than asking the model to pick two
quotes that happen to agree.

---

## Schema v2 addendum

Everything above this line describes the original (v1) build. The extraction
contract was then replaced wholesale to match `PROMPT_SPEC.md` - see the
"Schema v2" section near the top. The v1-specific notes above (the comparison
"not stated" cell rule, the `Node.quote`/`source.quote` duplication) no longer
apply; they're left as history, not current documentation.

### What was verified for v2

- **All 6 fixtures validate and render.** `app/fixtures.py` was rebuilt for
  the new contract - SPECTRUM, QUADRANT, COMPARISON, PROCESS, CONCEPT_MAP, and
  a NO_FIGURE example - each with real offsets computed from the actual
  sample text via a `_span()` helper (never hand-typed integers), so a
  fixture can't silently point at the wrong words the way a copy-paste
  mistake could. Confirmed via `ExplainResponse.model_validate()` directly
  and via real HTTP round-trips through `/api/explain` with `LLM_PROVIDER=mock`.
- **verify.py's bounds-checking and quote verification both run correctly**
  against `samples/agency.txt` and the printing-press fixture text - 0
  warnings on the fully-verified fixtures, and the uniformity guard
  (Step 7's "re-read for attribution" self-check, enforced mechanically as a
  warning rather than a hard rejection) correctly flags figures where every
  node shares one hedge and one attribution value.
- **The hub test is a hard schema rejection**, not just prompt guidance: a
  CONCEPT_MAP figure where one node touches more than half the edges fails
  Pydantic validation and triggers the repair loop, matching PROMPT_SPEC.md's
  Step 5 rule exactly.
- **Live Groq calls now work.** The first version of the v2 `SYSTEM_PROMPT`
  was a near-verbatim transcription of `PROMPT_SPEC.md` (13,035 chars). Combined
  with the stripped JSON schema (5,840 chars) and a real passage, that
  unconditionally exceeded this account's fixed 8,000 TPM cap for
  `openai/gpt-oss-120b` - confirmed via direct reproduction against the Groq
  API: even with a fully clear rate-limit window, the request needed 8,993
  tokens against the 8,000 limit, so it could never succeed, not just
  occasionally throttle. Fixed by condensing `SYSTEM_PROMPT` to ~9,800 chars
  (same content, tighter wording - every hard rule from the spec is still
  there: the fit>=0.6/need>=0.4 gate, the hub test, the off_axis-never-placed
  rule, the uniformity guard, the register cautions). A real passage now
  costs ~5,200 prompt tokens, comfortably under the cap. Verified via a live
  `/api/explain` call with `LLM_PROVIDER=groq` against `samples/trust_definitions.txt`:
  HTTP 200, `meta.cached: false`, `meta.repair_attempted: false` (validated
  on the first attempt), one COMPARISON figure returned, and the uniformity
  guard correctly fired as a warning. Back-to-back live calls can still hit
  transient 429/413 rate-limit responses if the rolling TPM window already
  has other usage in it - `llm.py` already treats both as `RateLimitError`
  and retries, so this is expected and handled, not a bug.
- **The plain-language-simplification second call described in
  PROMPT_SPEC.md's "Pipeline note" is not implemented.** The spec calls for
  a second LLM pass over the structural JSON to simplify vocabulary, keeping
  `quotes[]` untouched. Given the account's TPM budget, doubling the number
  of Groq calls per request was judged impractical to add on top of an
  already-large rewrite in the time available - `node.body` text from the
  single extraction call is what ships today. This is a real, deliberate
  scope cut, not an oversight.
