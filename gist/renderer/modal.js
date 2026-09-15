"use strict";

let records = [];
let index = 0;

const panelEl = document.getElementById("panel");
const emptyEl = document.getElementById("empty-state");
const cardBodyEl = document.getElementById("card-body");
const chFormEl = document.getElementById("ch-form");
const chBasisEl = document.getElementById("ch-basis");
const cfSourceEl = document.getElementById("cf-source");
const actQuestionEl = document.getElementById("act-question");
const actWhenEl = document.getElementById("act-when");
const navCountEl = document.getElementById("nav-count");
const navPrev = document.getElementById("nav-prev");
const navNext = document.getElementById("nav-next");
const btnRegenerate = document.getElementById("btn-regenerate");
const btnDelete = document.getElementById("btn-delete");
const btnCopy = document.getElementById("btn-copy");
const btnDownload = document.getElementById("btn-download");
const copyLabelEl = document.getElementById("copy-label");

function fmtTime(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" }) + " · " + d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

function render() {
  if (records.length === 0) {
    panelEl.style.display = "none";
    emptyEl.style.display = "flex";
    return;
  }
  emptyEl.style.display = "none";
  panelEl.style.display = "flex";
  index = Math.max(0, Math.min(index, records.length - 1));
  const rec = records[index];

  navCountEl.textContent = `${index + 1} of ${records.length}`;
  navPrev.disabled = index === 0;
  navNext.disabled = index === records.length - 1;
  actWhenEl.textContent = fmtTime(rec.createdAt);

  cfSourceEl.textContent = (rec.passage || "").slice(0, 40) + ((rec.passage || "").length > 40 ? "…" : "");

  if (rec.response) {
    chFormEl.textContent = rec.response.layout_hint.replace(/_/g, " ");
    chBasisEl.textContent = rec.response.passage_pattern.replace(/_/g, " ");
    cardBodyEl.innerHTML = renderFigureDiagram(rec.response);
    actQuestionEl.textContent = "—";
    btnRegenerate.classList.remove("disabled");
    btnCopy.classList.remove("disabled");
    btnDownload.classList.remove("disabled");
  } else {
    chFormEl.textContent = "not diagrammed";
    chBasisEl.textContent = "";
    cardBodyEl.innerHTML = `<p class="card-plain">${(rec.error || "Unknown error.").replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]))}</p>`;
    actQuestionEl.textContent = "—";
    btnRegenerate.classList.remove("disabled");
    btnCopy.classList.add("disabled");
    btnDownload.classList.add("disabled");
  }
}

async function refresh(preserveIndex) {
  const prevId = preserveIndex && records[index] ? records[index].id : null;
  records = await window.library.list();
  if (prevId) {
    const newIdx = records.findIndex((r) => r.id === prevId);
    index = newIdx >= 0 ? newIdx : 0;
  } else {
    index = 0;
  }
  render();
}

navPrev.addEventListener("click", () => { index -= 1; render(); });
navNext.addEventListener("click", () => { index += 1; render(); });

document.getElementById("btn-hide").addEventListener("click", () => window.close());

btnDelete.addEventListener("click", async () => {
  if (!records[index]) return;
  await window.library.delete(records[index].id);
  await refresh(false);
});

btnRegenerate.addEventListener("click", async () => {
  if (!records[index] || btnRegenerate.classList.contains("disabled")) return;
  btnRegenerate.classList.add("disabled");
  await window.library.regenerate(records[index].id);
  await refresh(true);
});

async function exportCard(mode) {
  const rect = document.getElementById("card").getBoundingClientRect();
  const capRect = { x: Math.round(rect.left), y: Math.round(rect.top), width: Math.round(rect.width), height: Math.round(rect.height) };
  const result = await window.library.exportCardImage(capRect, mode);
  if (result.ok && mode === "copy") {
    copyLabelEl.textContent = "copied";
    setTimeout(() => (copyLabelEl.textContent = "copy png"), 1600);
  }
}
btnCopy.addEventListener("click", () => { if (!btnCopy.classList.contains("disabled")) exportCard("copy"); });
btnDownload.addEventListener("click", () => { if (!btnDownload.classList.contains("disabled")) exportCard("download"); });

window.library.onChanged(() => refresh(true));
refresh(false);
