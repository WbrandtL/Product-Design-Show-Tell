"""FastAPI app: the /api/* routes plus the static test page. One process serves
both, so there is no CORS setup and no second dev server.
"""

import os
from pathlib import Path
from uuid import uuid4

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, ValidationError

load_dotenv()

from app import cache, llm, verify  # noqa: E402  (after load_dotenv so env vars are set)
from app.schema import ExplainResponse  # noqa: E402

BASE_DIR = Path(__file__).resolve().parent.parent
SAMPLES_DIR = BASE_DIR / "samples"
STATIC_DIR = BASE_DIR / "static"

MIN_PASSAGE_CHARS = 200
MAX_PASSAGE_CHARS = 8000

SAMPLE_MANIFEST = [
    {"id": "agency", "title": "Agency and structure in critical theory (Appendix A)", "file": "agency.txt"},
    {"id": "permafrost_feedback", "title": "The permafrost carbon feedback loop", "file": "permafrost_feedback.txt"},
    {"id": "trust_definitions", "title": "Three competing definitions of trust", "file": "trust_definitions.txt"},
]

app = FastAPI(title="Reading Tool Backend")


class ExplainRequest(BaseModel):
    """The body of a POST /api/explain call."""

    passage: str
    context: str | None = None
    force: bool = False
    provider: str | None = None


@app.get("/api/health")
def health() -> dict:
    """
    Reports service status, the active provider/model and the cache size.
    Parameters:
        (none)
    Returns:
        status (dict): {status, provider, model, cache_entries}
    """
    provider = llm.resolve_provider()
    if provider == "groq":
        model = os.environ.get("GROQ_MODEL") or "(GROQ_MODEL unset)"
    else:
        model = "mock"
    return {"status": "ok", "provider": provider, "model": model, "cache_entries": cache.count()}


@app.get("/api/samples")
def get_samples() -> list[dict]:
    """
    Lists the built-in sample passages.
    Parameters:
        (none)
    Returns:
        samples (list[dict]): [{id, title, passage}, ...] for each built-in sample
    """
    out = []
    for entry in SAMPLE_MANIFEST:
        path = SAMPLES_DIR / entry["file"]
        text = path.read_text(encoding="utf-8").strip()
        out.append({"id": entry["id"], "title": entry["title"], "passage": text})
    return out


@app.post("/api/explain", response_model=ExplainResponse)
async def explain(req: ExplainRequest) -> ExplainResponse:
    """
    Turns a submitted passage into a validated, span-verified ExplainResponse,
    serving from cache when possible.
    Parameters:
        req (ExplainRequest): {passage, context?, force?}
    Returns:
        response (ExplainResponse): The structured diagram data
    """
    passage = req.passage
    length_warning: str | None = None

    if len(passage) < MIN_PASSAGE_CHARS:
        raise HTTPException(
            status_code=422,
            detail=(
                f"Passage is too short ({len(passage)} characters, minimum "
                f"{MIN_PASSAGE_CHARS}) - a single sentence has no structure to map."
            ),
        )
    if len(passage) > MAX_PASSAGE_CHARS:
        passage = passage[:MAX_PASSAGE_CHARS]
        length_warning = (
            f"Passage exceeded {MAX_PASSAGE_CHARS} characters and was truncated before extraction."
        )

    provider = req.provider or llm.resolve_provider()
    cache_model = os.environ.get("GROQ_MODEL", "") if provider == "groq" else "mock"
    key = cache.make_key(passage, req.context, f"{provider}:{cache_model}")

    if not req.force:
        cached = cache.read(key)
        if cached is not None:
            cached = dict(cached)
            cached["meta"] = {**cached["meta"], "cached": True, "latency_ms": 0}
            return ExplainResponse.model_validate(cached)

    try:
        payload, meta = await llm.extract(passage, req.context, provider)
    except llm.RateLimitError as e:
        raise HTTPException(
            status_code=429,
            detail=f"Groq rate limit hit; retry after {e.retry_after or 'a few'} seconds.",
            headers={"Retry-After": e.retry_after} if e.retry_after else None,
        )
    except llm.ProviderUnavailableError as e:
        raise HTTPException(status_code=502, detail=str(e))
    except llm.ExtractionError as e:
        llm.log_run(
            passage=passage, context=req.context,
            meta={"provider": provider, "model": cache_model, "prompt": e.prompt,
                  "raw_response": e.raw_response, "latency_ms": 0, "repair_attempted": e.repair_attempted},
            payload=None, warnings=[], error=e.errors,
        )
        raise HTTPException(status_code=422, detail=e.errors)
    except RuntimeError as e:
        raise HTTPException(status_code=502, detail=str(e))

    full = {
        **payload,
        "passage_id": str(uuid4()),
        "meta": {
            "model": meta["model"],
            "provider": meta["provider"],
            "latency_ms": meta["latency_ms"],
            "passage_hash": key,
            "cached": False,
            "warnings": [],
            "repair_attempted": meta["repair_attempted"],
        },
    }
    try:
        response = ExplainResponse.model_validate(full)
    except ValidationError as e:
        llm.log_run(passage=passage, context=req.context, meta=meta, payload=payload,
                    warnings=[], error=str(e))
        raise HTTPException(status_code=422, detail=str(e))

    warnings = verify.verify_response(response, passage)
    if length_warning:
        warnings.append(length_warning)
    response.meta.warnings = warnings

    cache.write(key, response.model_dump(mode="json"))
    llm.log_run(passage=passage, context=req.context, meta=meta,
                payload=response.model_dump(mode="json"), warnings=warnings, error=None)

    return response


app.mount("/", StaticFiles(directory=STATIC_DIR, html=True), name="static")
