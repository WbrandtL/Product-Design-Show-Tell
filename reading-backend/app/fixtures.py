"""Hand-written mock payloads matching PROMPT_SPEC.md's output contract, one
per form plus a NO_FIGURE example. Used by the mock LLM provider so the
schema, verify.py and the renderers are all exercisable with zero network calls.

Every span below is computed from the real source text via `_span()`, never
hand-typed as raw integers - this schema has no way to auto-correct a node or
edge span the way it does for quotes[] (see verify.py's docstring on why),
so a wrong-but-in-bounds hand-typed offset here would silently point at the
wrong words forever. Fixtures get the same rigor real output gets.
"""

from pathlib import Path
from typing import Any

_SAMPLES_DIR = Path(__file__).resolve().parent.parent / "samples"
AGENCY = (_SAMPLES_DIR / "agency.txt").read_text(encoding="utf-8").strip()
PERMAFROST = (_SAMPLES_DIR / "permafrost_feedback.txt").read_text(encoding="utf-8").strip()
TRUST = (_SAMPLES_DIR / "trust_definitions.txt").read_text(encoding="utf-8").strip()

PRINTING_PRESS = (
    "The printing press did not cause the Reformation by itself, but it made it possible at the "
    "scale it reached. Cheap printed pamphlets drove a rapid rise in lay literacy across German "
    "towns in the early sixteenth century, and that newly literate public was what let Luther's "
    "challenge to the Church spread far beyond the university towns where such debates had "
    "previously stayed contained. The same presses that spread the Reformation also normalised "
    "vernacular printing more broadly, since a market already existed for cheap books in local "
    "languages rather than Latin. Historians have argued that this vernacular reading public, "
    "assembled originally for religious pamphlets, is one of the deep preconditions for the sense "
    "of national language communities that nationalism would later draw on."
)


def _span(text: str, quote: str) -> list[list[int]]:
    """
    Locates a verbatim substring in a text and returns its real offsets - the
    same way a real model's span should be checkable, so fixtures never carry
    a hand-typed offset that silently points at the wrong words.
    Parameters:
        text (str): The source text the span indexes into
        quote (str): The exact substring to locate
    Returns:
        spans (list[list[int]]): [[start, end]] for the first occurrence
    Raises:
        ValueError: if the quote is not a verbatim substring of text
    """
    idx = text.find(quote)
    if idx == -1:
        raise ValueError(f"fixture quote not found verbatim in source text: {quote!r}")
    return [[idx, idx + len(quote)]]


# ---------------------------------------------------------------------------
# 1. NO_FIGURE - the passage's structure is already stated plainly
# ---------------------------------------------------------------------------

NO_FIGURE_TEXT = (
    "To reset your password: open Settings, choose Account, then Security. Tap Change Password. "
    "Enter your current password, then your new one twice. Passwords must be at least eight "
    "characters. Tap Save. You'll be signed out of other devices automatically."
)

NO_FIGURE_FIXTURE: dict[str, Any] = {
    "domain": "instructional",
    "segments": [{"spans": _span(NO_FIGURE_TEXT, NO_FIGURE_TEXT), "register": "PROCEDURE"}],
    "figures": [],
    "left_in_text": [
        {
            "spans": _span(NO_FIGURE_TEXT, NO_FIGURE_TEXT),
            "reason": "BELOW_GATE",
            "note": "fit 0.9, need 0.2 - the passage already states its steps as a plain numbered sequence; a process diagram would add nothing a reader doesn't already have.",
        }
    ],
    "glossary": [],
}

# ---------------------------------------------------------------------------
# 2. SPECTRUM - agency.txt, figure 1 (structure <-> agency continuum)
# ---------------------------------------------------------------------------

