"use strict";
/* Renders an ExplainResponse from gist-backend/app/schema.py: a single flat
   figure per response (no figures[] wrapper, no NO_FIGURE state - every
   response has 2-7 nodes). layout_hint is one of comparison_table/flow/
   quadrant/hierarchy/timeline; nodes carry label/plain_label/kind/one_line/
   emphasis/quote/source_span. A node's quote survives only if span
   verification confirmed it against the passage, so "has a quote" doubles as
   the solid-vs-dashed verified/unverified signal the mockup wants.
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
 * Renders one node as a card: label, plain-language body, its verified quote
 * if span verification kept one, and the two things worth surfacing at a
 * glance - emphasis (1 central .. 3 background) and kind.
 * @param {object} node
 * @returns {string}
 */
function nodeCard(node) {
  const verified = !!node.quote;
  const quoteHtml = verified ? `<div class="card-quote">&ldquo;${curly(node.quote)}&rdquo;</div>` : "";
  return `
  <div class="card emph-${node.emphasis} ${verified ? "" : "unattributed"}">
    <div class="card-top">
      <div class="card-label">${esc(node.label)}</div>
      <span class="hedge-badge">${esc(node.kind)}</span>
    </div>
    <p class="card-plain">${esc(node.one_line)}</p>
    ${quoteHtml}
  </div>`;
}

/**
 * One line of prose connecting two nodes by an edge's plain-language label,
 * flagging edges the passage never states outright.
 * @param {object} edge
 * @param {object[]} nodes
 * @returns {string}
 */
function edgeNote(edge, nodes) {
  const a = byId(nodes, edge.source), b = byId(nodes, edge.target);
  const inferredBadge = edge.evidentiality === "inferred" ? ` <span class="hedge-badge hedge-hedged">inferred</span>` : "";
  return `<div class="edge-note"><b>${esc(a ? a.label : edge.source)}</b> ${esc(edge.label)} <b>${esc(b ? b.label : edge.target)}</b>${inferredBadge}</div>`;
}

/**
 * layout_hint "comparison_table": nodes side by side as cards, with the
 * edges connecting them spelled out underneath as plain sentences.
 * @param {object} resp an ExplainResponse
 * @returns {string}
 */
function renderComparisonTable(resp) {
  const edgeNotes = resp.edges.map((e) => edgeNote(e, resp.nodes)).join("");
  return `<div class="card-grid comparison-grid">${resp.nodes.map(nodeCard).join("")}</div>
    ${edgeNotes ? `<div class="edge-notes">${edgeNotes}</div>` : ""}`;
}

/**
 * layout_hint "flow"/"timeline": nodes laid out left to right in extraction
 * order, connected by arrows drawn from the edges (dashed where the passage
 * only implies the step rather than stating it).
 * @param {object} resp an ExplainResponse
 * @returns {string}
 */
function renderFlow(resp) {
  const order = resp.nodes.map((n) => n.id);
  const W = Math.max(560, order.length * 150), H = 190, y = 70;
  const pos = {};
  order.forEach((id, i) => { pos[id] = 78 + i * 150; });

  let inner = `<defs><marker id="arrow" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 z" fill="var(--ink)"/></marker></defs>`;
  resp.edges.forEach((e) => {
    if (!(e.source in pos) || !(e.target in pos)) return;
    const x1 = pos[e.source], x2 = pos[e.target];
    const dash = e.evidentiality === "inferred" ? 'stroke-dasharray="3 3"' : "";
    if (x2 > x1) {
      inner += `<line x1="${x1 + 58}" y1="${y}" x2="${x2 - 58}" y2="${y}" stroke="var(--ink)" ${dash} marker-end="url(#arrow)"/>`;
    } else if (x2 < x1) {
      const midY = y + 78;
      inner += `<path d="M ${x1 - 20} ${y + 26} Q ${(x1 + x2) / 2} ${midY} ${x2 + 20} ${y + 26}" fill="none" stroke="var(--ink)" stroke-dasharray="3 2" marker-end="url(#arrow)"/>`;
    }
  });
  order.forEach((id) => {
    const n = byId(resp.nodes, id);
    if (!n) return;
    const x = pos[id];
    const lines = wrapLabel(n.label, 15).slice(0, 2);
    const verified = !!n.quote;
    inner += `<rect x="${x - 58}" y="${y - 26}" width="116" height="52" fill="var(--paper-light)" stroke="var(--ink)" ${verified ? "" : 'stroke-dasharray="4 3"'}/>`;
    inner += `<text x="${x}" y="${y}" class="node-name-sm" text-anchor="middle">${tspanLines(lines, x, 12)}</text>`;
  });

  return `<div class="axis-wrap"><svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">${inner}</svg></div>
    <div class="card-grid">${resp.nodes.map(nodeCard).join("")}</div>`;
}

