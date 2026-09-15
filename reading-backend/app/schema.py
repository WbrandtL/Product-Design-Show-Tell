"""Pydantic v2 contract matching PROMPT_SPEC.md's "figure-selection" output
schema exactly. `passage_id` and `meta` are not requested from the model -
they're assembled by the route after extraction (see prompt.py's
schema_for_prompt(), which strips them before the schema is shown to the LLM)
the same way the rest of this pipeline works.
"""

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator

Register = Literal[
    "ARGUMENT", "MECHANISM", "SPECIFICATION", "PROCEDURE", "RULE",
    "QUANTITY", "NARRATIVE", "DESCRIPTION", "PERSUASION", "META",
]
Domain = Literal[
    "academic", "news", "legal", "technical", "instructional", "commercial", "personal", "other",
]
Form = Literal["SPECTRUM", "QUADRANT", "COMPARISON", "PROCESS", "CONCEPT_MAP"]
Hedge = Literal["stated", "hedged", "negated", "disputed"]
RelationType = Literal[
    "contrast", "third_position", "lineage", "synthesis", "precedent", "alignment",
    "causation", "condition", "exception", "concession", "definition",
    "framing_rejection", "hierarchy", "sequence", "quantity", "enumeration",
]
Strength = Literal["strong", "normal", "weak"]
ResidueReason = Literal[
    "META", "NEGATION", "HEDGE_ONLY", "VERBATIM_REQUIRED", "ALREADY_A_FIGURE",
    "LOW_VALUE_LINEAGE", "FORM_UNAVAILABLE", "PROSE_IS_THE_POINT", "BELOW_GATE",
]

# The renderer's full form vocabulary - always offered in full, since the
# Gist app and the plain test page both draw all five.
AVAILABLE_FORMS: list[str] = ["SPECTRUM", "QUADRANT", "COMPARISON", "PROCESS", "CONCEPT_MAP"]

Span = tuple[int, int]


class Segment(BaseModel):
    """One register-tagged stretch of the passage (Step 1)."""

    model_config = ConfigDict(extra="forbid")

    spans: list[Span]
    register: Register


class Attribution(BaseModel):
    """Who a claim is attributed to, if anyone (Step 2)."""

    model_config = ConfigDict(extra="forbid")

    source: str = ""
    named: bool


class Axis(BaseModel):
    """One named continuum a SPECTRUM or QUADRANT figure positions nodes on."""

    model_config = ConfigDict(extra="forbid")

    id: str
    left_pole: str
    right_pole: str


class Placement(BaseModel):
    """One node's position on one of its figure's axes. 0 = left_pole, 1 = right_pole."""

    model_config = ConfigDict(extra="forbid")

    axis: str
    position: float = Field(ge=0, le=1)


class NodeSpec(BaseModel):
    """One entity in a figure (Step 2-3, merged per the person+contribution rule)."""

    model_config = ConfigDict(extra="forbid")

    id: str
    label: str
    body: str
    attribution: Attribution
    hedge: Hedge
    off_axis: bool = False
    placement: list[Placement] = []
    spans: list[Span] = Field(min_length=1)

    @model_validator(mode="after")
    def _off_axis_has_no_placement(self) -> "NodeSpec":
        """An off-axis node asserting a position turns 'this question is
        wrong' into 'this person is a moderate' - the spec forbids it outright."""
        if self.off_axis and self.placement:
            raise ValueError(f"node {self.id}: off_axis nodes must not carry a placement")
        return self


class EdgeSpec(BaseModel):
    """One typed relation between two nodes in the same figure (Step 3)."""

    model_config = ConfigDict(extra="forbid", populate_by_name=True)

    from_: str = Field(alias="from")
    to: str
    type: RelationType
    label: str
    strength: Strength = "normal"
    spans: list[Span] = []


class EmptyRegion(BaseModel):
    """An unoccupied cell or branch - itself a finding, never just omitted."""

    model_config = ConfigDict(extra="forbid")

    cell: str
    finding: str


