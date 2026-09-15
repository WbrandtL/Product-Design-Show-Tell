"use strict";
/* Renders a figure from PROMPT_SPEC.md's output contract - forms are
   SPECTRUM/QUADRANT/COMPARISON/PROCESS/CONCEPT_MAP, nodes carry body/
   attribution/hedge/off_axis/placement instead of the old plain/icon/basis.
   Warm paper palette matching the Gist mockup. */

function esc(s) {
  return (s ?? "").toString().replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
function curly(s) { return esc(s).replace(/'/g, "’"); }
function byId(list, id) { return (list || []).find((x) => x.id === id); }

function wrapLabel(label, maxChars) {
  const words = (label || "").split(" ");
  const lines = [];
  let cur = "";
  words.forEach((w) => {
    const next = cur ? `${cur} ${w}` : w;
    if (next.length > maxChars && cur) { lines.push(cur); cur = w; } else { cur = next; }
  });
  if (cur) lines.push(cur);
  return lines;
}
function tspanLines(lines, x, lineHeight) {
  const startDy = lines.length > 1 ? -(lineHeight * (lines.length - 1)) / 2 : 0;
  return lines.map((l, i) => `<tspan x="${x}" dy="${i === 0 ? startDy : lineHeight}">${esc(l)}</tspan>`).join("");
}

/**
 * Every quote in a figure that's attached to a given node.
 * @param {object} fig
 * @param {string} nodeId
 * @returns {object[]}
 */
function nodeQuotes(fig, nodeId) {
  return (fig.quotes || []).filter((q) => q.node === nodeId);
}

/**
 * Renders one node as a card: label, body, any attached quotes, and the two
 * things the spec requires to be visible - whether the claim is attributed
 * (solid vs dashed outline) and its hedge (a small badge when not "stated").
 * @param {object} fig
 * @param {object} node
 * @returns {string}
 */
function nodeCard(fig, node) {
  const solid = node.attribution && node.attribution.named;
  const quotes = nodeQuotes(fig, node.id);
  const byline = solid && node.attribution.source ? `<div class="card-byline">${esc(node.attribution.source)}</div>` : "";
  const quoteHtml = quotes
    .map((q) => `<div class="card-quote">&ldquo;${curly(q.text)}&rdquo;${q.cite ? ` <span class="card-cite">— ${esc(q.cite)}</span>` : ""}</div>`)
    .join("");
  const hedgeBadge = node.hedge && node.hedge !== "stated" ? `<span class="hedge-badge hedge-${node.hedge}">${esc(node.hedge)}</span>` : "";
  return `
  <div class="card ${solid ? "" : "unattributed"}">
    <div class="card-top">
      <div class="card-label">${esc(node.label)}</div>
      ${hedgeBadge}
    </div>
    <p class="card-plain">${esc(node.body)}</p>
    ${quoteHtml}
    ${byline}
  </div>`;
}

function offAxisBlock(fig, label) {
  const offAxis = fig.nodes.filter((n) => n.off_axis);
  if (!offAxis.length) return "";
  return `<div class="off-axis-bracket">
    <div class="off-axis-label">${esc(label)}</div>
    <div class="off-axis-nodes">${offAxis.map((n) => `<span class="off-axis-chip">${esc(n.label)}</span>`).join("")}</div>
  </div>`;
}

function renderSpectrum(fig) {
  const axis = fig.axes[0];
  if (!axis) return `<p class="card-plain">No axis given for this spectrum.</p>`;
  const onAxis = fig.nodes.filter((n) => !n.off_axis);

  // Markers whose positions land close together stack their labels - a known
  // limitation for now (see README); alternating rows was tried and made
  // things worse (markers disappearing from a layout interaction that wasn't
  // worth chasing down for a secondary polish item), so this stays simple.
  const withPos = onAxis
    .map((n) => ({ n, pos: ((n.placement || []).find((pl) => pl.axis === axis.id) || { position: 0.5 }).position }));
  let markers = "";
  withPos.forEach(({ n, pos }) => {
    const solid = n.attribution && n.attribution.named;
    markers += `<div class="spectrum-marker" style="left:${(pos * 100).toFixed(1)}%;">
      <span class="spectrum-dot ${solid ? "" : "unattributed"}"></span>
      <span class="spectrum-marker-label">${esc(n.label)}</span>
    </div>`;
  });

  return `
    ${offAxisBlock(fig, "Rejects this axis entirely")}
    <div class="spectrum-bar-row">
      <span class="spectrum-end">${esc(axis.left_pole)}</span>
      <div class="spectrum-track">${markers}</div>
      <span class="spectrum-end">${esc(axis.right_pole)}</span>
    </div>
    <div class="card-grid">${fig.nodes.map((n) => nodeCard(fig, n)).join("")}</div>`;
}

function renderQuadrant(fig) {
  const axisX = fig.axes.find((a) => a.id === "x") || fig.axes[0];
  const axisY = fig.axes.find((a) => a.id === "y") || fig.axes[1];
  if (!axisX || !axisY) return `<p class="card-plain">This quadrant is missing an axis.</p>`;

  const W = 660, H = 460, PAD = 46;
  const plotW = W - 2 * PAD, plotH = H - 2 * PAD;
  const toX = (p) => PAD + p * plotW;
  const toY = (p) => PAD + (1 - p) * plotH;
  const cx = PAD + plotW / 2, cy = PAD + plotH / 2;

  let grid = "";
  [0.25, 0.75].forEach((g) => {
    grid += `<line x1="${toX(g).toFixed(1)}" y1="${PAD}" x2="${toX(g).toFixed(1)}" y2="${PAD + plotH}" stroke="var(--rule)"/>`;
    grid += `<line x1="${PAD}" y1="${toY(g).toFixed(1)}" x2="${PAD + plotW}" y2="${toY(g).toFixed(1)}" stroke="var(--rule)"/>`;
  });

  const quadRects = {
    tl: [PAD, PAD, plotW / 2, plotH / 2], tr: [cx, PAD, plotW / 2, plotH / 2],
    bl: [PAD, cy, plotW / 2, plotH / 2], br: [cx, cy, plotW / 2, plotH / 2],
  };
  let emptyBoxes = "";
  (fig.empty_regions || []).forEach((er) => {
    const rect = quadRects[er.cell];
    if (!rect) return;
    const [rx, ry, rw, rh] = rect;
    emptyBoxes += `<rect x="${rx + 5}" y="${ry + 5}" width="${rw - 10}" height="${rh - 10}" fill="none" stroke="var(--accent)" stroke-width="1.2" stroke-dasharray="4 4"/>`;
    emptyBoxes += `<foreignObject x="${rx + 14}" y="${ry + 12}" width="${rw - 28}" height="${rh - 24}"><div xmlns="http://www.w3.org/1999/xhtml" class="axis-note">${esc(er.finding)}</div></foreignObject>`;
  });

  let dots = "";
  fig.nodes.filter((n) => !n.off_axis).forEach((n) => {
    const px = (n.placement || []).find((p) => p.axis === axisX.id);
    const py = (n.placement || []).find((p) => p.axis === axisY.id);
    if (!px || !py) return;
    const x = toX(px.position), y = toY(py.position);
    const solid = n.attribution && n.attribution.named;
    dots += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="6" fill="${solid ? "var(--ink)" : "none"}" stroke="var(--ink)" stroke-width="1.3" ${solid ? "" : 'stroke-dasharray="3 2"'}/>`;
    const anchor = x > cx ? "end" : "start";
    const tx = x > cx ? x - 10 : x + 10;
    dots += `<text x="${tx.toFixed(1)}" y="${(y + 4).toFixed(1)}" class="node-name" text-anchor="${anchor}">${esc(n.label)}</text>`;
  });

  return `${offAxisBlock(fig, "Rejects this grid entirely")}
  <div class="axis-wrap"><svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
    ${grid}
    <line x1="${cx}" y1="${PAD}" x2="${cx}" y2="${PAD + plotH}" stroke="var(--ink)" stroke-width="1"/>
    <line x1="${PAD}" y1="${cy}" x2="${PAD + plotW}" y2="${cy}" stroke="var(--ink)" stroke-width="1"/>
    ${emptyBoxes}
    <text x="${PAD}" y="${PAD + plotH + 20}" class="axis-tick">${esc(axisX.left_pole)}</text>
    <text x="${PAD + plotW}" y="${PAD + plotH + 20}" class="axis-tick" text-anchor="end">${esc(axisX.right_pole)}</text>
    <text x="${PAD - 10}" y="${cy}" class="axis-tick" text-anchor="end" transform="rotate(-90 ${PAD - 10} ${cy})">${esc(axisY.left_pole)}</text>
    <text x="${PAD + plotW + 10}" y="${cy}" class="axis-tick" transform="rotate(-90 ${PAD + plotW + 10} ${cy})">${esc(axisY.right_pole)}</text>
    ${dots}
  </svg></div>
  <div class="card-grid">${fig.nodes.map((n) => nodeCard(fig, n)).join("")}</div>`;
}

function renderComparison(fig) {
  const edgeNotes = (fig.edges || [])
    .map((e) => {
      const a = byId(fig.nodes, e.from_ || e.from), b = byId(fig.nodes, e.to);
      return `<div class="edge-note"><b>${esc(a ? a.label : e.from)}</b> ${esc(e.label)} <b>${esc(b ? b.label : e.to)}</b></div>`;
    })
    .join("");
  return `<div class="card-grid comparison-grid">${fig.nodes.map((n) => nodeCard(fig, n)).join("")}</div>
    ${edgeNotes ? `<div class="edge-notes">${edgeNotes}</div>` : ""}`;
}

function renderProcess(fig) {
  const order = fig.nodes.map((n) => n.id);
  const W = Math.max(560, order.length * 150), H = 190, y = 70;
  const pos = {};
  order.forEach((id, i) => { pos[id] = 78 + i * 150; });

  let inner = `<defs><marker id="arrow" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 z" fill="var(--ink)"/></marker></defs>`;
  (fig.edges || []).forEach((e) => {
    const from = e.from_ || e.from;
    if (!(from in pos) || !(e.to in pos)) return;
    const x1 = pos[from], x2 = pos[e.to];
    const dash = e.strength === "weak" ? 'stroke-dasharray="3 3"' : "";
    if (x2 > x1) {
      inner += `<line x1="${x1 + 58}" y1="${y}" x2="${x2 - 58}" y2="${y}" stroke="var(--ink)" ${dash} marker-end="url(#arrow)"/>`;
    } else if (x2 < x1) {
      const midY = y + 78;
      inner += `<path d="M ${x1 - 20} ${y + 26} Q ${(x1 + x2) / 2} ${midY} ${x2 + 20} ${y + 26}" fill="none" stroke="var(--ink)" stroke-dasharray="3 2" marker-end="url(#arrow)"/>`;
    }
  });
  order.forEach((id) => {
    const n = byId(fig.nodes, id);
    if (!n) return;
    const x = pos[id];
    const lines = wrapLabel(n.label, 15).slice(0, 2);
    const solid = n.attribution && n.attribution.named;
    inner += `<rect x="${x - 58}" y="${y - 26}" width="116" height="52" fill="var(--paper-light)" stroke="var(--ink)" ${solid ? "" : 'stroke-dasharray="4 3"'}/>`;
    inner += `<text x="${x}" y="${y}" class="node-name-sm" text-anchor="middle">${tspanLines(lines, x, 12)}</text>`;
  });

  const loopNote = fig.loop_has_origin === false
    ? `<div class="axis-legend"><div class="axis-legend-item"><b>note</b> this loop is already running in the passage - no single entry point, so none is drawn.</div></div>`
    : "";

  return `<div class="axis-wrap"><svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">${inner}</svg></div>
    ${loopNote}
    <div class="card-grid">${fig.nodes.map((n) => nodeCard(fig, n)).join("")}</div>`;
}

function renderConceptMap(fig) {
  const ids = fig.nodes.map((n) => n.id);
  const edgeList = (fig.edges || []).map((e) => ({ ...e, from: e.from_ || e.from })).filter((e) => e.from && e.to);

  const degree = {};
  ids.forEach((id) => (degree[id] = 0));
  edgeList.forEach((e) => {
    if (degree[e.from] != null) degree[e.from] += 1;
    if (degree[e.to] != null) degree[e.to] += 1;
  });
  const byDegree = [...ids].sort((a, b) => degree[b] - degree[a]);
  const topDegree = degree[byDegree[0]] || 0;
  const secondDegree = degree[byDegree[1]] || 0;
  const useHub = ids.length >= 5 && topDegree >= 3 && topDegree > secondDegree;
  const hubId = useHub ? byDegree[0] : null;
  const spokeIds = useHub ? ids.filter((id) => id !== hubId) : ids;

  const W = 720, H = 560;
  const cx = W / 2, cy = H / 2;
  const R = Math.min(230, 120 + spokeIds.length * 12);
  const MARKER_R = 7;
  const LINE_H = 12;

  const pos = {};
  if (useHub) pos[hubId] = [cx, cy];
  spokeIds.forEach((id, i) => {
    const angle = (2 * Math.PI * i) / spokeIds.length - Math.PI / 2;
    pos[id] = [cx + R * Math.cos(angle), cy + R * Math.sin(angle)];
  });

  function nodeLayout(id) {
    const n = byId(fig.nodes, id);
    const [x, y] = pos[id];
    const isHub = id === hubId;
    const r = isHub ? 10 : 6;
    const lines = wrapLabel(n.label, 16);
    let tx, ty, anchor;
    if (isHub) {
      tx = x; ty = y + r + 15; anchor = "middle";
    } else {
      const dxh = x - cx, dyh = y - cy;
      const dh = Math.hypot(dxh, dyh) || 1;
      const off = r + 9;
      tx = x + (dxh / dh) * off;
      ty = y + (dyh / dh) * off;
      anchor = dxh > 10 ? "start" : dxh < -10 ? "end" : "middle";
      if (anchor === "middle") ty += dyh < 0 ? -4 : 10;
    }
    return { r, tx, ty, anchor, lines };
  }

  const placedLabelRects = [];
  function rectsOverlap(a, b) {
    return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  }
  const nodeLayouts = {};
  ids.forEach((id) => {
    const layout = nodeLayout(id);
    nodeLayouts[id] = layout;
    const widest = Math.max(...layout.lines.map((l) => l.length), 1) * 5.2;
    const boxX = layout.anchor === "start" ? layout.tx : layout.anchor === "end" ? layout.tx - widest : layout.tx - widest / 2;
    placedLabelRects.push({ x: boxX, y: layout.ty - 9 * layout.lines.length, w: widest, h: 11 * layout.lines.length + 4 });
  });

  let edgesSvg = "";
  edgeList.forEach((e) => {
    const p1 = pos[e.from], p2 = pos[e.to];
    if (!p1 || !p2) return;
    const [x1, y1] = p1, [x2, y2] = p2;
    const dx = x2 - x1, dy = y2 - y1;
    const dist = Math.hypot(dx, dy) || 1;
    const ux = dx / dist, uy = dy / dist;
    const sx = x1 + ux * MARKER_R, sy = y1 + uy * MARKER_R;
    const ex = x2 - ux * MARKER_R, ey = y2 - uy * MARKER_R;
    const dash = e.strength === "weak" ? 'stroke-dasharray="4 3"' : "";
    edgesSvg += `<line x1="${sx.toFixed(1)}" y1="${sy.toFixed(1)}" x2="${ex.toFixed(1)}" y2="${ey.toFixed(1)}" stroke="var(--rule-strong)" ${dash}/>`;
    if (e.label) {
      const t = 0.76;
      let mx = sx + (ex - sx) * t, my = sy + (ey - sy) * t;
      const w = Math.min(100, e.label.length * 4.6 + 8);
      const h = 13;
      const px = -uy, py = ux;
      let rect = { x: mx - w / 2, y: my - h / 2, w, h };
      for (let step = 0; step < 6 && placedLabelRects.some((r) => rectsOverlap(r, rect)); step++) {
        const sign = step % 2 === 0 ? 1 : -1;
        const mag = Math.ceil((step + 1) / 2) * 9;
        mx = sx + (ex - sx) * t + px * sign * mag;
        my = sy + (ey - sy) * t + py * sign * mag;
        rect = { x: mx - w / 2, y: my - h / 2, w, h };
      }
      placedLabelRects.push(rect);
      edgesSvg += `<rect x="${rect.x.toFixed(1)}" y="${rect.y.toFixed(1)}" width="${w.toFixed(1)}" height="${h}" fill="var(--paper)" opacity="0.95"/>`;
      edgesSvg += `<text x="${mx.toFixed(1)}" y="${(my + 2.8).toFixed(1)}" class="edge-label" text-anchor="middle">${esc(e.label)}</text>`;
    }
  });

  let nodesSvg = "";
  ids.forEach((id) => {
    const n = byId(fig.nodes, id);
    if (!n) return;
    const [x, y] = pos[id];
    const solid = n.attribution && n.attribution.named;
    const isHub = id === hubId;
    const { r, tx, ty, anchor, lines } = nodeLayouts[id];
    nodesSvg += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${r}" fill="${solid ? "var(--ink)" : "var(--paper-light)"}" stroke="var(--ink)" stroke-width="${isHub ? 2 : 1.3}" ${solid ? "" : 'stroke-dasharray="3 2"'}/>`;
    nodesSvg += `<text x="${tx.toFixed(1)}" y="${ty.toFixed(1)}" class="node-name-sm" text-anchor="${anchor}">${tspanLines(lines, tx, LINE_H)}</text>`;
  });

  return `<div class="axis-wrap"><svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">${edgesSvg}${nodesSvg}</svg></div>
    <div class="card-grid">${fig.nodes.map((n) => nodeCard(fig, n)).join("")}</div>`;
}

/**
 * Renders one figure's diagram, form-dispatched.
 * @param {object} fig one Figure from an ExplainResponse
 * @returns {string} HTML for the diagram plus its node cards
 */
function renderFigureDiagram(fig) {
  if (fig.form === "SPECTRUM") return renderSpectrum(fig);
  if (fig.form === "QUADRANT") return renderQuadrant(fig);
  if (fig.form === "COMPARISON") return renderComparison(fig);
  if (fig.form === "PROCESS") return renderProcess(fig);
  if (fig.form === "CONCEPT_MAP") return renderConceptMap(fig);
  return `<p class="card-plain">Unknown form: ${esc(fig.form)}</p>`;
}

const RESIDUE_LABELS = {
  META: "about the document itself",
  NEGATION: "states what something is not",
  HEDGE_ONLY: "too hedged to assert as structure",
  VERBATIM_REQUIRED: "wording that can't be safely merged or paraphrased",
  ALREADY_A_FIGURE: "the source already points at its own figure or table",
  LOW_VALUE_LINEAGE: "a citation chain not worth its own node",
  FORM_UNAVAILABLE: "needed a form this renderer doesn't have",
  PROSE_IS_THE_POINT: "the writing itself is the point - a diagram would flatten it",
  BELOW_GATE: "clean to draw, but not worth drawing",
};

/**
 * Renders the "nothing worth drawing here" state for a response with no
 * figures - a valid, honest outcome per the spec, not an error.
 * @param {object} response a validated ExplainResponse with figures: []
 * @returns {string}
 */
function renderNoFigure(response) {
  const items = (response.left_in_text || [])
    .map((item) => `
      <div class="residue-item">
        <span class="residue-reason">${esc(RESIDUE_LABELS[item.reason] || item.reason)}</span>
        ${item.note ? `<p class="card-plain">${esc(item.note)}</p>` : ""}
      </div>`)
    .join("");
  return `
    <div class="no-figure-badge">NO FIGURE</div>
    <p class="card-plain" style="margin-top:10px;">This passage didn't need a diagram - drawing one would have asserted more structure than the text actually has.</p>
    ${items ? `<div class="residue-list">${items}</div>` : ""}
  `;
}
