"use strict";

const iconEl = document.getElementById("icon");
const badgeEl = document.getElementById("badge");
const captionEl = document.getElementById("caption");
const openLibEl = document.getElementById("open-lib");

let unseenCount = 0;
let busy = false;
let waking = false;
let queueSize = 0;
let rateLimitUntil = null; // ms epoch, or null when not rate-limited
let rateLimitTimer = null;

function formatCountdown(ms) {
  const totalSec = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  // Kept short deliberately - the caption pill is a small fixed-width
  // element (see #caption in widget.html) and a longer countdown string
  // would just get ellipsis-truncated, defeating the point of showing it.
  return m > 0 ? `retry ~${m}m` : `retry ${s}s`;
}

function setCaption() {
  if (rateLimitUntil) {
    const remaining = rateLimitUntil - Date.now();
    if (remaining > 0) { captionEl.textContent = formatCountdown(remaining); return; }
  }
  if (waking) { captionEl.textContent = "waking up…"; return; }
  if (busy) {
    captionEl.textContent = queueSize > 0 ? `queued ×${queueSize}` : "generating…";
    return;
  }
  captionEl.textContent = "mark passage";
}

function clearRateLimit() {
  rateLimitUntil = null;
  if (rateLimitTimer) { clearInterval(rateLimitTimer); rateLimitTimer = null; }
}

// Mirrors the same condition main.js uses to decide whether a click cancels
// instead of starting a new capture (sending || sendQueue.length > 0) -
// `busy` tracks that exactly, since it's only cleared once the queue is
// truly empty (see onCaptureFinishedIdle).
function updateTitle() {
  iconEl.title = busy ? "Click to cancel" : "Select text, then click";
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
  updateTitle();
});

window.widget.onCaptureFinishedIdle(() => {
  busy = false;
  clearRateLimit();
  iconEl.classList.remove("busy");
  setCaption();
  updateTitle();
});

window.widget.onCaptureError(() => {
  busy = false;
  waking = false;
  clearRateLimit();
  iconEl.classList.remove("busy");
  setCaption();
  updateTitle();
  // The message itself goes out as a native notification (see main.js) -
  // this window is too small to show text reliably, so it just flashes red.
  iconEl.classList.add("error");
  setTimeout(() => iconEl.classList.remove("error"), 1200);
});

window.widget.onQueueSize((n) => {
  queueSize = n;
  setCaption();
});

// A 429 on the shared free-tier Groq quota can mean waits of 15-20+ minutes.
// Without this, that's indistinguishable from a hung app - the icon just
// sits on "queued ×1" with no sense of whether it's stuck or just slow.
window.widget.onRateLimited((retryAfterMs) => {
  clearRateLimit();
  rateLimitUntil = Date.now() + retryAfterMs;
  setCaption();
  rateLimitTimer = setInterval(() => {
    if (!rateLimitUntil || Date.now() >= rateLimitUntil) { clearRateLimit(); setCaption(); return; }
    setCaption();
  }, 1000);
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