class Quote(BaseModel):
    """A verbatim quotation too long or too specific to fold into a node body."""

    model_config = ConfigDict(extra="forbid")

    node: str
    text: str
    cite: str | None = None
    spans: list[Span] = Field(min_length=1)


class Figure(BaseModel):
    """One figure: the question it answers, its form, and everything the
    renderer needs to draw it honestly (Steps 4-9)."""

    model_config = ConfigDict(extra="forbid")

    form: Form
    question: str
    fit: float = Field(ge=0, le=1)
    need: float = Field(ge=0, le=1)
    axes: list[Axis] = []
    nodes: list[NodeSpec] = Field(min_length=1)
    edges: list[EdgeSpec] = []
    empty_regions: list[EmptyRegion] = []
    quotes: list[Quote] = []
    loop_has_origin: bool | None = None
    caption: str
    verbal_summary: str

    @model_validator(mode="after")
    def _cross_references_and_gate(self) -> "Figure":
        """Mechanically enforces every rule from Steps 5-10 that doesn't
        require the source passage text (bounds-checking spans against the
        passage happens in verify.py instead, which has that text)."""
        problems: list[str] = []
        node_ids = {n.id for n in self.nodes}
        axis_ids = {a.id for a in self.axes}

        if self.fit < 0.6 or self.need < 0.4:
            problems.append(
                f"figure below the fit/need gate (fit={self.fit}, need={self.need}) - "
                "should have been NO_FIGURE, not emitted"
            )

        for e in self.edges:
            if e.from_ not in node_ids:
                problems.append(f"edge from '{e.from_}': not a known node in this figure")
            if e.to not in node_ids:
                problems.append(f"edge to '{e.to}': not a known node in this figure")

        for q in self.quotes:
            if q.node not in node_ids:
                problems.append(f"quote references unknown node '{q.node}'")

        for n in self.nodes:
            for p in n.placement:
                if p.axis not in axis_ids:
                    problems.append(f"node {n.id}: placement references unknown axis '{p.axis}'")

        # Step 5's hub test, mechanically: a CONCEPT_MAP where more than half
        # of all edges touch one node is a mis-selected form, not a map.
        if self.form == "CONCEPT_MAP" and self.edges:
            degree: dict[str, int] = {}
            for e in self.edges:
                degree[e.from_] = degree.get(e.from_, 0) + 1
                degree[e.to] = degree.get(e.to, 0) + 1
            top = max(degree.values())
            if top > len(self.edges) / 2:
                problems.append(
                    f"CONCEPT_MAP fails the hub test: one node touches {top} of "
                    f"{len(self.edges)} edges (>half) - this should have been PROCESS or NO_FIGURE"
                )

        if problems:
            raise ValueError("; ".join(problems))
        return self


class LeftInText(BaseModel):
    """One span deliberately not drawn, and why (Step 8)."""

    model_config = ConfigDict(extra="forbid")

    spans: list[Span]
    reason: ResidueReason
    note: str | None = None


class GlossaryItem(BaseModel):
    """A plain-language gloss for one term of art."""

    model_config = ConfigDict(extra="forbid")

    term: str
    plain: str
    spans: list[Span] = []


class Meta(BaseModel):
    """Provenance and diagnostics for one explain call - an addition on top
    of PROMPT_SPEC.md's own schema for the operational bookkeeping
    (provider/model/latency/cache/warnings) this app still needs."""

    model_config = ConfigDict(extra="forbid")

    model: str
    provider: str
    latency_ms: int
    passage_hash: str
    cached: bool = False
    warnings: list[str] = []
    repair_attempted: bool = False


class ExplainResponse(BaseModel):
    """The full payload returned to the reader. `figures` may be empty - a
    valid, successful NO_FIGURE response, not an error."""

    model_config = ConfigDict(extra="forbid")

    passage_id: str
    domain: Domain
    segments: list[Segment] = []
    figures: list[Figure] = []
    left_in_text: list[LeftInText] = []
    glossary: list[GlossaryItem] = []
    meta: Meta
