"""Provider abstraction for turning a passage into raw diagram JSON: `mock` (no
network, fixture-backed) or `groq` (Groq's OpenAI-compatible chat completions,
with a one-shot repair loop on schema failure).
"""

import asyncio
import hashlib
import json
import os
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import httpx
from pydantic import ValidationError

from app.fixtures import AGENCY_FIXTURE, FORM_FIXTURES
from app.prompt import SYSTEM_PROMPT, build_repair_message, build_user_message
from app.schema import ExplainResponse

RUNS_DIR = Path(__file__).resolve().parent.parent / "runs"
GROQ_URL = "https://api.groq.com/openai/v1/chat/completions"
# Generous headroom for a two-figure response (~11 nodes, several glossary items).
# Groq's per-minute token cap on a free/on-demand tier is on the *input* side (see
# the 413 handling below); this only bounds output, so raising it doesn't cost
# against that budget unless the model actually uses the tokens.
MAX_COMPLETION_TOKENS = 8192

_PLACEHOLDER_META = {"model": "x", "provider": "x", "latency_ms": 0, "passage_hash": "x"}


class ExtractionError(Exception):
    """Raised when the model's output still fails schema validation after one repair attempt."""

    def __init__(
        self,
        errors: str,
        *,
        prompt: str | None = None,
        raw_response: str | None = None,
        repair_attempted: bool = True,
    ):
        self.errors = errors
        self.prompt = prompt
        self.raw_response = raw_response
        self.repair_attempted = repair_attempted
        super().__init__(errors)


class RateLimitError(Exception):
    """Raised when the provider returns a rate-limit response."""

    def __init__(self, retry_after: str | None):
        self.retry_after = retry_after
        super().__init__(f"rate limited, retry after {retry_after}")


class ProviderUnavailableError(Exception):
    """Raised when the provider is unreachable or returns a server error."""


class GenerationFailedError(Exception):
    """Raised when Groq itself reports it could not produce valid JSON at all
    (e.g. it ran out of completion tokens mid-generation). Treated the same as a
    schema validation failure: it feeds the one-shot repair loop rather than
    failing the request outright, since a shorter follow-up often succeeds where
    the original, larger generation did not."""


def resolve_provider() -> str:
    """
    Determines the active LLM provider.
    Parameters:
        (none)
    Returns:
        provider (str): "mock" or "groq" - LLM_PROVIDER if set, else "groq" when
            GROQ_API_KEY is present, else "mock"
    """
    explicit = os.environ.get("LLM_PROVIDER")
    if explicit:
        return explicit
    return "groq" if os.environ.get("GROQ_API_KEY") else "mock"


def _select_fixture(passage: str, context: str | None) -> tuple[dict, str]:
    """
    Picks a mock fixture by keyword heuristic, honouring an explicit
    "fixture:<form>" hint in context before falling back to content keywords.
    Parameters:
        passage (str): The submitted passage
        context (str | None): Optional context, may carry a "fixture:<form>" hint
    Returns:
        result (tuple[dict, str]): (fixture payload, fixture name) for logging
    """
    text = f"{context or ''} {passage}".lower()

    for form in FORM_FIXTURES:
        if f"fixture:{form}" in text:
            return FORM_FIXTURES[form], form

    if "giddens" in text and "agency" in text:
        return AGENCY_FIXTURE, "agency"
    if any(k in text for k in ("differ", "compare", "in contrast", "whereas", "dimension", "narrower", "broader")):
        return FORM_FIXTURES["comparison"], "comparison"
    if any(k in text for k in ("causes", "leads to", "feedback loop", "thaw", "accelerat")):
        return FORM_FIXTURES["process"], "process"
    if any(k in text for k in ("quadrant", "2x2", "grid", "two independent", "two axes")):
        return FORM_FIXTURES["quadrant"], "quadrant"
    if any(k in text for k in ("reset your password", "tap save", "open settings")):
        return FORM_FIXTURES["no_figure"], "no_figure"
    return FORM_FIXTURES["concept_map"], "concept_map"


