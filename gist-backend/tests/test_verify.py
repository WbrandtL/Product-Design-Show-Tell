"""
Tests for deterministic span verification logic.
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.verify import verify_span

PASSAGE = "Giddens defines trust as confidence in reliability under risk."


def test_exact_match_is_verified():
    '''
    Confirms a span that already matches the quote exactly is marked verified
    Parameters:
        (none)
    Returns:
        None
    '''
    status, span = verify_span(PASSAGE, (0, 7), "Giddens")
    assert status == "verified"
    assert span == (0, 7)


def test_offset_drift_is_repaired():
    '''
    Confirms a span with wrong offsets but a uniquely-locatable quote is repaired
    Parameters:
        (none)
    Returns:
        None
    '''
    status, span = verify_span(PASSAGE, (2, 9), "Giddens")
    assert status == "repaired"
    assert span == (0, 7)


def test_missing_quote_is_dropped():
    '''
    Confirms a quote that does not occur anywhere in the passage is dropped
    Parameters:
        (none)
    Returns:
        None
    '''
    status, span = verify_span(PASSAGE, (0, 7), "Luhmann")
    assert status == "dropped"
    assert span is None


def test_duplicate_quote_without_matching_offset_is_dropped():
    '''
    Confirms a quote occurring more than once in the passage, with offsets that
    do not point to any exact occurrence, is dropped rather than guessed at
    Parameters:
        (none)
    Returns:
        None
    '''
    passage = "trust is trust in this sentence about trust"
    status, span = verify_span(passage, (100, 105), "trust")
    assert status == "dropped"
    assert span is None


def test_no_quote_is_dropped():
    '''
    Confirms a missing or empty quote is always dropped, regardless of span
    Parameters:
        (none)
    Returns:
        None
    '''
    status, span = verify_span(PASSAGE, (0, 7), "")
    assert status == "dropped"
    assert span is None
