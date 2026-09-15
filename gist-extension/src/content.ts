import { renderFullPanel, renderGalleryItem } from "./render";
import { listGraphics, saveGraphic, deleteGraphic } from "./storage";
import type { ExplainResponse, StoredGraphic } from "./types";

const MIN_CHARS = 200;
const MAX_CHARS = 8000;

// ---------------------------------------------------------------------------
// Shadow host setup
// ---------------------------------------------------------------------------

// The picking-mode cursor override targets <body>, which lives on the host
// page outside our shadow root, so it needs its own tiny global stylesheet.
const cursorStyle = document.createElement("style");
cursorStyle.textContent = `body.rg-picking-cursor, body.rg-picking-cursor * { cursor: crosshair !important; }`;
document.documentElement.appendChild(cursorStyle);

const host = document.createElement("div");
host.id = "reading-graphic-host";
host.style.all = "initial";
document.documentElement.appendChild(host);
const root = host.attachShadow({ mode: "open" });

const styleLink = document.createElement("link");
styleLink.rel = "stylesheet";
styleLink.href = chrome.runtime.getURL("content.css");
root.appendChild(styleLink);

const app = document.createElement("div");
app.className = "rg-root";
root.appendChild(app);

app.innerHTML = `
  <button id="rg-fab" class="rg-fab" title="Select a passage to diagram">
    <span class="rg-fab-icon">${sparkIcon()}</span>
    <span id="rg-fab-badge" class="rg-fab-badge" hidden>0</span>
  </button>
  <div id="rg-caption" class="rg-caption-pill" hidden></div>
  <div id="rg-toast" class="rg-toast" hidden></div>
  <div id="rg-banner" class="rg-banner" hidden>
    Drag to select a passage (200+ characters), then release.
    <button id="rg-banner-cancel" class="rg-banner-cancel">Cancel</button>
  </div>
  <aside id="rg-panel" class="rg-panel" hidden>
    <div class="rg-panel-head">
      <button id="rg-panel-back" class="rg-icon-btn" hidden>&#8592;</button>
      <span id="rg-panel-title" class="rg-panel-title">Library</span>
      <button id="rg-panel-new" class="rg-text-btn">+ New</button>
      <button id="rg-panel-close" class="rg-icon-btn">&times;</button>
    </div>
    <div id="rg-panel-body" class="rg-panel-body"></div>
  </aside>
`;

function sparkIcon(): string {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
    <path d="M12 3v5M12 16v5M3 12h5M16 12h5M6 6l3 3M18 6l-3 3M6 18l3-3M18 18l-3-3"/>
  </svg>`;
}
function spinnerIcon(): string {
  return `<svg class="rg-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 3a9 9 0 1 0 9 9"/></svg>`;
}
function checkIcon(): string {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5 10 17 19 7"/></svg>`;
}

const fab = app.querySelector<HTMLButtonElement>("#rg-fab")!;
const fabIcon = app.querySelector<HTMLSpanElement>(".rg-fab-icon")!;
const fabBadge = app.querySelector<HTMLSpanElement>("#rg-fab-badge")!;
const captionPill = app.querySelector<HTMLDivElement>("#rg-caption")!;
const toast = app.querySelector<HTMLDivElement>("#rg-toast")!;
const banner = app.querySelector<HTMLDivElement>("#rg-banner")!;
const bannerCancel = app.querySelector<HTMLButtonElement>("#rg-banner-cancel")!;
const panel = app.querySelector<HTMLElement>("#rg-panel")!;
const panelBack = app.querySelector<HTMLButtonElement>("#rg-panel-back")!;
const panelTitle = app.querySelector<HTMLSpanElement>("#rg-panel-title")!;
const panelNew = app.querySelector<HTMLButtonElement>("#rg-panel-new")!;
const panelClose = app.querySelector<HTMLButtonElement>("#rg-panel-close")!;
const panelBody = app.querySelector<HTMLDivElement>("#rg-panel-body")!;

// ---------------------------------------------------------------------------
// State machine: idle -> picking -> loading -> (toast) -> idle
// ---------------------------------------------------------------------------

type FabState = "idle" | "picking" | "loading";
let state: FabState = "idle";
let storedCount = 0;

function setFabState(next: FabState) {
  state = next;
  fab.classList.toggle("rg-fab-picking", next === "picking");
  fab.classList.toggle("rg-fab-loading", next === "loading");
  fabIcon.innerHTML = next === "loading" ? spinnerIcon() : sparkIcon();
  banner.hidden = next !== "picking";
  document.body?.classList.toggle("rg-picking-cursor", next === "picking");
}

function showCaption(text: string, ms = 2600) {
  captionPill.textContent = text;
  captionPill.hidden = false;
  window.clearTimeout((showCaption as any)._t);
  (showCaption as any)._t = window.setTimeout(() => { captionPill.hidden = true; }, ms);
}

function showToast(text: string, kind: "ok" | "error" = "ok", onClick?: () => void) {
  toast.innerHTML = `${kind === "ok" ? checkIcon() : "!"} <span>${escapeHtml(text)}</span>`;
  toast.className = `rg-toast rg-toast-${kind}`;
  toast.hidden = false;
  toast.onclick = onClick ?? null;
  window.clearTimeout((showToast as any)._t);
  (showToast as any)._t = window.setTimeout(() => { toast.hidden = true; }, 5000);
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));
}

