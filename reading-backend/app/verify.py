"""Deterministic anti-hallucination pass. Runs after schema validation and
before a response is cached or returned.

This schema (PROMPT_SPEC.md) gives most spans as bare [start, end] offsets
with no accompanying verbatim text to check them against - unlike the one
place a real quote/offset pair exists (figures[].quotes[]), where the same
search-and-correct technique as before applies. Everywhere else, the honest
version of "verification" is bounds-checking: an offset pair outside the
passage's own length is definitely wrong and is dropped; anything else can't
be mechanically confirmed as non-hallucinated without a text to compare
against, which is a real, documented limit of this contract (see README).
"""

import re

from app.schema import ExplainResponse

_HYPHENS = "-‐‑‒"
_SINGLE_QUOTES = "'‘’"
_DOUBLE_QUOTES = '"“”'


def _flexible_pattern(quote: str) -> str:
    """
    Builds a regex matching `quote` against the passage while tolerating
    whitespace runs and common typographic punctuation substitutions (a
    model-written non-breaking hyphen standing in for the passage's plain one).
    Parameters:
        quote (str): The candidate verbatim quote from the model
    Returns:
        pattern (str): A regex source string to search the passage with
    """
    out: list[str] = []
    i, n = 0, len(quote)
    while i < n:
        ch = quote[i]
        if ch.isspace():
            j = i
            while j < n and quote[j].isspace():
                j += 1
            out.append(r"\s+")
            i = j
            continue
        if ch in _HYPHENS:
            out.append(f"[{re.escape(_HYPHENS)}]")
        elif ch in _SINGLE_QUOTES:
            out.append(f"[{re.escape(_SINGLE_QUOTES)}]")
        elif ch in _DOUBLE_QUOTES:
            out.append(f"[{re.escape(_DOUBLE_QUOTES)}]")
        else:
            out.append(re.escape(ch))
        i += 1
    return "".join(out)


def find_span(passage: str, quote: str) -> tuple[int, int] | None:
    """
    Locates a verbatim quote in the passage: an exact substring match first,
    then a match tolerant of whitespace runs and typographic punctuation
    substitutions.
    Parameters:
        passage (str): The original submitted passage
        quote (str): The candidate verbatim quote to locate
    Returns:
        span (tuple[int, int] | None): (start, end) character offsets into
            passage, or None if the quote cannot be found
    """
    if not quote:
        return None
    idx = passage.find(quote)
    if idx != -1:
        return idx, idx + len(quote)
    pattern = _flexible_pattern(quote)
    if not pattern:
        return None
    match = re.search(pattern, passage)
    if match:
        return match.span()
    return None


def _valid_spans(spans: list[tuple[int, int]], passage_len: int) -> list[tuple[int, int]]:
    """
    Filters a list of [start, end] offset pairs to ones that actually fall
    within the passage.
    Parameters:
        spans (list[tuple[int, int]]): candidate offset pairs
        passage_len (int): length of the passage they should index into
    Returns:
        valid (list[tuple[int, int]]): only the pairs with 0 <= start < end <= passage_len
    """
    return [(s, e) for (s, e) in spans if isinstance(s, int) and isinstance(e, int) and 0 <= s < e <= passage_len]


def verify_response(response: ExplainResponse, passage: str) -> list[str]:
    """
    Bounds-checks every span, verifies every quote against the passage
    verbatim (correcting its offsets or dropping it), and flags figures whose
    nodes carry no attribution/hedge variation at all. Mutates response in place.
    Parameters:
        response (ExplainResponse): The parsed, structurally-valid model output
        passage (str): The original submitted passage
    Returns:
        warnings (list[str]): One line per span dropped, quote dropped, or
            figure flagged
    """
    warnings: list[str] = []
    n = len(passage)

    for seg in response.segments:
        before = len(seg.spans)
        seg.spans = _valid_spans(seg.spans, n)
        if len(seg.spans) < before:
            warnings.append(f"segment '{seg.register}': dropped {before - len(seg.spans)} out-of-bounds span(s)")

    for item in response.left_in_text:
        before = len(item.spans)
        item.spans = _valid_spans(item.spans, n)
        if len(item.spans) < before:
            warnings.append(f"left_in_text '{item.reason}': dropped {before - len(item.spans)} out-of-bounds span(s)")

    for g in response.glossary:
        before = len(g.spans)
        g.spans = _valid_spans(g.spans, n)
        if len(g.spans) < before:
            warnings.append(f"glossary '{g.term}': dropped {before - len(g.spans)} out-of-bounds span(s)")

    for fig in response.figures:
        for node in fig.nodes:
            before = len(node.spans)
            node.spans = _valid_spans(node.spans, n)
            if len(node.spans) < before:
                warnings.append(f"node '{node.id}': dropped {before - len(node.spans)} out-of-bounds span(s)")

        for edge in fig.edges:
            before = len(edge.spans)
            edge.spans = _valid_spans(edge.spans, n)
            if len(edge.spans) < before:
                warnings.append(f"edge '{edge.from_}->{edge.to}': dropped {before - len(edge.spans)} out-of-bounds span(s)")

        # The one place a real quote/offset pair exists together - verified
        # the same way as the rest of this pipeline: search, correct, or drop.
        kept_quotes = []
        for q in fig.quotes:
            found = find_span(passage, q.text)
            if found is None:
                warnings.append(f"figure '{fig.form}': quote {q.text!r} not found in passage, dropped")
                continue
            q.spans = [found]
            kept_quotes.append(q)
        fig.quotes = kept_quotes

        # Step 7's uniformity guard, checked mechanically: if every node in a
        # figure shares one hedge and one attribution.named value, the model
        # was told to re-read for attribution before returning. The backend
        # can't re-read for it, but it can make sure this doesn't pass silently.
        if len(fig.nodes) > 1:
            hedges = {node.hedge for node in fig.nodes}
            named = {node.attribution.named for node in fig.nodes}
            if len(hedges) == 1 and len(named) == 1:
                warnings.append(
                    f"figure '{fig.form}' ({fig.question!r}): every node shares hedge="
                    f"'{next(iter(hedges))}' and attribution.named={next(iter(named))} - "
                    "worth double-checking this isn't under-attributed"
                )

    return warnings
