"""Disk cache for explain responses: one JSON file per (passage, context, model)
combination under cache/. No database - iterating on the renderer against a real
payload should not cost an API call every time.
"""

import hashlib
import json
from pathlib import Path

CACHE_DIR = Path(__file__).resolve().parent.parent / "cache"


def make_key(passage: str, context: str | None, model: str) -> str:
    """
    Builds the cache key for one explain call.
    Parameters:
        passage (str): The submitted passage
        context (str | None): Optional surrounding context
        model (str): The model identifier used for extraction
    Returns:
        key (str): A sha256 hex digest identifying this (passage, context, model) triple
    """
    raw = f"{passage}\x1f{context or ''}\x1f{model}"
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def read(key: str) -> dict | None:
    """
    Reads a cached response by key.
    Parameters:
        key (str): The cache key from make_key
    Returns:
        data (dict | None): The cached response dict, or None on a cache miss
    """
    path = CACHE_DIR / f"{key}.json"
    if not path.exists():
        return None
    return json.loads(path.read_text(encoding="utf-8"))


def write(key: str, data: dict) -> None:
    """
    Writes a response to the cache.
    Parameters:
        key (str): The cache key from make_key
        data (dict): The full, validated response to persist
    Returns:
        (none)
    """
    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    path = CACHE_DIR / f"{key}.json"
    path.write_text(json.dumps(data, indent=2), encoding="utf-8")


def count() -> int:
    """
    Counts entries currently in the cache.
    Parameters:
        (none)
    Returns:
        n (int): Number of cached response files on disk
    """
    if not CACHE_DIR.exists():
        return 0
    return sum(1 for _ in CACHE_DIR.glob("*.json"))
