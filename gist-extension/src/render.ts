import type {
  ExplainResponse, Figure, Node, Edge, GlossaryItem,
  SpectrumLayout, ComparisonLayout, ProcessLayout, AxisLayout, ConceptMapLayout,
} from "./types";

const ACCENT: Record<string, string> = { a: "var(--rg-accent-a)", b: "var(--rg-accent-b)", c: "var(--rg-accent-c)", d: "var(--rg-accent-d)" };

const ICONS: Record<string, string> = {
  person: '<circle cx="12" cy="8" r="3.2"/><path d="M5.5 20c0-4 3-6.5 6.5-6.5s6.5 2.5 6.5 6.5"/>',
  group: '<circle cx="9" cy="8.5" r="3"/><circle cx="16" cy="9.5" r="2.4"/><path d="M3.5 20c0-3.6 2.5-6 5.5-6s5.5 2.4 5.5 6"/><path d="M14.5 14.3c2.6 .3 4.5 2.4 4.5 5.7"/>',
  building: '<rect x="5" y="4" width="14" height="16" rx="1"/><path d="M8.5 8h1.2M14.3 8h1.2M8.5 12h1.2M14.3 12h1.2M8.5 16h1.2M14.3 16h1.2"/>',
  cycle: '<path d="M5 12a7 7 0 0 1 12-4.9M19 12a7 7 0 0 1-12 4.9"/><path d="M17.5 4.5v3h-3M6.5 19.5v-3h3"/>',
  lock: '<rect x="5.5" y="10.5" width="13" height="9" rx="1.4"/><path d="M8.3 10.5V7.8a3.7 3.7 0 0 1 7.4 0v2.7"/>',
  eye: '<path d="M3 12s3.5-6 9-6 9 6 9 6-3.5 6-9 6-9-6-9-6Z"/><circle cx="12" cy="12" r="2.4"/>',
  network: '<circle cx="6" cy="7" r="2"/><circle cx="18" cy="7" r="2"/><circle cx="12" cy="18" r="2"/><path d="M7.7 8.2 10.5 16M16.3 8.2 13.5 16M8 7h8"/>',
  brain: '<path d="M9 4.8c-2.4 0-3.6 1.8-3.4 3.4C4 8.8 3.6 11 5 12.2c-1 1.1-.8 3.4 1 4 .1 1.8 1.7 2.8 3 2.6.4 1 1.6 1.4 2.4.8V6.4C10.8 5.3 10 4.8 9 4.8Z"/><path d="M15 4.8c2.4 0 3.6 1.8 3.4 3.4 1.6.6 2 2.8.6 4-1 1.1.8 3.4-1 4-.1 1.8-1.7 2.8-3 2.6-.4 1-1.6 1.4-2.4.8V6.4c.6-1.1 1.4-1.6 2.4-1.6Z"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M12 3.5v2.3M12 18.2v2.3M20.5 12h-2.3M5.8 12H3.5M17.8 6.2l-1.6 1.6M7.8 16.2l-1.6 1.6M17.8 17.8l-1.6-1.6M7.8 7.8 6.2 6.2"/>',
  money: '<circle cx="12" cy="12" r="7.5"/><path d="M12 7.5v9M14.3 9.3c-.4-.7-1.3-1-2.3-1-1.4 0-2.4.7-2.4 1.8 0 2.4 4.7 1.1 4.7 3.5 0 1.1-1 1.9-2.4 1.9-1 0-1.9-.4-2.3-1.1"/>',
  document: '<path d="M7 3.5h7l3.5 3.5V20.5H7Z"/><path d="M14 3.5V7h3.5"/><path d="M9.3 12h5.4M9.3 15h5.4M9.3 9h2.5"/>',
  clock: '<circle cx="12" cy="12" r="8"/><path d="M12 7.3V12l3.3 2"/>',
  warning: '<path d="M12 4 21 19H3Z"/><path d="M12 10.3v3.6"/><circle cx="12" cy="16.3" r=".9"/>',
  scale: '<path d="M12 3.5v16M7 20h10"/><path d="M5 8h5.2M13.8 8H19"/><path d="M5 8l-2.3 4.6a2.6 2.6 0 0 0 4.6 0Z"/><path d="M19 8l-2.3 4.6a2.6 2.6 0 0 0 4.6 0Z"/>',
  layers: '<path d="M12 3.5 20.5 8 12 12.5 3.5 8Z"/><path d="m3.5 12 8.5 4.5L20.5 12"/><path d="m3.5 16 8.5 4.5L20.5 16"/>',
  spark: '<path d="M12 3v5M12 16v5M3 12h5M16 12h5M6 6l3 3M18 6l-3 3M6 18l3-3M18 18l-3-3"/>',
};

