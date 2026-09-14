"""
SQLite-backed cache for ExplainResponse objects.
"""

import hashlib
import os
import sqlite3
from datetime import datetime, timezone
from typing import Optional

from app.schema import ExplainResponse

DB_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), "cache.db")


def _connect() -> sqlite3.Connection:
    '''
    Opens a connection to the SQLite cache database
    Parameters:
        (none)
    Returns:
        conn (sqlite3.Connection): An open connection to cache.db
    '''
    return sqlite3.connect(DB_PATH)


def init_db() -> None:
    '''
    Creates the cache table if it does not already exist
    Parameters:
        (none)
    Returns:
        None
    '''
    conn = _connect()
    conn.execute(
        "CREATE TABLE IF NOT EXISTS cache ("
        "key TEXT PRIMARY KEY, "
        "response_json TEXT, "
        "created_at TEXT)"
    )
    conn.commit()
    conn.close()


def make_cache_key(passage: str, mode: str, schema_version: str, model: str) -> str:
    '''
    Builds the deterministic cache key for a given request
    Parameters:
        passage (str): The passage text
        mode (str): The requested mode
        schema_version (str): The schema version string
        model (str): The model name used for extraction
    Returns:
        key (str): A sha256 hex digest identifying this request
    '''
    raw = f"{passage}|{mode}|{schema_version}|{model}"
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def get_cached(key: str) -> Optional[ExplainResponse]:
    '''
    Looks up a cached response by its content-hash key
    Parameters:
        key (str): The cache key from make_cache_key
    Returns:
        response (ExplainResponse | None): The cached response, or None if not present
    '''
    conn = _connect()
    row = conn.execute(
        "SELECT response_json FROM cache WHERE key = ?", (key,)
    ).fetchone()
    conn.close()
    if row is None:
        return None
    return ExplainResponse.model_validate_json(row[0])


def store_response(key: str, response: ExplainResponse) -> None:
    '''
    Stores or overwrites a response under the given cache key
    Parameters:
        key (str): The cache key to store under
        response (ExplainResponse): The response object to serialize and store
    Returns:
        None
    '''
    conn = _connect()
    conn.execute(
        "INSERT OR REPLACE INTO cache (key, response_json, created_at) VALUES (?, ?, ?)",
        (key, response.model_dump_json(), datetime.now(timezone.utc).isoformat()),
    )
    conn.commit()
    conn.close()


def find_by_response_id(explain_id: str) -> Optional[ExplainResponse]:
    '''
    Scans the cache for a response whose id field matches the given uuid
    Parameters:
        explain_id (str): The uuid to search for
    Returns:
        response (ExplainResponse | None): The matching response, or None if not found
    '''
    conn = _connect()
    rows = conn.execute("SELECT response_json FROM cache").fetchall()
    conn.close()
    for (response_json,) in rows:
        response = ExplainResponse.model_validate_json(response_json)
        if response.id == explain_id:
            return response
    return None


def count_cache_entries() -> int:
    '''
    Counts the number of entries currently stored in the cache
    Parameters:
        (none)
    Returns:
        count (int): The number of rows in the cache table
    '''
    conn = _connect()
    row = conn.execute("SELECT COUNT(*) FROM cache").fetchone()
    conn.close()
    return row[0]
