"""
Prompt constants for the LLM extraction call.
"""

SCHEMA_DESCRIPTION = """
{
  "passage_pattern": "comparison | causal_chain | definition_dispute | claim_evidence | taxonomy | process | narrative",
  "layout_hint": "comparison_table | flow | quadrant | hierarchy | timeline",
  "takeaway": "one sentence, max 25 words, plain language, no jargon",
  "explain_script": "2-3 sentences the reader could say out loud to a colleague",
  "nodes": [
    {
      "id": "short slug",
      "label": "as the passage names it, max 4 words",
      "plain_label": "same thing with no jargon, max 6 words",
      "kind": "theorist | concept | claim | evidence | method | object",
      "one_line": "max 18 words, plain language, what this is in this passage",
      "emphasis": "1 (central), 2 (supporting), or 3 (background) - at least one 1, not everything can be 1",
      "source_span": [start_char_offset, end_char_offset],
      "quote": "the exact substring of the passage at source_span"
    }
  ],
  "edges": [
    {
      "id": "short id",
      "source": "node id",
      "target": "node id",
      "relation": "supports | contradicts | refines | defines | causes | precedes | example_of | contrasts_with | applies_to",
      "label": "plain language, max 6 words, reads naturally as '<source> <label> <target>'",
      "evidentiality": "stated (passage says this in words) or inferred (you worked it out)",
      "source_span": [start_char_offset, end_char_offset] or null,
      "quote": "exact substring, required when evidentiality is stated, else null"
    }
  ],
  "glossary": [
    {
      "term": "the jargon term as it appears in the passage",
      "plain_definition": "max 15 words, no other jargon inside it",
      "in_this_passage": "max 20 words: what it means here specifically",
      "source_span": [start_char_offset, end_char_offset]
    }
  ],
  "simplifications": ["0-3 plain statements of what this diagram flattens or omits"]
}
""".strip()

SYSTEM_PROMPT = f"""
You map dense academic passages into a small, honest structure that a reader can
understand at a glance. You are not summarising and not simplifying the argument.

Rules:
- Work ONLY from the passage given. Never add a theorist, claim, or relation that is
  not in it. Background knowledge is not evidence.
- Every node and every "stated" edge must quote the exact substring it comes from.
  Copy the substring character for character.
- Character offsets in source_span are 0-indexed into the exact passage string you
  were given, counting every character including spaces and punctuation.
- Mark an edge "stated" only if the passage asserts that relation in words. If you
  worked it out yourself, mark it "inferred". Inferred edges are welcome and useful -
  mislabelled ones are not.
- Plain language means: a fluent English speaker outside this field understands it on
  first read. Replace nominalisation with verbs. No term may be explained using
  another term from the same field.
- Build a hierarchy. Exactly one or two nodes carry emphasis 1. If everything looks
  equally important, you have not understood the passage.
- Maximum 7 nodes. If the passage has more, merge or drop the peripheral ones and say
  so in `simplifications`.
- `takeaway` is one sentence a reader could repeat from memory.
- Name in `simplifications` anything the structure flattens: a hedge you turned into an
  arrow, a disagreement you compressed, a qualifier you dropped.

Return JSON only, matching this schema exactly: {SCHEMA_DESCRIPTION}
""".strip()

FEW_SHOT_PASSAGE = (
    "Giddens and Luhmann both treat trust as central to modernity, but they define "
    "it in incompatible ways. For Giddens, trust is confidence in the reliability of "
    "a person or system, given a background of risk that could not otherwise be "
    "managed. Luhmann, by contrast, frames trust as a mechanism for reducing social "
    "complexity: because a fully rational calculation of every possible future is "
    "impossible, trust lets an actor bracket that complexity and proceed as if only a "
    "few outcomes were relevant."
)

FEW_SHOT_RESPONSE = """
{
  "passage_pattern": "definition_dispute",
  "layout_hint": "comparison_table",
  "takeaway": "Giddens links trust to accepting risk, while Luhmann links it to ignoring complexity.",
  "explain_script": "Giddens and Luhmann both write about trust but mean different things. Giddens ties trust to the risk you accept when you can't know the outcome. Luhmann ties it to how you ignore most possible futures just to be able to act.",
  "nodes": [
    {
      "id": "giddens",
      "label": "Giddens",
      "plain_label": "Giddens",
      "kind": "theorist",
      "one_line": "Defines trust as confidence in reliability despite risk.",
      "emphasis": 1,
      "source_span": [0, 7],
      "quote": "Giddens"
    },
    {
      "id": "luhmann",
      "label": "Luhmann",
      "plain_label": "Luhmann",
      "kind": "theorist",
      "one_line": "Defines trust as a way of ignoring most possible futures.",
      "emphasis": 1,
      "source_span": [12, 19],
      "quote": "Luhmann"
    },
    {
      "id": "trust",
      "label": "trust",
      "plain_label": "trust",
      "kind": "concept",
      "one_line": "The shared concept both theorists are defining differently.",
      "emphasis": 2,
      "source_span": [37, 42],
      "quote": "trust"
    }
  ],
  "edges": [
    {
      "id": "e1",
      "source": "giddens",
      "target": "luhmann",
      "relation": "contrasts_with",
      "label": "defines trust differently than",
      "evidentiality": "stated",
      "source_span": [0, 84],
      "quote": "Giddens and Luhmann both treat trust as central to modernity, but they define"
    },
    {
      "id": "e2",
      "source": "giddens",
      "target": "trust",
      "relation": "defines",
      "label": "defines as accepted risk",
      "evidentiality": "inferred",
      "source_span": null,
      "quote": null
    }
  ],
  "glossary": [],
  "simplifications": [
    "Collapses a longer disagreement about modernity into a single contrast over trust."
  ]
}
""".strip()
