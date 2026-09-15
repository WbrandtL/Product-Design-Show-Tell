// Mirrors app/schema.py in gist-backend. Kept intentionally minimal - only
// the fields the extension actually renders - but field names and shapes must
// match the backend exactly, since responses are used as-is, unvalidated.

export type Basis = "stated" | "inferred";
export type Form = "spectrum" | "comparison" | "concept_map" | "process" | "axis";

export interface Span {
  quote: string;
  start: number;
  end: number;
}

export interface Node {
  id: string;
  label: string;
  kind: string;
  plain: string;
  detail: string | null;
  quote: string | null;
  icon: string | null;
  emphasis: 1 | 2 | 3;
  group_id: string | null;
  basis: Basis;
  source: Span | null;
}

export interface Group {
  id: string;
  label: string;
  blurb: string | null;
  accent: "a" | "b" | "c" | "d";
}

export interface Edge {
  id: string;
  source: string;
  target: string;
  relation: string;
  label: string;
  basis: Basis;
  evidence: Span | null;
}

export interface GlossaryItem {
  term: string;
  plain: string;
  in_context: string;
  source: Span | null;
}

export interface Dimension { id: string; label: string; }
export interface Cell { node_id: string; dimension_id: string; text: string; source: Span | null; }
export interface ComparisonLayout { dimensions: Dimension[]; cells: Cell[]; }

export interface SpectrumLayout { axis_label_low: string; axis_label_high: string; group_order: string[]; }

export interface ProcessLayout { order: string[]; }

export interface Axis { label: string; low_label: string; high_label: string; }
export interface Position { node_id: string; x: number; y: number; rationale: string; }
export interface EmptyRegion { quadrant: "tl" | "tr" | "bl" | "br"; note: string; }
export interface AxisLayout { x: Axis; y: Axis; positions: Position[]; empty_regions: EmptyRegion[]; }

export interface Cluster { label: string; node_ids: string[]; }
export interface ConceptMapLayout { clusters: Cluster[]; }

export type Layout = SpectrumLayout | ComparisonLayout | ProcessLayout | AxisLayout | ConceptMapLayout;

export interface Figure {
  id: string;
  question: string;
  form: Form;
  form_rationale: string;
  title: string;
  caption: string;
  provenance: "stated" | "arranged";
  node_ids: string[];
  edge_ids: string[];
  groups: Group[];
  layout: Layout;
  conclusion: string | null;
}

export interface Highlight { label: string; value: string; }

export interface Meta {
  model: string;
  provider: string;
  latency_ms: number;
  passage_hash: string;
  cached: boolean;
  warnings: string[];
  repair_attempted: boolean;
}

export interface ExplainResponse {
  id: string;
  headline: string;
  subhead: string;
  figures: Figure[];
  nodes: Node[];
  edges: Edge[];
  glossary: GlossaryItem[];
  at_a_glance: Highlight[];
  meta: Meta;
}

// One stored item in the on-device library (chrome.storage.local).
export interface StoredGraphic {
  id: string;
  createdAt: number;
  sourceUrl: string;
  sourceTitle: string;
  passage: string;
  response: ExplainResponse;
}
