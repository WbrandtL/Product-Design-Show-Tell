"""
Tests for Pydantic schema validation of ExplainResponse payloads.
"""

import sys
from pathlib import Path

import pytest
from pydantic import ValidationError

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.schema import ExplainResponse


def make_good_payload():
    '''
    Builds a known-good ExplainResponse payload for validation tests
    Parameters:
        (none)
    Returns:
        payload (dict): A dictionary matching the ExplainResponse schema
    '''
    return {
        "id": "11111111-1111-1111-1111-111111111111",
        "schema_version": "1.0",
        "passage_pattern": "comparison",
        "layout_hint": "comparison_table",
        "takeaway": "Two theorists define trust differently, one on risk and one on habit.",
        "explain_script": "Giddens says trust is about accepting risk. Luhmann says it is about "
        "reducing complexity. They're answering different questions.",
        "nodes": [
            {
                "id": "giddens",
                "label": "Giddens",
                "plain_label": "Giddens",
                "kind": "theorist",
                "one_line": "A sociologist who links trust to risk in modern life.",
                "emphasis": 1,
                "source_span": [0, 7],
                "quote": "Giddens",
            },
            {
                "id": "luhmann",
                "label": "Luhmann",
                "plain_label": "Luhmann",
                "kind": "theorist",
                "one_line": "A sociologist who links trust to reducing complexity.",
                "emphasis": 2,
                "source_span": [10, 17],
                "quote": "Luhmann",
            },
        ],
        "edges": [
            {
                "id": "e1",
                "source": "giddens",
                "target": "luhmann",
                "relation": "contrasts_with",
                "label": "defines trust differently than",
                "evidentiality": "stated",
                "source_span": [0, 17],
                "quote": "Giddens and Luhmann",
            }
        ],
        "glossary": [],
        "simplifications": [],
        "meta": {
            "model": "moonshotai/kimi-k2-instruct",
            "latency_ms": 1200,
            "cached": False,
            "spans_verified": 3,
            "spans_repaired": 0,
            "spans_dropped": 0,
        },
    }


def test_valid_payload_parses():
    '''
    Confirms a known-good payload validates without error
    Parameters:
        (none)
    Returns:
        None
    '''
    resp = ExplainResponse.model_validate(make_good_payload())
    assert resp.id == "11111111-1111-1111-1111-111111111111"
    assert len(resp.nodes) == 2
    assert resp.nodes[0].source_span == (0, 7)


def test_missing_required_field_rejected():
    '''
    Confirms a payload missing a required field fails validation
    Parameters:
        (none)
    Returns:
        None
    '''
    bad = make_good_payload()
    del bad["takeaway"]
    with pytest.raises(ValidationError):
        ExplainResponse.model_validate(bad)


def test_too_many_nodes_rejected():
    '''
    Confirms a payload with more than 7 nodes fails validation
    Parameters:
        (none)
    Returns:
        None
    '''
    bad = make_good_payload()
    template = bad["nodes"][0]
    bad["nodes"] = [
        {**template, "id": f"n{i}", "source_span": None, "quote": None} for i in range(8)
    ]
    with pytest.raises(ValidationError):
        ExplainResponse.model_validate(bad)


def test_invalid_relation_rejected():
    '''
    Confirms a payload with an edge relation outside the allowed enum fails validation
    Parameters:
        (none)
    Returns:
        None
    '''
    bad = make_good_payload()
    bad["edges"][0]["relation"] = "loves"
    with pytest.raises(ValidationError):
        ExplainResponse.model_validate(bad)


def test_invalid_emphasis_rejected():
    '''
    Confirms a payload with an emphasis value outside 1-3 fails validation
    Parameters:
        (none)
    Returns:
        None
    '''
    bad = make_good_payload()
    bad["nodes"][0]["emphasis"] = 5
    with pytest.raises(ValidationError):
        ExplainResponse.model_validate(bad)
