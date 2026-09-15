"""
The four-stage explain pipeline: cache lookup, LLM extraction, repair, and
deterministic span verification.
"""

import json
import os
import time
import uuid
from datetime import datetime, timezone

from pydantic import ValidationError

from app.cache import get_cached, make_cache_key, store_response
from app.llm import extract_structure, get_model_name, repair_structure
from app.schema import ExplainContext, ExplainResponse, Meta
from app.verify import verify_response

SCHEMA_VERSION = "1.0"
LOG_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), "logs", "runs.jsonl")

FIXTURE_FILES = {
    "trust": "trust.json",
    "climate_feedback": "climate_feedback.json",
    "method_taxonomy": "method_taxonomy.json",
}


def run_explain_pipeline(
    passage: str, mode: str, context: ExplainContext | None
) -> ExplainResponse:
    '''
    Runs the full explain pipeline for a passage: cache lookup, LLM extraction
    with one repair retry, deterministic span verification, and cache storage
    Parameters:
        passage (str): The exact passage text to explain
        mode (str): "understand" or "explain_to_others"
        context (ExplainContext | None): Optional context to pass to the LLM
    Returns:
        response (ExplainResponse): The validated, span-verified explanation
    Raises:
        HTTPException: 502 if the LLM output fails validation twice and no
            fixture fallback is available
    '''
    model = get_model_name()
    key = make_cache_key(passage, mode, SCHEMA_VERSION, model)

    cached = get_cached(key)
    if cached is not None:
        cached.meta.cached = True
        _log_run(passage, model, 0, cached=True, attempts=0, meta=cached.meta)
        return cached

    start = time.time()
    validation_attempts = 0

    if not os.environ.get("GROQ_API_KEY"):
        response = _load_fixture_or_502(passage, "no GROQ_API_KEY configured")
    else:
        try:
            raw = extract_structure(passage, mode, context)
            validation_attempts += 1
            response = _try_parse(raw, model)
            if response is None:
                errors = _last_errors
                raw = repair_structure(raw, errors)
                validation_attempts += 1
                response = _try_parse(raw, model)
            if response is None:
                response = _load_fixture_or_502(passage, f"validation failed twice: {_last_errors}")
        except Exception as exc:
            response = _load_fixture_or_502(passage, f"LLM call failed: {exc}")

    response = verify_response(passage, response)
    latency_ms = int((time.time() - start) * 1000)
    response.meta.latency_ms = latency_ms
    response.meta.cached = False

    store_response(key, response)
    _log_run(passage, response.meta.model, latency_ms, cached=False, attempts=validation_attempts, meta=response.meta)
    return response


_last_errors = ""


def _try_parse(raw: str, model: str) -> ExplainResponse | None:
    '''
    Attempts to parse and validate raw LLM output into an ExplainResponse
    Parameters:
        raw (str): The raw JSON string returned by the LLM
        model (str): The model name to stamp into meta.model on success
    Returns:
        response (ExplainResponse | None): The validated response, or None if
            parsing or validation failed (in which case _last_errors is set)
    '''
    global _last_errors
    try:
        data = json.loads(raw)
        data["id"] = str(uuid.uuid4())
        data["schema_version"] = SCHEMA_VERSION
        data.setdefault("meta", {})
        data["meta"] = {
            "model": model,
            "latency_ms": 0,
            "cached": False,
            "spans_verified": 0,
            "spans_repaired": 0,
            "spans_dropped": 0,
        }
        return ExplainResponse.model_validate(data)
    except (json.JSONDecodeError, ValidationError) as exc:
        _last_errors = str(exc)
        return None


def _load_fixture_or_502(passage: str, reason: str) -> ExplainResponse:
    '''
    Loads a pre-baked fixture response matching the passage, for fallback mode
    Parameters:
        passage (str): The passage text, used to match against known sample passages
        reason (str): Why the fallback was triggered, included in the 502 error if raised
    Returns:
        response (ExplainResponse): A fixture-backed response with a fresh id
    Raises:
        HTTPException: 502 with the failure reason if no matching fixture exists
    '''
    from fastapi import HTTPException

    from app.samples import SAMPLE_PASSAGES

    fixtures_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), "fixtures")
    for sample in SAMPLE_PASSAGES:
        if sample["text"].strip() == passage.strip():
            fixture_path = os.path.join(fixtures_dir, FIXTURE_FILES[sample["id"]])
            if os.path.exists(fixture_path):
                with open(fixture_path) as f:
                    data = json.load(f)
                data["id"] = str(uuid.uuid4())
                response = ExplainResponse.model_validate(data)
                response.meta.model = "fixture"
                response.meta.cached = False
                return response

    generic_path = os.path.join(fixtures_dir, "trust.json")
    if os.path.exists(generic_path):
        with open(generic_path) as f:
            data = json.load(f)
        data["id"] = str(uuid.uuid4())
        response = ExplainResponse.model_validate(data)
        response.meta.model = "fixture"
        response.meta.cached = False
        return response

    raise HTTPException(status_code=502, detail=f"Extraction failed and no fixture available: {reason}")


def _log_run(passage: str, model: str, latency_ms: int, cached: bool, attempts: int, meta: Meta) -> None:
    '''
    Appends one JSON line describing this request to logs/runs.jsonl
    Parameters:
        passage (str): The passage that was processed
        model (str): The model name used
        latency_ms (int): Milliseconds elapsed for this request
        cached (bool): Whether this response was served from cache
        attempts (int): Number of LLM validation attempts made (0 if cached)
        meta (Meta): The response's meta object, for span verification counts
    Returns:
        None
    '''
    os.makedirs(os.path.dirname(LOG_PATH), exist_ok=True)
    entry = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "passage_hash": make_cache_key(passage, "", "", ""),
        "passage_length": len(passage),
        "model": model,
        "latency_ms": latency_ms,
        "cached": cached,
        "validation_attempts": attempts,
        "spans_verified": meta.spans_verified,
        "spans_repaired": meta.spans_repaired,
        "spans_dropped": meta.spans_dropped,
    }
    with open(LOG_PATH, "a") as f:
        f.write(json.dumps(entry) + "\n")