function iconSvg(name: string | null): string {
  const inner = (name && ICONS[name]) || ICONS.spark;
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${inner}</svg>`;
}

function esc(s: string | null | undefined): string {
  return (s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));
}
function curly(s: string | null | undefined): string {
  return esc(s).replace(/'/g, "’");
}
function byId<T extends { id: string }>(list: T[], id: string): T | undefined {
  return list.find((x) => x.id === id);
}

function nodeCard(node: Node, accentVar?: string): string {
  const accent = accentVar || "var(--rg-verified)";
  return `
  <div class="rg-card rg-emph-${node.emphasis}">
    <div class="rg-card-top">
      <span class="rg-card-icon" style="color:${accent};border-color:${accent}55;">${iconSvg(node.icon)}</span>
      <span class="rg-card-label">${esc(node.label)}</span>
    </div>
    <p class="rg-card-plain">${esc(node.plain)}</p>
    ${node.quote ? `<div class="rg-card-quote">&ldquo;${curly(node.quote)}&rdquo;</div>` : ""}
    <div class="rg-card-foot">
      <span class="rg-mark rg-mark-${node.basis}"></span>
      <span class="rg-basis rg-basis-${node.basis}">${node.basis}</span>
      <span class="rg-kind">${esc(node.kind)}</span>
    </div>
  </div>`;
}

function renderSpectrum(fig: Figure, nodes: Node[]): string {
  const layout = fig.layout as SpectrumLayout;
  const groups = layout.group_order.map((gid) => byId(fig.groups, gid)).filter(Boolean) as Figure["groups"];
  const stops = groups.map((g) => ACCENT[g.accent]).join(", ");
  const cols = groups
    .map((g) => {
      const cards = fig.node_ids
        .map((id) => byId(nodes, id))
        .filter((n): n is Node => !!n && n.group_id === g.id)
        .map((n) => nodeCard(n, ACCENT[g.accent]))
        .join("");
      return `<div class="rg-camp" style="--rg-camp-color:${ACCENT[g.accent]};">
        <div class="rg-camp-label">${esc(g.label)}</div>
        ${g.blurb ? `<div class="rg-camp-blurb">${esc(g.blurb)}</div>` : ""}
        ${cards}
      </div>`;
    })
    .join("");
  return `
    <div class="rg-spectrum-row">
      <span class="rg-mono rg-end">${esc(layout.axis_label_low)}</span>
      <div class="rg-spectrum-bar" style="background:linear-gradient(to right, ${stops});"></div>
      <span class="rg-mono rg-end">${esc(layout.axis_label_high)}</span>
    </div>
    <div class="rg-camp-row" style="grid-template-columns:repeat(${Math.max(groups.length, 1)}, 1fr);">${cols}</div>
  `;
}

function renderComparison(fig: Figure, nodes: Node[]): string {
  const layout = fig.layout as ComparisonLayout;
  const cellFor = (nid: string, did: string) => layout.cells.find((c) => c.node_id === nid && c.dimension_id === did);
  const head = `<tr><th></th>${layout.dimensions.map((d) => `<th>${esc(d.label)}</th>`).join("")}</tr>`;
  const rows = fig.node_ids
    .map((nid) => {
      const n = byId(nodes, nid);
      if (!n) return "";
      const cells = layout.dimensions.map((d) => `<td>${esc(cellFor(nid, d.id)?.text ?? "not stated")}</td>`).join("");
      return `<tr><th>${esc(n.label)}</th>${cells}</tr>`;
    })
    .join("");
  return `<div class="rg-table-wrap"><table class="rg-table">${head}${rows}</table></div>`;
}

function renderProcess(fig: Figure, nodes: Node[]): string {
  const layout = fig.layout as ProcessLayout;
  const steps = layout.order
    .map((id, i) => {
      const n = byId(nodes, id);
      if (!n) return "";
      const arrow = i < layout.order.length - 1 ? `<span class="rg-process-arrow">&#8594;</span>` : "";
      return `<div class="rg-process-step">${nodeCard(n)}</div>${arrow}`;
    })
    .join("");
  return `<div class="rg-process-row">${steps}</div>`;
}