SPECTRUM_FIXTURE: dict[str, Any] = {
    "domain": "academic",
    "segments": [
        {
            "spans": _span(AGENCY, "Structuralist theorists argue that structures not only determine, but serve to restrict and oppress"),
            "register": "ARGUMENT",
        },
        {
            "spans": _span(AGENCY, "The questions at the heart of this special issue reflect these tensions between structure and agency"),
            "register": "META",
        },
    ],
    "figures": [
        {
            "form": "SPECTRUM",
            "question": "Where does each author locate agency in relation to structure?",
            "fit": 0.85,
            "need": 0.7,
            "axes": [{"id": "x", "left_pole": "Structure determines action", "right_pole": "Agents shape their worlds"}],
            "nodes": [
                {
                    "id": "n_marx", "label": "Marx (1852)",
                    "body": "Says people make history, but not under conditions they chose for themselves.",
                    "attribution": {"source": "Marx", "named": True}, "hedge": "stated", "off_axis": False,
                    "placement": [{"axis": "x", "position": 0.05}],
                    "spans": _span(AGENCY, "people are able to make history, or act with agency, but that they do so in conditions not of their own making"),
                },
                {
                    "id": "n_giddens", "label": "Giddens (1984)",
                    "body": "Says structures shape and constrain agency, but agents also act against as well as within them.",
                    "attribution": {"source": "Giddens", "named": True}, "hedge": "stated", "off_axis": False,
                    "placement": [{"axis": "x", "position": 0.5}],
                    "spans": _span(AGENCY, "structures shape and constrain human agency, but human agents act against, as well as within, them"),
                },
                {
                    "id": "n_layder", "label": "Layder (2006)",
                    "body": "Sees structure and agency as inseparable, mutually influential aspects of one social life.",
                    "attribution": {"source": "Layder", "named": True}, "hedge": "stated", "off_axis": False,
                    "placement": [{"axis": "x", "position": 0.55}],
                    "spans": _span(AGENCY, "different aspects of social life which are inextricably interrelated"),
                },
                {
                    "id": "n_others", "label": "Agent-centred theorists",
                    "body": "Unnamed authors said to stress individuals' capacity to make and shape their own worlds.",
                    "attribution": {"source": "", "named": False}, "hedge": "stated", "off_axis": False,
                    "placement": [{"axis": "x", "position": 0.9}],
                    "spans": _span(AGENCY, "the capacity of individual human agents to make and shape their worlds"),
                },
            ],
            "edges": [
                {
                    "from": "n_layder", "to": "n_giddens", "type": "lineage", "label": "follows Giddens's definition",
                    "strength": "normal", "spans": _span(AGENCY, "Following Giddens, he understands agency as"),
                },
                {
                    "from": "n_marx", "to": "n_others", "type": "contrast", "label": "opposite emphasis on agency",
                    "strength": "normal", "spans": _span(AGENCY, "In contrast, others have stressed"),
                },
            ],
            "empty_regions": [],
            "quotes": [
                {
                    "node": "n_marx",
                    "text": "people are able to make history, or act with agency, but that they do so in conditions not of their own making",
                    "cite": "Marx, 1852",
                    "spans": _span(AGENCY, "people are able to make history, or act with agency, but that they do so in conditions not of their own making"),
                }
            ],
            "loop_has_origin": None,
            "caption": "Theorists here differ on how much room structures leave for individual action, from Marx's structural constraint to an unnamed agent-centred camp - a grouping this tool arranged, not one the passage states as a taxonomy.",
            "verbal_summary": "Everyone here agrees structures limit people, but they disagree about how much room that leaves for real choice.",
        }
    ],
    "left_in_text": [
        {
            "spans": _span(AGENCY, "The questions at the heart of this special issue reflect these tensions between structure and agency"),
            "reason": "META",
            "note": "A claim about the special issue's own aims, not about agency itself.",
        }
    ],
    "glossary": [
        {
            "term": "agency", "plain": "The capacity of a person to act and make choices, rather than just being shaped by outside forces.",
            "spans": _span(AGENCY, "the capacity of individual human agents to make and shape their worlds"),
        },
        {
            "term": "structuralism", "plain": "The view that social structures are the main force determining what happens.",
            "spans": _span(AGENCY, "Structuralist theorists argue that structures not only determine, but serve to restrict and oppress"),
        },
        {
            "term": "dialectic", "plain": "A relationship where two things continuously shape and push against each other.",
            "spans": _span(AGENCY, "highlighted the dialectic relationship between structure and agency"),
        },
    ],
}

# ---------------------------------------------------------------------------
# 3. QUADRANT - agency.txt, figure 2 (human/technical x reflexive/habitual)
# ---------------------------------------------------------------------------