async function refreshBadge() {
  const list = await listGraphics();
  storedCount = list.length;
  fabBadge.textContent = String(storedCount);
  fabBadge.hidden = storedCount === 0;
}
refreshBadge();

// ---------------------------------------------------------------------------
// FAB click: open library if we have items, otherwise start picking
// ---------------------------------------------------------------------------

fab.addEventListener("click", () => {
  if (state === "loading") return;
  if (state === "picking") { setFabState("idle"); return; }
  if (storedCount > 0) { openGallery(); return; }
  setFabState("picking");
  showCaption("Drag to select a passage, then release");
});

bannerCancel.addEventListener("click", () => setFabState("idle"));

// ---------------------------------------------------------------------------
// Selection capture
// ---------------------------------------------------------------------------

function expandToParagraph(range: Range): string {
  let node: Node | null = range.commonAncestorContainer;
  while (node && node.nodeType !== Node.ELEMENT_NODE) node = node.parentNode;
  let el = node as Element | null;
  while (el && el.tagName && !/^(P|LI|BLOCKQUOTE|ARTICLE|SECTION|DIV|TD)$/.test(el.tagName)) {
    el = el.parentElement;
  }
  return (el as HTMLElement | null)?.innerText?.trim() ?? "";
}

document.addEventListener("mouseup", () => {
  if (state !== "picking") return;
  const sel = window.getSelection();
  const raw = sel?.toString().trim() ?? "";
  if (!raw || raw.length < 3) return;

  let passage = raw;
  if (passage.length < MIN_CHARS && sel && sel.rangeCount > 0) {
    const expanded = expandToParagraph(sel.getRangeAt(0));
    if (expanded.length > passage.length) passage = expanded;
  }
  if (passage.length < MIN_CHARS) {
    showCaption(`Selection is ${passage.length} characters - select a full paragraph or two (200+).`, 3400);
    return;
  }
  if (passage.length > MAX_CHARS) passage = passage.slice(0, MAX_CHARS);

  sel?.removeAllRanges();
  runExplain(passage);
});

// ---------------------------------------------------------------------------
// Backend call + persistence
// ---------------------------------------------------------------------------

async function runExplain(passage: string) {
  setFabState("loading");
  const context = document.title || null;

  const result = await chrome.runtime.sendMessage({ type: "explain", passage, context });

  if (!result?.ok) {
    setFabState("idle");
    showToast(result?.error || "Something went wrong.", "error");
    return;
  }

  const response = result.data as ExplainResponse;
  const graphic: StoredGraphic = {
    id: response.id,
    createdAt: Date.now(),
    sourceUrl: location.href,
    sourceTitle: document.title || location.hostname,
    passage,
    response,
  };
  await saveGraphic(graphic);
  await refreshBadge();
  setFabState("idle");

  if (response.meta.warnings?.length) {
    showToast(`Graphic ready, with ${response.meta.warnings.length} warning(s) - click to view`, "ok", () => openDetail(graphic));
  } else {
    showToast("Graphic ready - click to view", "ok", () => openDetail(graphic));
  }
}

// ---------------------------------------------------------------------------
// Panel: gallery list + detail view
// ---------------------------------------------------------------------------

function openPanel() { panel.hidden = false; }
function closePanel() { panel.hidden = true; }
panelClose.addEventListener("click", closePanel);
panelNew.addEventListener("click", () => {
  closePanel();
  setFabState("picking");
  showCaption("Drag to select a passage, then release");
});

async function openGallery() {
  panelBack.hidden = true;
  panelTitle.textContent = "Library";
  const list = await listGraphics();
  if (list.length === 0) {
    panelBody.innerHTML = `<div class="rg-empty">No graphics yet. Select a passage of text on any page to make one.</div>`;
  } else {
    panelBody.innerHTML = `<div class="rg-gallery-list">${list
      .map(
        (g) => `<button class="rg-gallery-item" data-id="${g.id}">
          ${renderGalleryItem(g.response.headline, g.response.figures.map((f) => f.form), g.createdAt, g.sourceTitle)}
          <span class="rg-gallery-delete" data-delete="${g.id}" title="Delete">&times;</span>
        </button>`
      )
      .join("")}</div>`;
    panelBody.querySelectorAll<HTMLElement>(".rg-gallery-item").forEach((el) => {
      el.addEventListener("click", async (e) => {
        if ((e.target as HTMLElement).dataset.delete) return;
        const id = el.dataset.id!;
        const item = (await listGraphics()).find((g) => g.id === id);
        if (item) openDetail(item);
      });
    });
    panelBody.querySelectorAll<HTMLElement>("[data-delete]").forEach((el) => {
      el.addEventListener("click", async (e) => {
        e.stopPropagation();
        await deleteGraphic(el.dataset.delete!);
        await refreshBadge();
        openGallery();
      });
    });
  }
  openPanel();
}

function openDetail(graphic: StoredGraphic) {
  panelBack.hidden = false;
  panelTitle.textContent = graphic.sourceTitle;
  panelBody.innerHTML = renderFullPanel(graphic.response);
  openPanel();
}

panelBack.addEventListener("click", openGallery);

// Escape closes the panel or cancels picking, without interfering with the host page.
document.addEventListener("keydown", (e) => {
  if (e.key !== "Escape") return;
  if (!panel.hidden) closePanel();
  else if (state === "picking") setFabState("idle");
});
