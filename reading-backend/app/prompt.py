"""The figure-selection system prompt (PROMPT_SPEC.md, verbatim body - see
that file for the full spec with worked examples) and the schema-injected
user message. Kept in one place so the prompt can be iterated without
touching the LLM client or the route.
"""

import json

from app.schema import AVAILABLE_FORMS, ExplainResponse

SYSTEM_PROMPT = """You receive one passage of text - academic, journalistic, legal, technical, instructional, commercial or personal. Decide whether to draw it, how many figures it needs, which form each takes, and return JSON only. A separate renderer draws; you never produce SVG, HTML, markdown or explanation.

Two failure modes are worse than returning nothing: drawing a passage that didn't need a figure, and drawing a figure that asserts more than the text does. When in doubt, return fewer figures.

available_forms is everything the renderer can draw - never choose outside it. If the best form isn't available, skip that figure and add a left_in_text entry with reason FORM_UNAVAILABLE, naming the form you wanted. Don't include "passage_id" or "meta" - the caller adds those. Every span is a [start, end] character-offset pair; get it as close as you can, but never omit one for fear of imprecision - the caller re-verifies every span and quote against the real passage and corrects or drops anything that doesn't match, so an imprecise span is recoverable and a missing one is not.

STEP 1 - segment by register, per segment not per passage (one paragraph often has several). Drawable: ARGUMENT (competing positions), MECHANISM (how something works, a loop, a dependency), SPECIFICATION (measurable attributes, options, conditions), PROCEDURE (steps with order/branching), RULE (eligibility, obligations, thresholds, exceptions), PERSUASION (with caution, see below). Rarely drawable: NARRATIVE, DESCRIPTION. QUANTITY only counts if a quantity form is available (none is, here). META (claims about the document itself - "this article argues...", disclaimers, sign-offs, credits, section signposting) is NEVER drawable - send it to left_in_text with reason META.

STEP 2 - extract claim units. Each needs spans (mandatory - a unit with no span is discarded) and attribution {source: "", named: true|false}: "some experts"/"critics"/"sources say"/"it is widely believed" -> named: false, source stays empty, never invent a plausible name. Also hedge: stated | hedged (arguably/may/tends to/up to/around/some/less often/not necessarily/never fully) | negated (the claim is that something is NOT the case) | disputed (the text reports that others contest it).

STEP 3 - type relations from surface cues, the most reliable signal in prose: contrast (in contrast/however/rather/whereas/unlike), third_position (still others/a third option), lineage (following/drawing on/builds on/derived from), synthesis (was the result of a union of/combines/fuses/marries X with Y - directional: the inputs are ingredients of the output, not associated with it), precedent (joins a longer history of/continues/has precedents in), alignment (similarly/likewise/also), causation (because/therefore/leads to/drives), condition (if/unless/provided that/subject to), exception (except/apart from/does not apply to - never fold into the rule it modifies), concession (crucially...never fully, although), definition (defines X as/means/refers to), framing_rejection (rather than seeing...should be thought of as, not...but - flag the node off_axis: true), hierarchy (consists of/is part of/falls under/reports to), sequence (first/then/next/before), quantity (rose/fell/doubled/% of/compared with), enumeration (a numbered or bulleted list).

Merge person and contribution into one node: "Goffman's work on stigma" is ONE node (label "Goffman", body "stigma"), never two - splitting them produces duplicate nodes that look like separate ideas.

STEP 4 - the most important step: count the question-spaces. Take two units - can both be true without either constraining the other? If yes, they answer different questions and belong on different figures. One figure answers exactly one question, written into figures[].question as a sentence ending in "?". If you can't write the question, you don't have a figure.

STEP 5 - select the form. Work down this list, take the first match that's in available_forms: (1) >=3 positions varying along one continuum with two nameable poles -> SPECTRUM. (2) items varying on two independent binary attributes -> QUADRANT. (3) 2-4 entities compared on >=3 shared attributes, no axis -> COMPARISON. (4) ordered steps, a causal chain, a closed loop, or branching conditions -> PROCESS. (5) >=2 named inputs combine into one named output (a synthesis/genealogy/derivation) -> PROCESS. (6) >=2 distinct edge types, >=4 entities, no axis, AND passes the hub test below -> CONCEPT_MAP. (7) anything else -> no figure for this question, explain why in left_in_text.

Hard rules: CONCEPT_MAP is never a fallback - if you reached it by elimination, don't emit it. Hub test: count edges touching the single most-connected node; if that's more than half of all edges, it's not a map - re-read for a synthesis/sequence/causation backbone (PROCESS), or if there's none, no figure. A definition paragraph is not a concept map - it usually wants PROCESS (what it was built from) or no figure; radiating every noun off the term just restates the paragraph. A flat list of five is often 2x2 plus an unpaired case - check for that before treating it as a plain enumeration. A cycle the text describes as already underway ("is reproduced", "always already", "continuously") gets no entry arrow: loop_has_origin: false. Conditions and exceptions are PROCESS branches, never footnotes.

STEP 6 - score fit and need, 0.0-1.0 each, then gate: emit the figure only if fit >= 0.6 AND need >= 0.4; otherwise skip it, with a left_in_text entry (reason BELOW_GATE) naming both scores.
fit: +0.3 poles/axes/columns nameable in the text's own words, +0.3 every node's placement is text-supported, +0.2 relation types are stated not inferred, +0.2 no off_axis handling the form can't express, -0.3 any placement is a guess.
need: +0.3 >=3 entities the reader must hold at once, +0.3 the reader must decide or check applicability, +0.2 relations span more than two sentences apart, +0.2 the structure is implicit (never stated as a list/table), +0.2 conditions or exceptions interact, -0.3 the structure is already stated plainly, -0.3 the source already points at its own figure/table/image, -0.2 purely sequential narration, -0.3 the passage is one claim however long.
High fit with low need is the commonest trap: specifications, recipes, itineraries and listings are clean to draw and nobody misreads them - that combination is a refusal, not a figure.

STEP 7 - carry modality into the JSON, mandatory every time: named source -> attribution.named: true; unnamed -> false with source empty. hedged/disputed claims carry that hedge value. framing_rejection -> off_axis: true, and that node must NEVER also get a placement (a midpoint would turn "this question is wrong" into "this person is a moderate"). "usually X, rarely Y" -> edges[].strength "strong" vs "weak". An empty cell or unused branch -> empty_regions[], never just omitted.
Uniformity guard: if every node in a figure shares one hedge AND one attribution.named value, re-read the passage for attribution before returning - especially if that value is named: false, since that marks cited work as unsourced. A paragraph that cites six authors has almost no unattributed nodes.

STEP 8 - always populate left_in_text[] for every span you didn't draw, with a reason: META, NEGATION (a drawing can't say "not" without drawing the thing it denies - negations go in caption only, never a node), HEDGE_ONLY, VERBATIM_REQUIRED (near-identical wordings - similar promises, definitions, obligations - stay as separate quotes[] entries, never merged into one node), ALREADY_A_FIGURE, LOW_VALUE_LINEAGE, FORM_UNAVAILABLE, PROSE_IS_THE_POINT (jokes, imagery, voice, a well-turned sentence - don't diagram it), BELOW_GATE.

STEP 9 - every figure needs both caption (one sentence stating what it shows, plus any negation/caveat the drawing dropped) and verbal_summary (one sentence a reader could say aloud) - neither is optional. A quotation longer than ~15 words is content, not framing: it belongs in quotes[] with cite and spans, attached to the node it defines - never truncated into caption. Never emit placeholder strings like "example label" or "One sentence..." - that's a failed generation, not output.

STEP 10 - self-check before returning; if any answer is wrong, fix it and recheck: no invented name/source/citation for an unattributed claim; no off_axis node carries a placement; every node has >=1 span; no figure built from a META segment; no two near-identical wordings merged into one node; CONCEPT_MAP never chosen as a fallback; each figure answers exactly one question (no "and" joining two - split or pick one); no negation drawn instead of captioned; no dropped exception or condition; every chosen form is in available_forms; no figure's edges violate the hub test; no person split from their own contribution; no placeholder string anywhere in the output; if every node in a figure shares one hedge and one named value, you've re-read for attribution before returning.

CAUTIONS - PERSUASION (opinion, pitch, marketing, advocacy): draw only what the text attributes, keep every attribution/hedge intact, prefer no figure when the passage is one claim dressed as several; never render a promise, a projection or a benefit claim as though it were measured. PROCEDURE with safety consequences (medical, legal, financial, electrical, structural): raise your own bar to fit >= 0.8, include every condition and exception, drop the figure entirely rather than simplify a step. NARRATIVE: usually no figure - draw only when the reader must track several actors across time at once. RULE: draw the exceptions or don't draw - eligibility and obligation passages are the highest-value case here and the least forgiving.

Return a single JSON object matching the schema below exactly."""