QUADRANT_FIXTURE: dict[str, Any] = {
    "domain": "academic",
    "segments": [
        {"spans": _span(AGENCY, "For some writers, agency is necessarily a reflexive practice"), "register": "ARGUMENT"},
    ],
    "figures": [
        {
            "form": "QUADRANT",
            "question": "What counts as an act of agency?",
            "fit": 0.8,
            "need": 0.6,
            "axes": [
                {"id": "x", "left_pole": "Human", "right_pole": "Technical"},
                {"id": "y", "left_pole": "Habitual", "right_pole": "Reflexive"},
            ],
            "nodes": [
                {
                    "id": "n_couldry", "label": "Couldry (2014)",
                    "body": "Defines agency as reflective action - making sense of the world in order to act within it.",
                    "attribution": {"source": "Couldry", "named": True}, "hedge": "stated", "off_axis": False,
                    "placement": [{"axis": "x", "position": 0.15}, {"axis": "y", "position": 0.85}],
                    "spans": _span(AGENCY, "the longer processes of action based on reflection"),
                },
                {
                    "id": "n_bourdieu", "label": "Bourdieu (1980)",
                    "body": "Sees agency as exercised habitually, without conscious thought.",
                    "attribution": {"source": "Bourdieu", "named": True}, "hedge": "stated", "off_axis": False,
                    "placement": [{"axis": "x", "position": 0.15}, {"axis": "y", "position": 0.15}],
                    "spans": _span(AGENCY, "exercised habitually, without thinking"),
                },
                {
                    "id": "n_lash", "label": "Lash (2007)",
                    "body": "Cited for locating agency in hardware and software rather than in people.",
                    "attribution": {"source": "Lash", "named": True}, "hedge": "stated", "off_axis": False,
                    "placement": [{"axis": "x", "position": 0.85}, {"axis": "y", "position": 0.2}],
                    "spans": _span(AGENCY, "locate agency in hardware and software channelling data streams"),
                },
            ],
            "edges": [
                {
                    "from": "n_bourdieu", "to": "n_couldry", "type": "contrast", "label": "rejects reflexive framing",
                    "strength": "normal", "spans": _span(AGENCY, "agency is much less reflexive"),
                },
            ],
            "empty_regions": [
                {
                    "cell": "tr",
                    "finding": "No technical actor here is described as exercising reflexive agency - every technical-actor account treats agency as habitual.",
                }
            ],
            "quotes": [],
            "loop_has_origin": None,
            "caption": "The passage draws two distinctions at once - human vs. technical actors, and reflexive vs. habitual agency - and no technical actor here gets a reflexive account.",
            "verbal_summary": "Reflexive agency, in this passage, is something only people get credit for.",
        }
    ],
    "left_in_text": [],
    "glossary": [
        {
            "term": "reflexive", "plain": "Involving conscious thought and self-awareness about what one is doing and why.",
            "spans": _span(AGENCY, "agency is necessarily a reflexive practice"),
        },
    ],
}

# ---------------------------------------------------------------------------
# 4. COMPARISON - three theories of trust, no shared axis
# ---------------------------------------------------------------------------

COMPARISON_FIXTURE: dict[str, Any] = {
    "domain": "academic",
    "segments": [
        {"spans": _span(TRUST, "For Niklas Luhmann (1979), trust is fundamentally a mechanism for reducing social complexity"), "register": "ARGUMENT"},
    ],
    "figures": [
        {
            "form": "COMPARISON",
            "question": "How do three theorists differently locate what trust actually is?",
            "fit": 0.8,
            "need": 0.6,
            "axes": [],
            "nodes": [
                {
                    "id": "n_luhmann", "label": "Luhmann (1979)",
                    "body": "Trust as a mechanism that reduces overwhelming complexity to a few manageable futures.",
                    "attribution": {"source": "Luhmann", "named": True}, "hedge": "stated", "off_axis": False,
                    "placement": [],
                    "spans": _span(TRUST, "trust is fundamentally a mechanism for reducing social complexity"),
                },
                {
                    "id": "n_giddens_t", "label": "Giddens (1990)",
                    "body": "Trust as confidence in reliability that brushes aside risk, increasingly aimed at expert systems.",
                    "attribution": {"source": "Giddens", "named": True}, "hedge": "stated", "off_axis": False,
                    "placement": [],
                    "spans": _span(TRUST, "confidence in the reliability of a person or system in the face of contingent outcomes"),
                },
                {
                    "id": "n_gambetta", "label": "Gambetta (1988)",
                    "body": "Trust as a subjective probability estimate that another agent will act well.",
                    "attribution": {"source": "Gambetta", "named": True}, "hedge": "stated", "off_axis": False,
                    "placement": [],
                    "spans": _span(TRUST, "trust as a subjective probability estimate"),
                },
            ],
            "edges": [
                {
                    "from": "n_luhmann", "to": "n_giddens_t", "type": "contrast", "label": "different mechanism",
                    "strength": "normal", "spans": [],
                },
                {
                    "from": "n_giddens_t", "to": "n_gambetta", "type": "contrast", "label": "different mechanism",
                    "strength": "normal", "spans": [],
                },
            ],
            "empty_regions": [],
            "quotes": [],
            "loop_has_origin": None,
            "caption": "Three theorists use 'trust' for three different mental operations, with no single continuum ordering them.",
            "verbal_summary": "Trust means calculation to one theorist, confidence to another, and complexity-avoidance to a third.",
        }
    ],
    "left_in_text": [],
    "glossary": [],
}

