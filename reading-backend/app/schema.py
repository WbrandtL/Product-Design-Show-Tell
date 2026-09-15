"""
Pydantic v2 models for the reading-tool backend response contract.
"""

from typing import Literal, Optional

from pydantic import BaseModel, Field

PassagePattern = Literal[
    "comparison",
    "causal_chain",
    "definition_dispute",
    "claim_evidence",
    "taxonomy",
    "process",
    "narrative",
]

LayoutHint = Literal["comparison_table", "flow", "quadrant", "hierarchy", "timeline"]

NodeKind = Literal["theorist", "concept", "claim", "evidence", "method", "object"]

EdgeRelation = Literal[
    "supports",
    "contradicts",
    "refines",
    "defines",
    "causes",
    "precedes",
    "example_of",
    "contrasts_with",
    "applies_to",
]

Evidentiality = Literal["stated", "inferred"]

Span = tuple[int, int]


class Node(BaseModel):
    '''
    Represents one concept, person, claim, or object extracted from the passage
    Parameters:
        id (str): Short slug identifying this node, e.g. "giddens"
        label (str): The term as the passage names it, max 4 words
        plain_label (str): The same thing in plain language, max 6 words
        kind (str): One of theorist | concept | claim | evidence | method | object
        one_line (str): Max 18 words, plain language, what this is in this passage
        emphasis (int): 1 = central, 2 = supporting, 3 = background
        source_span (tuple[int, int] | None): Character offsets [start, end] into the passage
        quote (str | None): The exact substring of the passage at source_span
    '''

    id: str
    label: str = Field(max_length=80)
    plain_label: str = Field(max_length=80)
    kind: NodeKind
    one_line: str
    emphasis: Literal[1, 2, 3]
    source_span: Optional[Span] = None
    quote: Optional[str] = None


class Edge(BaseModel):
    '''
    Represents a typed relation between two nodes
    Parameters:
        id (str): Short identifier for this edge
        source (str): Node id this edge originates from
        target (str): Node id this edge points to
        relation (str): One of supports | contradicts | refines | defines | causes |
            precedes | example_of | contrasts_with | applies_to
        label (str): Plain-language label, max 6 words
        evidentiality (str): "stated" if the passage says this in words, else "inferred"
        source_span (tuple[int, int] | None): Required when evidentiality == "stated"
        quote (str | None): The exact substring of the passage at source_span
    '''

    id: str
    source: str
    target: str
    relation: EdgeRelation
    label: str
    evidentiality: Evidentiality
    source_span: Optional[Span] = None
    quote: Optional[str] = None


class GlossTerm(BaseModel):
    '''
    Represents a plain-language gloss for one piece of jargon in the passage
    Parameters:
        term (str): The jargon term as it appears in the passage
        plain_definition (str): Max 15 words, no other jargon inside it
        in_this_passage (str): Max 20 words, what the term means specifically here
        source_span (tuple[int, int]): Character offsets [start, end] into the passage
    '''

    term: str
    plain_definition: str
    in_this_passage: str
    source_span: Span


class Meta(BaseModel):
    '''
    Represents bookkeeping information about how a response was produced
    Parameters:
        model (str): Name of the model that produced this response
        latency_ms (int): Milliseconds elapsed for the extraction pipeline
        cached (bool): True if this response was served from the SQLite cache
        spans_verified (int): Count of spans that matched the passage exactly
        spans_repaired (int): Count of spans whose offsets were corrected
        spans_dropped (int): Count of spans that could not be located and were dropped
    '''

    model: str
    latency_ms: int
    cached: bool
    spans_verified: int
    spans_repaired: int
    spans_dropped: int


class ExplainResponse(BaseModel):
    '''
    Represents the full structured explanation object returned to the frontend
    Parameters:
        id (str): UUID identifying this response, also used as the cache lookup key
        schema_version (str): Version tag for this schema, currently "1.0"
        passage_pattern (str): One of comparison | causal_chain | definition_dispute |
            claim_evidence | taxonomy | process | narrative
        layout_hint (str): One of comparison_table | flow | quadrant | hierarchy | timeline
        takeaway (str): One sentence, max 25 words, plain language, no jargon
        explain_script (str): 2-3 sentences the reader could say out loud to a colleague
        nodes (list[Node]): 2-7 extracted nodes, hard cap 7
        edges (list[Edge]): 1-10 typed relations between nodes
        glossary (list[GlossTerm]): 0-8 plain-language glosses for jargon
        simplifications (list[str]): 0-3 statements of what this diagram flattens or omits
        meta (Meta): Bookkeeping information about how this response was produced
    '''

    id: str
    schema_version: str = "1.0"
    passage_pattern: PassagePattern
    layout_hint: LayoutHint
    takeaway: str
    explain_script: str
    nodes: list[Node] = Field(min_length=2, max_length=7)
    edges: list[Edge] = Field(min_length=1, max_length=10)
    glossary: list[GlossTerm] = Field(default_factory=list, max_length=8)
    simplifications: list[str] = Field(default_factory=list, max_length=3)
    meta: Meta


class ExplainContext(BaseModel):
    '''
    Represents optional contextual metadata supplied alongside a passage
    Parameters:
        paper_title (str | None): Title of the source paper, if known
        research_question (str | None): The reader's research question, if known
        surrounding_text (str | None): Text surrounding the selected passage, if known
    '''

    paper_title: Optional[str] = None
    research_question: Optional[str] = None
    surrounding_text: Optional[str] = None


class ExplainRequest(BaseModel):
    '''
    Represents an incoming request to explain a passage
    Parameters:
        passage (str): The selected passage text, between 200 and 4000 characters
        context (ExplainContext | None): Optional contextual metadata
        mode (str): "understand" or "explain_to_others", changes takeaway emphasis only
    '''

    passage: str
    context: Optional[ExplainContext] = None
    mode: Literal["understand", "explain_to_others"] = "understand"


class RelayoutRequest(BaseModel):
    '''
    Represents a request to change only the layout hint of a cached response
    Parameters:
        layout_hint (str): One of comparison_table | flow | quadrant | hierarchy | timeline
    '''

    layout_hint: LayoutHint
