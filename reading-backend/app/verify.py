"""
Deterministic span verification for ExplainResponse objects.

For every source_span/quote pair, this module confirms the quote actually
occurs in the passage at the claimed offsets, repairs the offsets when the
quote is found exactly once elsewhere, and otherwise degrades the element
(demoting emphasis, marking edges inferred, or dropping glossary terms)
rather than trusting an unverifiable span.
"""

from app.schema import ExplainResponse


def verify_span(passage: str, span, quote: str) -> tuple[str, tuple[int, int] | None]:
    '''
    Checks one span/quote pair against the passage and classifies the outcome
    Parameters:
        passage (str): The exact passage string the response was generated from
        span (tuple[int, int] | None): The claimed [start, end] character offsets
        quote (str | None): The exact substring the span is supposed to point to
    Returns:
        result (tuple[str, tuple[int, int] | None]): A status of "verified",
            "repaired", or "dropped", paired with the offsets to use (or None
            if dropped)
    '''
    if not quote:
        return "dropped", None
    if span is not None:
        start, end = span
        if 0 <= start <= end <= len(passage) and passage[start:end] == quote:
            return "verified", (start, end)
    first = passage.find(quote)
    if first != -1 and passage.find(quote, first + 1) == -1:
        return "repaired", (first, first + len(quote))
    return "dropped", None


def verify_response(passage: str, response: ExplainResponse) -> ExplainResponse:
    '''
    Runs span verification over every node, edge, and glossary term in a response
    Parameters:
        passage (str): The exact passage string the response was generated from
        response (ExplainResponse): The parsed, schema-valid response to verify
    Returns:
        response (ExplainResponse): The same response with spans corrected or
            degraded in place, and meta span counts updated
    '''
    verified = repaired = dropped = 0

    for node in response.nodes:
        status, new_span = verify_span(passage, node.source_span, node.quote)
        if status == "verified":
            verified += 1
            node.source_span = new_span
        elif status == "repaired":
            repaired += 1
            node.source_span = new_span
        else:
            dropped += 1
            node.source_span = None
            node.quote = None
            node.emphasis = 3

    for edge in response.edges:
        if edge.evidentiality != "stated":
            continue
        status, new_span = verify_span(passage, edge.source_span, edge.quote)
        if status == "verified":
            verified += 1
            edge.source_span = new_span
        elif status == "repaired":
            repaired += 1
            edge.source_span = new_span
        else:
            dropped += 1
            edge.evidentiality = "inferred"
            edge.source_span = None
            edge.quote = None

    kept_glossary = []
    for term in response.glossary:
        status, new_span = verify_span(passage, term.source_span, term.term)
        if status == "verified":
            verified += 1
            term.source_span = new_span
            kept_glossary.append(term)
        elif status == "repaired":
            repaired += 1
            term.source_span = new_span
            kept_glossary.append(term)
        else:
            dropped += 1
    response.glossary = kept_glossary

    response.meta.spans_verified = verified
    response.meta.spans_repaired = repaired
    response.meta.spans_dropped = dropped
    return response