# ---------------------------------------------------------------------------
# 5. PROCESS - the permafrost carbon feedback loop
# ---------------------------------------------------------------------------

PROCESS_FIXTURE: dict[str, Any] = {
    "domain": "academic",
    "segments": [
        {"spans": _span(PERMAFROST, "The permafrost carbon feedback describes a mechanism by which climate warming accelerates itself"), "register": "MECHANISM"},
    ],
    "figures": [
        {
            "form": "PROCESS",
            "question": "What mechanism keeps permafrost thaw accelerating itself?",
            "fit": 0.85,
            "need": 0.65,
            "axes": [],
            "nodes": [
                {
                    "id": "n_warm_air", "label": "Air warms",
                    "body": "Rising Arctic air temperatures begin warming the uppermost layer of frozen soil.",
                    "attribution": {"source": "", "named": False}, "hedge": "stated", "off_axis": False,
                    "placement": [], "spans": _span(PERMAFROST, "rising Arctic air temperatures warm the uppermost layers of permafrost soil"),
                },
                {
                    "id": "n_thaw", "label": "Permafrost thaws",
                    "body": "Ground that has stayed frozen for millennia thaws for the first time.",
                    "attribution": {"source": "", "named": False}, "hedge": "stated", "off_axis": False,
                    "placement": [], "spans": _span(PERMAFROST, "causing previously frozen ground to thaw for the first time in millennia"),
                },
                {
                    "id": "n_decompose", "label": "Microbes decompose carbon",
                    "body": "Soil microbes metabolise newly-exposed organic carbon that was previously locked in ice.",
                    "attribution": {"source": "", "named": False}, "hedge": "stated", "off_axis": False,
                    "placement": [], "spans": _span(PERMAFROST, "this organic matter becomes available to soil microbes, which metabolise it"),
                },
                {
                    "id": "n_release", "label": "Greenhouse gases released",
                    "body": "Decomposition releases carbon dioxide, and methane where the soil is waterlogged.",
                    "attribution": {"source": "", "named": False}, "hedge": "stated", "off_axis": False,
                    "placement": [], "spans": _span(PERMAFROST, "release carbon dioxide and methane as by-products"),
                },
            ],
            "edges": [
                {"from": "n_warm_air", "to": "n_thaw", "type": "causation", "label": "warms frozen soil", "strength": "normal", "spans": []},
                {"from": "n_thaw", "to": "n_decompose", "type": "causation", "label": "exposes organic carbon", "strength": "normal", "spans": []},
                {"from": "n_decompose", "to": "n_release", "type": "causation", "label": "produces greenhouse gases", "strength": "normal", "spans": []},
                {"from": "n_release", "to": "n_warm_air", "type": "causation", "label": "drives further thaw next season", "strength": "normal", "spans": []},
            ],
            "empty_regions": [],
            "quotes": [],
            "loop_has_origin": False,
            "caption": "Warming thaws soil, thawed soil feeds microbes, microbes release greenhouse gases, and those gases drive further warming - a loop the passage describes as already running, not as something with a single starting point.",
            "verbal_summary": "Once triggered, this loop keeps running on its own, even if human emissions stop.",
        }
    ],
    "left_in_text": [],
    "glossary": [
        {"term": "feedback loop", "plain": "A process where the output of a mechanism becomes an input that strengthens the same mechanism.", "spans": []},
    ],
}

# ---------------------------------------------------------------------------
# 6. CONCEPT_MAP - the printing press and the Reformation (passes the hub test:
#    max node degree is 2 of 4 edges, exactly half, not a majority)
# ---------------------------------------------------------------------------