def _validate_payload(payload: dict) -> str | None:
    """
    Checks a raw payload against the full schema, using placeholder id/meta so
    the cross-reference rules (which don't touch id/meta) still run.
    Parameters:
        payload (dict): The candidate diagram JSON, without id or meta
    Returns:
        errors (str | None): The validation error text, or None if it validates
    """
    candidate = {**payload, "passage_id": "validation-check", "meta": _PLACEHOLDER_META}
    try:
        ExplainResponse.model_validate(candidate)
    except ValidationError as e:
        return str(e)
    return None


def _parse_and_validate(raw: str) -> tuple[dict | None, str | None]:
    """
    Parses a raw model response as JSON and validates it against the schema.
    Parameters:
        raw (str): The model's raw text output
    Returns:
        result (tuple[dict | None, str | None]): (payload, None) on success, or
            (None, error text) on a JSON or schema error
    """
    try:
        payload = json.loads(raw)
    except json.JSONDecodeError as e:
        return None, f"invalid JSON: {e}"
    errors = _validate_payload(payload)
    if errors:
        return None, errors
    return payload, None


async def _call_groq(api_key: str, model: str, messages: list[dict]) -> str:
    """
    Makes one Groq chat completion call in JSON mode.
    Parameters:
        api_key (str): The Groq API key
        model (str): The Groq model id, from GROQ_MODEL
        messages (list[dict]): The chat messages to send
    Returns:
        content (str): The raw text of the model's reply
    """
    async with httpx.AsyncClient(timeout=30.0) as client:
        try:
            resp = await client.post(
                GROQ_URL,
                headers={"Authorization": f"Bearer {api_key}"},
                json={
                    "model": model,
                    "messages": messages,
                    "temperature": 0.2,
                    "max_completion_tokens": MAX_COMPLETION_TOKENS,
                    "response_format": {"type": "json_object"},
                },
            )
        except httpx.RequestError as e:
            raise ProviderUnavailableError(f"could not reach Groq: {e}") from e

    if resp.status_code == 429 or (resp.status_code == 413 and "rate_limit" in resp.text.lower()):
        # Groq reports its per-minute token cap as 413 ("Request too large ... on
        # tokens per minute"), not 429, when the prompt alone exceeds the tier's
        # TPM budget. That is a rate limit in substance, so it gets the same
        # handling as a real 429 rather than falling through to a raw 500.
        raise RateLimitError(resp.headers.get("retry-after"))
    if resp.status_code == 400 and "json_validate_failed" in resp.text.lower():
        # Groq ran out of completion tokens (or otherwise couldn't close valid
        # JSON) before finishing. No content comes back at all, so this can't go
        # through _parse_and_validate - it's handled by the caller the same way
        # as a validation failure, via GenerationFailedError.
        raise GenerationFailedError(resp.text)
    if resp.status_code in (400, 404) and "model" in resp.text.lower():
        raise RuntimeError(
            f"Groq rejected model '{model}' (set via the GROQ_MODEL env var) - it may have "
            f"been retired; set GROQ_MODEL to a current free-tier model id from "
            f"console.groq.com. Raw error: {resp.text}"
        )
    if resp.status_code >= 500:
        raise ProviderUnavailableError(f"Groq returned {resp.status_code}: {resp.text}")
    if resp.status_code >= 400:
        raise ProviderUnavailableError(f"Groq returned {resp.status_code}: {resp.text}")

    data = resp.json()
    return data["choices"][0]["message"]["content"]


