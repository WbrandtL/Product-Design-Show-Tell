"""
FastAPI application entrypoint for the Gist backend.
"""

import os
import time

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from app.cache import count_cache_entries, init_db
from app.pipeline import run_explain_pipeline
from app.samples import SAMPLE_PASSAGES
from app.schema import ExplainRequest, ExplainResponse, RelayoutRequest

load_dotenv()

app = FastAPI(title="Gist Backend")

STATIC_DIR = os.path.join(os.path.dirname(__file__), "static")
app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")

MIN_PASSAGE_LEN = 200
MAX_PASSAGE_LEN = 4000


@app.get("/")
def serve_index():
    '''
    Serves the static test page
    Parameters:
        (none)
    Returns:
        response (FileResponse): The index.html file from app/static
    '''
    return FileResponse(os.path.join(STATIC_DIR, "index.html"))


@app.get("/healthz")
def healthz():
    '''
    Reports service health, configured model, and cache size
    Parameters:
        (none)
    Returns:
        status (dict): status, model, has_api_key, and cache_entries fields
    '''
    return {
        "status": "ok",
        "model": os.environ.get("GROQ_MODEL", "moonshotai/kimi-k2-instruct"),
        "has_api_key": bool(os.environ.get("GROQ_API_KEY")),
        "cache_entries": count_cache_entries(),
    }


@app.get("/v1/samples")
def get_samples():
    '''
    Returns the built-in sample passages for the test page
    Parameters:
        (none)
    Returns:
        samples (list[dict]): List of sample passage objects with id, title, and text
    '''
    return SAMPLE_PASSAGES


@app.post("/v1/explain", response_model=ExplainResponse)
def post_explain(req: ExplainRequest):
    '''
    Runs the full explanation pipeline on a passage and returns the structured result
    Parameters:
        req (ExplainRequest): The passage, optional context, and mode
    Returns:
        response (ExplainResponse): The validated, span-verified explanation object
    Raises:
        HTTPException: 422 if the passage length is out of bounds, 502 if the LLM
            output fails validation twice
    '''
    passage_len = len(req.passage)
    if passage_len < MIN_PASSAGE_LEN:
        raise HTTPException(
            status_code=422,
            detail=f"Passage is too short ({passage_len} characters). "
            f"Select at least {MIN_PASSAGE_LEN} characters.",
        )
    if passage_len > MAX_PASSAGE_LEN:
        raise HTTPException(
            status_code=422,
            detail=f"Passage is too long ({passage_len} characters). "
            f"Select at most {MAX_PASSAGE_LEN} characters.",
        )
    start = time.time()
    response = run_explain_pipeline(req.passage, req.mode, req.context)
    elapsed_ms = int((time.time() - start) * 1000)
    if not response.meta.cached:
        response.meta.latency_ms = elapsed_ms
    return response


@app.get("/v1/explain/{explain_id}", response_model=ExplainResponse)
def get_explain(explain_id: str):
    '''
    Retrieves a previously computed explanation by id
    Parameters:
        explain_id (str): The uuid of a previously computed ExplainResponse
    Returns:
        response (ExplainResponse): The cached explanation object
    Raises:
        HTTPException: 404 if no cached response has this id
    '''
    response = get_cached_by_id(explain_id)
    if response is None:
        raise HTTPException(status_code=404, detail=f"No explanation found with id {explain_id}")
    return response


@app.post("/v1/explain/{explain_id}/relayout", response_model=ExplainResponse)
def post_relayout(explain_id: str, req: RelayoutRequest):
    '''
    Changes the layout_hint of a cached explanation without calling the LLM
    Parameters:
        explain_id (str): The uuid of a previously computed ExplainResponse
        req (RelayoutRequest): The new layout_hint to apply
    Returns:
        response (ExplainResponse): The same object with an updated layout_hint
    Raises:
        HTTPException: 404 if no cached response has this id
    '''
    response = get_cached_by_id(explain_id)
    if response is None:
        raise HTTPException(status_code=404, detail=f"No explanation found with id {explain_id}")
    response.layout_hint = req.layout_hint
    from app.cache import store_response

    store_response(_relayout_cache_key(explain_id), response)
    return response


def get_cached_by_id(explain_id: str) -> ExplainResponse | None:
    '''
    Looks up a cached ExplainResponse by its id field, scanning cache values
    Parameters:
        explain_id (str): The uuid to search for
    Returns:
        response (ExplainResponse | None): The matching response, or None if not found
    '''
    from app.cache import find_by_response_id

    return find_by_response_id(explain_id)


def _relayout_cache_key(explain_id: str) -> str:
    '''
    Builds the cache key under which a relayouted response is stored
    Parameters:
        explain_id (str): The uuid of the explanation being relayouted
    Returns:
        key (str): A cache key derived from the explanation id
    '''
    return f"relayout:{explain_id}"


init_db()