/**
 * layout_hint "hierarchy"/"quadrant": the backend gives no axis positions
 * for either (no `axes`/`placement` fields exist in this schema version), so
 * both render as the same radial node-and-edge graph, hub-detected from
 * degree when one node clearly dominates.
 * @param {object} resp an ExplainResponse
 * @returns {string}
 */
function renderNetwork(resp) {
  const ids = resp.nodes.map((n) => n.id);
  const edgeList = resp.edges.filter((e) => ids.includes(e.source) && ids.includes(e.target));

  const degree = {};
  ids.forEach((id) => (degree[id] = 0));
  edgeList.forEach((e) => {
    degree[e.source] += 1;
    degree[e.target] += 1;
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
    const n = byId(resp.nodes, id);
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
    const p1 = pos[e.source], p2 = pos[e.target];
    if (!p1 || !p2) return;
    const [x1, y1] = p1, [x2, y2] = p2;
    const dx = x2 - x1, dy = y2 - y1;
    const dist = Math.hypot(dx, dy) || 1;
    const ux = dx / dist, uy = dy / dist;
    const sx = x1 + ux * MARKER_R, sy = y1 + uy * MARKER_R;
    const ex = x2 - ux * MARKER_R, ey = y2 - uy * MARKER_R;
    const dash = e.evidentiality === "inferred" ? 'stroke-dasharray="4 3"' : "";
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
    const n = byId(resp.nodes, id);
    if (!n) return;
    const [x, y] = pos[id];
    const verified = !!n.quote;
    const isHub = id === hubId;
    const { r, tx, ty, anchor, lines } = nodeLayouts[id];
    nodesSvg += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${r}" fill="${verified ? "var(--ink)" : "var(--paper-light)"}" stroke="var(--ink)" stroke-width="${isHub ? 2 : 1.3}" ${verified ? "" : 'stroke-dasharray="3 2"'}/>`;
    nodesSvg += `<text x="${tx.toFixed(1)}" y="${ty.toFixed(1)}" class="node-name-sm" text-anchor="${anchor}">${tspanLines(lines, tx, LINE_H)}</text>`;
  });

  return `<div class="axis-wrap"><svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">${edgesSvg}${nodesSvg}</svg></div>
    <div class="card-grid">${resp.nodes.map(nodeCard).join("")}</div>`;
}

/**
 * Renders an ExplainResponse's diagram, dispatched on layout_hint.
 * @param {object} resp a validated ExplainResponse
 * @returns {string} HTML for the diagram plus its node cards
 */
function renderFigureDiagram(resp) {
  if (resp.layout_hint === "comparison_table") return renderComparisonTable(resp);
  if (resp.layout_hint === "flow" || resp.layout_hint === "timeline") return renderFlow(resp);
  if (resp.layout_hint === "hierarchy" || resp.layout_hint === "quadrant") return renderNetwork(resp);
  return `<p class="card-plain">Unknown layout: ${esc(resp.layout_hint)}</p>`;
}