async def _extract_groq(passage: str, context: str | None) -> tuple[dict, dict]:
    """
    Runs one live Groq extraction, with a single repair attempt on validation failure.
    Parameters:
        passage (str): The academic text passage submitted by the reader
        context (str | None): Optional surrounding context
    Returns:
        result (tuple[dict, dict]): (payload, meta) - see extract()
    """
    api_key = os.environ.get("GROQ_API_KEY")
    if not api_key:
        raise RuntimeError("GROQ_API_KEY is not set; set LLM_PROVIDER=mock or provide a Groq API key")
    model = os.environ.get("GROQ_MODEL")
    if not model:
        raise RuntimeError("GROQ_MODEL is not set; set it to a current Groq model id in your .env")

    user_message = build_user_message(passage, context)
    messages = [
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "user", "content": user_message},
    ]

    start = time.monotonic()
    try:
        raw = await _call_groq(api_key, model, messages)
        payload, errors = _parse_and_validate(raw)
    except GenerationFailedError as e:
        raw, payload, errors = f"(no output - generation failed)\n{e}", None, str(e)

    repair_attempted = False
    if errors:
        repair_attempted = True
        messages.append({"role": "assistant", "content": raw})
        messages.append({"role": "user", "content": build_repair_message(raw, errors)})
        try:
            raw = await _call_groq(api_key, model, messages)
            payload, errors2 = _parse_and_validate(raw)
        except GenerationFailedError as e:
            raw, payload, errors2 = f"(no output - generation failed)\n{e}", None, str(e)
        if errors2:
            raise ExtractionError(
                errors2,
                prompt=f"SYSTEM:\n{SYSTEM_PROMPT}\n\nUSER:\n{user_message}\n\n(after one repair attempt)",
                raw_response=raw,
                repair_attempted=True,
            )

    latency_ms = int((time.monotonic() - start) * 1000)
    meta = {
        "provider": "groq",
        "model": model,
        "latency_ms": latency_ms,
        "repair_attempted": repair_attempted,
        "prompt": f"SYSTEM:\n{SYSTEM_PROMPT}\n\nUSER:\n{user_message}",
        "raw_response": raw,
    }
    assert payload is not None
    return payload, meta


async def extract(passage: str, context: str | None, provider: str | None = None) -> tuple[dict, dict]:
    """
    Turns a passage into raw diagram JSON using the configured provider.
    Parameters:
        passage (str): The academic text passage submitted by the reader
        context (str | None): Optional surrounding context, e.g. paper title or topic
        provider (str | None): Explicit "mock" or "groq" override for this call
            only; defaults to resolve_provider() when omitted
    Returns:
        payload (dict): Unvalidated JSON object as returned by the model (no id/meta)
        meta (dict): Provider, model, latency and repair information
    """
    provider = provider or resolve_provider()

    if provider == "mock":
        start = time.monotonic()
        payload, fixture_name = _select_fixture(passage, context)
        await asyncio.sleep(0.3)
        latency_ms = int((time.monotonic() - start) * 1000)
        meta = {
            "provider": "mock",
            "model": f"mock:{fixture_name}",
            "latency_ms": latency_ms,
            "repair_attempted": False,
            "prompt": None,
            "raw_response": None,
        }
        return payload, meta

    if provider == "groq":
        return await _extract_groq(passage, context)

    raise RuntimeError(f"Unknown LLM_PROVIDER '{provider}'; expected 'mock' or 'groq'")


def log_run(
    *,
    passage: str,
    context: str | None,
    meta: dict,
    payload: dict[str, Any] | None,
    warnings: list[str],
    error: str | None = None,
) -> None:
    """
    Appends one run record to runs/<iso-timestamp>-<hash>.json.
    Parameters:
        passage (str): The submitted passage
        context (str | None): Optional surrounding context
        meta (dict): The meta dict returned by extract(), including prompt/raw_response
        payload (dict | None): The final parsed result, or None if extraction failed
        warnings (list[str]): Span verification warnings
        error (str | None): The error text if the run ultimately failed
    Returns:
        (none)
    """
    RUNS_DIR.mkdir(parents=True, exist_ok=True)
    now = datetime.now(timezone.utc)
    stamp = now.strftime("%Y%m%dT%H%M%S%fZ")
    short_hash = hashlib.sha256(passage.encode("utf-8")).hexdigest()[:8]
    record = {
        "timestamp": now.isoformat(),
        "passage": passage,
        "context": context,
        "prompt": meta.get("prompt"),
        "raw_response": meta.get("raw_response"),
        "provider": meta.get("provider"),
        "model": meta.get("model"),
        "latency_ms": meta.get("latency_ms"),
        "repair_attempted": meta.get("repair_attempted"),
        "parsed_result": payload,
        "warnings": warnings,
        "error": error,
    }
    path = RUNS_DIR / f"{stamp}-{short_hash}.json"
    path.write_text(json.dumps(record, indent=2), encoding="utf-8")
