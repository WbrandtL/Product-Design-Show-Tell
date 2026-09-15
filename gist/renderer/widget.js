"use strict";

const iconEl = document.getElementById("icon");
const badgeEl = document.getElementById("badge");
const captionEl = document.getElementById("caption");
const openLibEl = document.getElementById("open-lib");

let unseenCount = 0;
let busy = false;
let waking = false;

function setCaption() {
  if (waking) { captionEl.textContent = "waking up…"; return; }
  if (busy) { captionEl.textContent = "generating…"; return; }
  captionEl.textContent = "mark passage";
}

function setBadge(count) {
  unseenCount = count;
  if (count > 0) {
    badgeEl.textContent = count > 99 ? "99+" : String(count);
    badgeEl.classList.add("show");
    openLibEl.classList.add("show");
  } else {
    badgeEl.classList.remove("show");
    openLibEl.classList.remove("show");
  }
}

iconEl.addEventListener("click", () => window.widget.click());
openLibEl.addEventListener("click", () => window.widget.openLibrary());
iconEl.addEventListener("contextmenu", (e) => {
  e.preventDefault();
  window.widget.contextMenu();
});

window.widget.onCaptureStarted(() => {
  busy = true;
  iconEl.classList.add("busy");
  setCaption();
});

window.widget.onCaptureFinishedIdle(() => {
  busy = false;
  iconEl.classList.remove("busy");
  setCaption();
});

window.widget.onCaptureError(() => {
  busy = false;
  waking = false;
  iconEl.classList.remove("busy");
  setCaption();
  // The message itself goes out as a native notification (see main.js) -
  // this window is too small to show text reliably, so it just flashes red.
  iconEl.classList.add("error");
  setTimeout(() => iconEl.classList.remove("error"), 1200);
});

window.widget.onQueueSize((n) => {
  if (n > 0 && busy) captionEl.textContent = `queued ×${n}`;
});

window.widget.onBackendWaking(() => {
  waking = true;
  iconEl.classList.add("busy");
  setCaption();
});

window.widget.onBackendReady(() => {
  waking = false;
  iconEl.classList.remove("busy");
  setCaption();
});

window.widget.onBadge((count) => setBadge(count));

setCaption();