function renderConceptMap(fig: Figure, nodes: Node[], edges: Edge[]): string {
  const W = 460, H = 340, cx = W / 2, cy = H / 2, r = 120;
  const ids = fig.node_ids;
  const pos: Record<string, [number, number]> = {};
  ids.forEach((id, i) => {
    const angle = (2 * Math.PI * i) / ids.length - Math.PI / 2;
    pos[id] = [cx + r * Math.cos(angle), cy + r * Math.sin(angle)];
  });
  let inner = "";
  fig.edge_ids.forEach((eid) => {
    const e = byId(edges, eid);
    if (!e || !pos[e.source] || !pos[e.target]) return;
    const [x1, y1] = pos[e.source]!, [x2, y2] = pos[e.target]!;
    const dash = e.basis === "inferred" ? 'stroke-dasharray="4,3"' : "";
    inner += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="var(--rg-rule-strong)" ${dash}/>`;
    inner += `<text x="${(x1 + x2) / 2}" y="${(y1 + y2) / 2}" class="rg-svg-mini">${esc(e.label)}</text>`;
  });
  ids.forEach((id) => {
    const n = byId(nodes, id);
    if (!n) return;
    const [x, y] = pos[id]!;
    const solid = n.basis === "stated";
    inner += `<circle cx="${x}" cy="${y}" r="24" fill="var(--rg-panel-2)" stroke="${solid ? "var(--rg-verified)" : "var(--rg-inferred)"}" stroke-width="${n.emphasis === 3 ? 2.2 : 1.3}" ${solid ? "" : 'stroke-dasharray="3,2"'}/>`;
    inner += `<text x="${x}" y="${y}" class="rg-svg-node" text-anchor="middle" dominant-baseline="middle">${esc(n.label.slice(0, 14))}</text>`;
  });
  const svg = `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">${inner}</svg>`;
  const cards = ids.map((id) => byId(nodes, id)).filter((n): n is Node => !!n).map((n) => nodeCard(n)).join("");
  return `<div class="rg-svg-wrap">${svg}</div><div class="rg-card-grid">${cards}</div>`;
}

function renderAxis(fig: Figure, nodes: Node[]): string {
  const layout = fig.layout as AxisLayout;
  const W = 460, H = 380, PAD = 40;
  const plotW = W - PAD * 2, plotH = H - PAD * 2;
  const toX = (x: number) => PAD + ((x + 1) / 2) * plotW;
  const toY = (y: number) => PAD + ((1 - y) / 2) * plotH;
  const cx = PAD + plotW / 2, cy = PAD + plotH / 2;

  let grid = "";
  [-0.5, 0.5].forEach((g) => {
    grid += `<line x1="${toX(g)}" y1="${PAD}" x2="${toX(g)}" y2="${PAD + plotH}" stroke="var(--rg-rule)"/>`;
    grid += `<line x1="${PAD}" y1="${toY(g)}" x2="${PAD + plotW}" y2="${toY(g)}" stroke="var(--rg-rule)"/>`;
  });

  const quads: Record<string, [number, number, number, number]> = {
    tl: [PAD, PAD, plotW / 2, plotH / 2], tr: [cx, PAD, plotW / 2, plotH / 2],
    bl: [PAD, cy, plotW / 2, plotH / 2], br: [cx, cy, plotW / 2, plotH / 2],
  };
  let empty = "";
  (layout.empty_regions || []).forEach((er) => {
    const [rx, ry, rw, rh] = quads[er.quadrant]!;
    empty += `<rect x="${rx + 5}" y="${ry + 5}" width="${rw - 10}" height="${rh - 10}" fill="none" stroke="var(--rg-inferred)" stroke-width="1" stroke-dasharray="4 4" rx="4"/>`;
    empty += `<foreignObject x="${rx + 12}" y="${ry + 10}" width="${rw - 24}" height="${rh - 20}"><div xmlns="http://www.w3.org/1999/xhtml" class="rg-axis-note">${esc(er.note)}</div></foreignObject>`;
  });

  let dots = "", legend = "";
  const byX = [...layout.positions].sort((a, b) => a.x - b.x);
  const crowded = new Set<string>();
  for (let i = 0; i < byX.length; i++) {
    for (let j = i + 1; j < byX.length; j++) {
      const dx = Math.abs(byX[i]!.x - byX[j]!.x), dy = Math.abs(byX[i]!.y - byX[j]!.y);
      if (dx < 0.22 && dy < 0.22) { crowded.add(byX[i]!.node_id); crowded.add(byX[j]!.node_id); }
    }
  }
  let markerN = 0;
  layout.positions.forEach((p) => {
    const n = byId(nodes, p.node_id);
    if (!n) return;
    const x = toX(p.x), y = toY(p.y);
    const rr = n.emphasis === 3 ? 6 : n.emphasis === 2 ? 5 : 4;
    const solid = n.basis === "stated";
    dots += `<circle cx="${x}" cy="${y}" r="${rr}" fill="${solid ? "var(--rg-verified)" : "none"}" stroke="${solid ? "var(--rg-verified)" : "var(--rg-inferred)"}" stroke-width="1.4" ${solid ? "" : 'stroke-dasharray="3 2"'}/>`;
    if (crowded.has(p.node_id)) {
      markerN += 1;
      dots += `<text x="${x}" y="${y - rr - 4}" class="rg-svg-mini" text-anchor="middle" font-weight="600">${markerN}</text>`;
      legend += `<div class="rg-axis-legend-item"><span class="rg-mono" style="color:var(--rg-verified);font-weight:600;">${markerN}</span> ${esc(n.label)}</div>`;
    } else {
      const anchor = x > cx ? "end" : "start";
      const tx = x > cx ? x - 10 : x + 10;
      dots += `<text x="${tx}" y="${y + 4}" class="rg-svg-node" text-anchor="${anchor}">${esc(n.label)}</text>`;
    }
  });

  const svg = `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
    ${grid}
    <line x1="${cx}" y1="${PAD}" x2="${cx}" y2="${PAD + plotH}" stroke="var(--rg-rule-strong)"/>
    <line x1="${PAD}" y1="${cy}" x2="${PAD + plotW}" y2="${cy}" stroke="var(--rg-rule-strong)"/>
    ${empty}
    <text x="${PAD}" y="${PAD + plotH + 18}" class="rg-svg-mini">${esc(layout.x.low_label)}</text>
    <text x="${PAD + plotW}" y="${PAD + plotH + 18}" class="rg-svg-mini" text-anchor="end">${esc(layout.x.high_label)}</text>
    ${dots}
  </svg>`;

  return `<div class="rg-svg-wrap">${svg}</div>
    <div class="rg-axis-legend">
      <div class="rg-axis-legend-item"><span class="rg-mark rg-mark-stated"></span> stated</div>
      <div class="rg-axis-legend-item"><span class="rg-mark rg-mark-inferred"></span> inferred</div>
    </div>
    ${legend ? `<div class="rg-axis-legend">${legend}</div>` : ""}`;
}

function renderConceptMapClusters(fig: Figure): string {
  const layout = fig.layout as ConceptMapLayout;
  if (!layout.clusters?.length) return "";
  return `<div class="rg-clusters">${layout.clusters.map((c) => `<span class="rg-cluster-chip">${esc(c.label)}</span>`).join("")}</div>`;
}

function renderFigure(fig: Figure, resp: ExplainResponse, index: number): string {
  let diagram = "";
  if (fig.form === "spectrum") diagram = renderSpectrum(fig, resp.nodes);
  else if (fig.form === "comparison") diagram = renderComparison(fig, resp.nodes);
  else if (fig.form === "process") diagram = renderProcess(fig, resp.nodes);
  else if (fig.form === "axis") diagram = renderAxis(fig, resp.nodes);
  else if (fig.form === "concept_map") diagram = renderConceptMapClusters(fig) + renderConceptMap(fig, resp.nodes, resp.edges);

  return `
  <section class="rg-plate">
    <div class="rg-plate-head">
      <span class="rg-mono rg-plate-num">PLATE ${String(index + 1).padStart(2, "0")}</span>
      <span class="rg-badge">${esc(fig.form)}</span>
      <span class="rg-badge rg-badge-${fig.provenance}">${esc(fig.provenance)}</span>
    </div>
    <h3 class="rg-plate-title">${esc(fig.title)}</h3>
    <div class="rg-question"><b>Reader's question</b>${esc(fig.question)}</div>
    <div class="rg-frame">${diagram}</div>
    <p class="rg-caption">${esc(fig.caption)}</p>
    ${fig.conclusion ? `<div class="rg-conclusion">${esc(fig.conclusion)}</div>` : ""}
  </section>`;
}

export function renderFullPanel(resp: ExplainResponse): string {
  const figures = resp.figures.map((f, i) => renderFigure(f, resp, i)).join("");
  const glance = resp.at_a_glance
    .map((h) => `<div class="rg-glance-tile"><div class="rg-glance-label">${esc(h.label)}</div><div class="rg-glance-value">${esc(h.value)}</div></div>`)
    .join("");
  const glossary = resp.glossary
    .map((g: GlossaryItem) => `<div class="rg-gloss-item"><div class="rg-gloss-term">${esc(g.term)}</div><p class="rg-gloss-plain">${esc(g.plain)}</p><p class="rg-gloss-context">${esc(g.in_context)}</p></div>`)
    .join("");
  const warnings = resp.meta.warnings?.length
    ? `<div class="rg-warnings"><b>Warnings</b><ul>${resp.meta.warnings.map((w) => `<li>${esc(w)}</li>`).join("")}</ul></div>`
    : "";

  return `
    <div class="rg-headline">${esc(resp.headline)}</div>
    <p class="rg-subhead">${esc(resp.subhead)}</p>
    ${warnings}
    ${figures}
    ${glance ? `<div class="rg-glance-title rg-mono">At a glance</div><div class="rg-glance-strip">${glance}</div>` : ""}
    ${glossary ? `<div class="rg-glance-title rg-mono">Glossary</div><div class="rg-glossary">${glossary}</div>` : ""}
    <div class="rg-meta-line rg-mono">${esc(resp.meta.provider)} &middot; ${esc(resp.meta.model)} &middot; ${resp.meta.latency_ms}ms${resp.meta.cached ? " &middot; cached" : ""}</div>
  `;
}

export function renderGalleryItem(headline: string, forms: string[], createdAt: number, sourceTitle: string): string {
  const date = new Date(createdAt).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
  return `
    <div class="rg-gallery-title">${esc(headline)}</div>
    <div class="rg-gallery-meta rg-mono">${forms.map((f) => `<span class="rg-badge">${esc(f)}</span>`).join("")}</div>
    <div class="rg-gallery-source rg-mono">${esc(sourceTitle)} &middot; ${date}</div>
  `;
}