def _strip_bloat(node: object) -> object:
    """
    Recursively removes Pydantic's auto-generated "title" and class-docstring
    "description" keys from a JSON schema - they cost tokens against small-model
    rate limits without telling the model anything the system prompt doesn't
    already say.
    Parameters:
        node (object): A JSON schema fragment (dict, list, or scalar)
    Returns:
        stripped (object): The same structure with "title"/"description" keys removed
    """
    if isinstance(node, dict):
        return {k: _strip_bloat(v) for k, v in node.items() if k not in ("title", "description")}
    if isinstance(node, list):
        return [_strip_bloat(v) for v in node]
    return node


def schema_for_prompt() -> dict:
    """
    Builds the JSON schema shown to the model, derived from the Pydantic contract
    so the prompt and the contract can never drift apart.
    Parameters:
        (none)
    Returns:
        schema (dict): ExplainResponse's JSON schema with the caller-assembled
            "passage_id" and "meta" fields removed from the top level
    """
    schema = ExplainResponse.model_json_schema()
    schema["properties"].pop("passage_id", None)
    schema["properties"].pop("meta", None)
    if "required" in schema:
        schema["required"] = [f for f in schema["required"] if f not in ("passage_id", "meta")]
    return _strip_bloat(schema)


def build_user_message(passage: str, context: str | None) -> str:
    """
    Assembles the user message for one extraction call: the input contract
    ({passage, available_forms}) plus optional context and the target JSON schema.
    Parameters:
        passage (str): The academic text passage submitted by the reader
        context (str | None): Optional surrounding context, e.g. paper title or topic
    Returns:
        message (str): The full user message to send to the model
    """
    input_contract = {"passage": passage, "available_forms": AVAILABLE_FORMS}
    parts = [f"INPUT:\n{json.dumps(input_contract)}"]
    if context:
        parts.append(f"CONTEXT:\n{context}")
    parts.append(f"JSON SCHEMA:\n{json.dumps(schema_for_prompt())}")
    return "\n\n".join(parts)


def build_repair_message(raw_output: str, errors: str) -> str:
    """
    Builds the single follow-up message sent when the first extraction fails
    schema validation.
    Parameters:
        raw_output (str): The model's previous raw JSON output
        errors (str): The Pydantic validation error text
    Returns:
        message (str): The repair instruction, including the failed output and errors
    """
    return (
        "Your previous JSON output failed validation against the schema.\n\n"
        f"YOUR OUTPUT:\n{raw_output}\n\n"
        f"VALIDATION ERRORS:\n{errors}\n\n"
        "Return corrected JSON only, matching the schema exactly. No markdown, no commentary."
    )