CONCEPT_MAP_FIXTURE: dict[str, Any] = {
    "domain": "academic",
    "segments": [
        {"spans": _span(PRINTING_PRESS, PRINTING_PRESS), "register": "MECHANISM"},
    ],
    "figures": [
        {
            "form": "CONCEPT_MAP",
            "question": "How did the printing press, literacy, the Reformation and nationalism connect?",
            "fit": 0.65,
            "need": 0.55,
            "axes": [],
            "nodes": [
                {
                    "id": "n_press", "label": "Printing press",
                    "body": "Made cheap pamphlets possible at a scale that let ideas spread past university towns.",
                    "attribution": {"source": "", "named": False}, "hedge": "stated", "off_axis": False,
                    "placement": [], "spans": _span(PRINTING_PRESS, "The printing press did not cause the Reformation by itself, but it made it possible at the scale it reached"),
                },
                {
                    "id": "n_literacy", "label": "Rising lay literacy",
                    "body": "Cheap printed pamphlets drove a rapid rise in literacy among ordinary people.",
                    "attribution": {"source": "", "named": False}, "hedge": "stated", "off_axis": False,
                    "placement": [], "spans": _span(PRINTING_PRESS, "Cheap printed pamphlets drove a rapid rise in lay literacy across German towns"),
                },
                {
                    "id": "n_reformation", "label": "The Reformation",
                    "body": "Luther's challenge to the Church spread far beyond where such debates had previously stayed contained.",
                    "attribution": {"source": "", "named": False}, "hedge": "stated", "off_axis": False,
                    "placement": [], "spans": _span(PRINTING_PRESS, "that newly literate public was what let Luther's challenge to the Church spread far beyond the university towns"),
                },
                {
                    "id": "n_nationalism", "label": "Early nationalism",
                    "body": "A vernacular reading public assembled for religious pamphlets became a precondition for national-language communities.",
                    "attribution": {"source": "Historians", "named": False}, "hedge": "hedged", "off_axis": False,
                    "placement": [], "spans": _span(PRINTING_PRESS, "one of the deep preconditions for the sense of national language communities that nationalism would later draw on"),
                },
            ],
            "edges": [
                {"from": "n_press", "to": "n_literacy", "type": "causation", "label": "drives", "strength": "strong", "spans": []},
                {"from": "n_literacy", "to": "n_reformation", "type": "causation", "label": "enables spread of", "strength": "strong", "spans": []},
                {"from": "n_reformation", "to": "n_nationalism", "type": "precedent", "label": "assembles a public that becomes", "strength": "weak", "spans": []},
                {"from": "n_press", "to": "n_nationalism", "type": "precedent", "label": "normalises vernacular printing for", "strength": "weak", "spans": []},
            ],
            "empty_regions": [],
            "quotes": [],
            "loop_has_origin": None,
            "caption": "The press's effect on literacy fed the Reformation directly, and also fed a separate, slower-burning vernacular-reading public that nationalism later drew on - two distinct downstream effects of the same cause, not one chain.",
            "verbal_summary": "The printing press didn't just cause the Reformation - it built a reading public that outlasted it.",
        }
    ],
    "left_in_text": [],
    "glossary": [
        {"term": "vernacular", "plain": "The everyday language people actually speak, as opposed to a formal language like Latin.", "spans": []},
    ],
}

FORM_FIXTURES: dict[str, dict[str, Any]] = {
    "spectrum": SPECTRUM_FIXTURE,
    "quadrant": QUADRANT_FIXTURE,
    "comparison": COMPARISON_FIXTURE,
    "process": PROCESS_FIXTURE,
    "concept_map": CONCEPT_MAP_FIXTURE,
    "no_figure": NO_FIGURE_FIXTURE,
}

# The two-figure Appendix A response (spectrum + quadrant together) - kept as
# its own named fixture since it's the flagship demo the brief is tuned against.
AGENCY_FIXTURE: dict[str, Any] = {
    "domain": "academic",
    "segments": SPECTRUM_FIXTURE["segments"] + QUADRANT_FIXTURE["segments"],
    "figures": [SPECTRUM_FIXTURE["figures"][0], QUADRANT_FIXTURE["figures"][0]],
    "left_in_text": SPECTRUM_FIXTURE["left_in_text"],
    "glossary": SPECTRUM_FIXTURE["glossary"] + QUADRANT_FIXTURE["glossary"],
}
