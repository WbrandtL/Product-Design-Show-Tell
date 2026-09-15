"use strict";

const { app, ipcMain, clipboard, globalShortcut, Menu, dialog, Notification } = require("electron");
const http = require("http");
const https = require("https");
const fs = require("fs");

const backend = require("./lib/backend");
const library = require("./lib/library");
const { captureSelection, getFrontmostAppName } = require("./lib/selection");
const { createWidgetWindow, createModalWindow } = require("./lib/windows");

const CAPTURE_SHORTCUT = "CommandOrControl+Shift+G";

// Without this, double-clicking the app (or the DMG's mounted copy) a second
// time while it's already running spawns a fully independent process - a
// second floating icon stacked exactly on top of the first, competing for
// the same global shortcut, with its own separate (and possibly stale)
// state. A click can land on whichever one happens to be on top, and
// quitting one leaves the other running, so macOS still reports the app as
// open. Refusing the second launch and focusing the existing instance
// instead avoids all of that.
const gotSingleInstanceLock = app.requestSingleInstanceLock();
if (!gotSingleInstanceLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (widgetWin) {
      widgetWin.show();
      widgetWin.focus();
    }
  });
}

// Last line of defense: an unhandled rejection anywhere must never leave the
// widget stuck in its busy state with no way to recover short of a restart.
process.on("unhandledRejection", (err) => {
  console.error("Unhandled rejection:", err);
  if (widgetWin) {
    sending = false;
    widgetWin.webContents.send("capture-error", `Unexpected error: ${err && err.message ? err.message : err}`);
  }
});
const REQUEST_TIMEOUT_MS = 40000;
// Minimum gap between backend sends, so a burst of clicks/hotkeys doesn't
// fire concurrent requests - see the queue below.
const MIN_SEND_SPACING_MS = 3000;

let widgetWin = null;
let modalWin = null;
let backendBaseUrl = null;
let backendReadyPromise = Promise.resolve();

/**
 * Sleeps for the given number of milliseconds.
 * @param {number} ms
 * @returns {Promise<void>}
 */
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Resolves the current retry-wait early, if one is in progress - set by
// cancelableSleep() while it's pending, cleared once it settles either way.
let cancelRetrySleep = null;

/**
 * Like sleep(), but cancelQueue() can resolve it early - used for the 429
 * retry-after wait, which can be 15-20+ minutes on the shared free tier, so
 * a click on the icon needs to be able to interrupt it immediately.
 * @param {number} ms
 * @returns {Promise<void>}
 */
function cancelableSleep(ms) {
  return new Promise((resolve) => {
    const id = setTimeout(() => {
      cancelRetrySleep = null;
      resolve();
    }, ms);
    cancelRetrySleep = () => {
      clearTimeout(id);
      cancelRetrySleep = null;
      resolve();
    };
  });
}

/**
 * Makes a JSON POST request against the local gist-backend. Never hangs
 * indefinitely - rejects on timeout so a stuck request can't leave the
 * widget spinning forever.
 * @param {string} pathName the request path, e.g. "/api/explain"
 * @param {object} body the JSON body to send
 * @param {number} [timeoutMs]
 * @returns {Promise<{status: number, json: object}>}
 */
function postJson(pathName, body, timeoutMs = REQUEST_TIMEOUT_MS) {
  return new Promise((resolve, reject) => {
    const data = Buffer.from(JSON.stringify(body), "utf-8");
    const client = backendBaseUrl.startsWith("https:") ? https : http;
    const req = client.request(
      `${backendBaseUrl}${pathName}`,
      { method: "POST", headers: { "Content-Type": "application/json", "Content-Length": data.length } },
      (res) => {
        let raw = "";
        res.on("data", (chunk) => (raw += chunk));
        res.on("end", () => {
          try {
            resolve({ status: res.statusCode, json: JSON.parse(raw) });
          } catch (e) {
            resolve({ status: res.statusCode, json: { detail: raw || "Empty response from backend." } });
          }
        });
      }
    );
    req.setTimeout(timeoutMs, () => req.destroy(new Error(`Timed out after ${timeoutMs}ms`)));
    req.on("error", reject);
    req.write(data);
    req.end();
  });
}

// --- Selection grabbing is serialized (clipboard save/restore would race if
// two captures overlapped); sending to the backend is queued separately with
// spacing, so a burst of captures doesn't fire concurrent Groq calls. ---
let selectionLock = Promise.resolve();
function grabSelectionSerialized(targetAppName) {
  const p = selectionLock.then(() => captureSelection(clipboard, targetAppName));
  selectionLock = p.then(() => {}, () => {});
  return p;
}

const sendQueue = []; // { text }
let sending = false;
let lastSendAt = 0;

/**
 * Pushes the widget's current busy/queued state to the renderer.
 * @returns {void}
 */
function pushState() {
  if (!widgetWin) return;
  widgetWin.webContents.send(sending || sendQueue.length ? "capture-started" : "capture-finished-idle");
  widgetWin.webContents.send("queue-size", sendQueue.length);
}

/**
 * Drains the send queue one item at a time, with a minimum spacing between
 * requests and 429-aware backoff (a rate-limited item is re-queued and
 * retried after the server's Retry-After, rather than dropped).
 * @returns {Promise<void>}
 */
async function processQueue() {
  if (sending || sendQueue.length === 0) return;
  sending = true;
  pushState();

  const wait = Math.max(0, MIN_SEND_SPACING_MS - (Date.now() - lastSendAt));
  if (wait > 0) await sleep(wait);

  const { text } = sendQueue.shift();
  lastSendAt = Date.now();

  let record = null;
  let retryAfterMs = null;
  try {
    try {
      const { status, json } = await postJson("/api/explain", { passage: text });
      if (status === 200) {
        record = library.save({ passage: text, response: json, error: null });
      } else if (status === 429) {
        const m = /retry after (\d+)/i.exec(typeof json.detail === "string" ? json.detail : "");
        retryAfterMs = (m ? parseInt(m[1], 10) : 15) * 1000;
        sendQueue.unshift({ text }); // put it back at the front, try again after the wait
        // Silent otherwise: a multi-minute wait (the shared free-tier Groq
        // quota can report waits of 15-20+ minutes under heavy use) looks
        // identical to a hung app without this - the icon just sits queued
        // with no indication anything is happening, let alone how long it'll
        // take. This is the single most common source of "it's stuck" reports.
        const mins = Math.max(1, Math.round(retryAfterMs / 60000));
        if (widgetWin) widgetWin.webContents.send("rate-limited", retryAfterMs);
        new Notification({
          title: "Groq's free tier is rate-limited right now",
          body: `Gist will retry automatically in about ${mins} minute${mins === 1 ? "" : "s"} - no need to click again.`,
          silent: true,
        }).show();
      } else {
        const detail = typeof json.detail === "string" ? json.detail : JSON.stringify(json.detail);
        record = library.save({ passage: text, response: null, error: detail, httpStatus: status });
      }
    } catch (err) {
      record = library.save({ passage: text, response: null, error: `Couldn't reach the backend: ${err.message}`, httpStatus: null });
    }

    if (record) {
      if (widgetWin) widgetWin.webContents.send("badge", library.unseenCount());
      if (modalWin) modalWin.webContents.send("library-changed");
      const hasFigure = record.response && record.response.figures && record.response.figures.length > 0;
      const notif = hasFigure
        ? new Notification({ title: record.response.figures[0].verbal_summary, body: "Click the floating icon to view it." })
        : record.response
        ? new Notification({ title: "Nothing worth drawing here", body: "This selection didn't need a figure — click the icon to see why." })
        : new Notification({ title: "Couldn't diagram that selection", body: record.error });
      notif.on("click", openLibrary);
      notif.show();
    }
  } catch (err) {
    // Defense in depth: nothing above this point should be able to throw
    // past this, but if it somehow does, the queue still has to recover.
    console.error("processQueue item failed unexpectedly:", err);
  } finally {
    sending = false;
    pushState();
  }

  if (retryAfterMs) {
    await cancelableSleep(retryAfterMs);
  }
  if (sendQueue.length) processQueue();
}

/**
 * Stops whatever's queued or being waited on - drops any not-yet-sent
 * passages and, if a 429 retry-wait is in progress, cuts it short instead of
 * letting it run out. Silent by design: a cancelled capture just disappears
 * rather than leaving a "cancelled" entry in the library. Doesn't interrupt
 * a request already in flight to the backend - that one's already been sent
 * and will complete normally if it succeeds; this only stops what comes
 * after it.
 * @returns {void}
 */
function cancelQueue() {
  sendQueue.length = 0;
  if (cancelRetrySleep) cancelRetrySleep();
  pushState();
}

/**
 * Runs one capture: grabs the current selection and enqueues it for sending.
 * Safe to call in rapid succession - captures queue rather than racing.
 * @returns {Promise<void>}
 */
async function runCapture() {
  if (!widgetWin) return;
  await backendReadyPromise;
  try {
    // Snapshot which app to target as early as possible - by the time this
    // runs, a click on our own icon (if that's what triggered us) is already
    // done, so this reliably reflects the app the user meant to copy from.
    const targetAppName = await getFrontmostAppName();
    const { text, error: selectionError } = await grabSelectionSerialized(targetAppName);
    if (selectionError) {
      widgetWin.webContents.send("capture-error", selectionError);
      new Notification({ title: "Gist", body: selectionError, silent: true }).show();
      return;
    }
    sendQueue.push({ text });
    pushState();
    processQueue();
  } catch (err) {
    // Whatever else could go wrong here, the widget must never end up stuck
    // spinning with no way out short of a restart.
    console.error("runCapture failed unexpectedly:", err);
    widgetWin.webContents.send("capture-error", `Unexpected error: ${err.message || err}`);
  }
}

/**
 * Shows the library/modal window, marking every stored record as seen.
 * @returns {void}
 */
function openLibrary() {
  library.markAllSeen();
  if (widgetWin) widgetWin.webContents.send("badge", 0);
  if (modalWin) {
    modalWin.webContents.send("library-changed");
    modalWin.show();
    modalWin.focus();
  }
}

/**
 * Builds and shows the widget's right-click context menu.
 * @returns {void}
 */
function showWidgetContextMenu() {
  const menu = Menu.buildFromTemplate([
    { label: "Open Library", click: openLibrary },
    { label: "Capture Selection Now", accelerator: CAPTURE_SHORTCUT, click: runCapture },
    { type: "separator" },
    { label: "Quit Gist", role: "quit" },
  ]);
  menu.popup();
}

app.whenReady().then(async () => {
  // app.quit() (called above when the lock wasn't acquired) doesn't halt
  // execution synchronously, so without this a losing second instance could
  // still reach here and create its own competing windows before the quit
  // actually takes effect.
  if (!gotSingleInstanceLock) return;

  if (process.platform === "darwin") app.dock.hide();

  library.init(app.getPath("userData"));

  // Registered before the windows are created so the modal's own on-load
  // fetch can never race ahead of handler registration.
  // A click while something's queued or being retried stops it instead of
  // starting a new capture - the icon doubles as a cancel button whenever
  // it's showing anything other than its idle state.
  ipcMain.on("widget-click", () => {
    if (sending || sendQueue.length > 0) {
      cancelQueue();
    } else {
      runCapture();
    }
  });
  ipcMain.on("widget-context-menu", showWidgetContextMenu);
  ipcMain.on("open-library", openLibrary);
  ipcMain.handle("get-library", () => library.list());
  ipcMain.handle("delete-graphic", (_e, id) => library.remove(id));
  ipcMain.handle("get-backend-status", () => backend.isAlive(backendBaseUrl || undefined));

  ipcMain.handle("regenerate", async (_e, id) => {
    const rec = library.list().find((r) => r.id === id);
    if (!rec) return null;
    await backendReadyPromise;
    try {
      const { status: httpStatus, json } = await postJson("/api/explain", { passage: rec.passage, force: true });
      if (httpStatus === 200) {
        return library.update(id, { response: json, error: null, httpStatus: 200 });
      }
      const detail = typeof json.detail === "string" ? json.detail : JSON.stringify(json.detail);
      return library.update(id, { response: null, error: detail, httpStatus });
    } catch (err) {
      return library.update(id, { response: null, error: `Couldn't reach the backend: ${err.message}`, httpStatus: null });
    }
  });

  ipcMain.handle("export-card-image", async (_e, { rect, mode }) => {
    if (!modalWin) return { ok: false, error: "No window to capture." };
    const image = await modalWin.webContents.capturePage(rect);
    if (mode === "copy") {
      await clipboard.writeImage(image);
      return { ok: true };
    }
    const { canceled, filePath } = await dialog.showSaveDialog(modalWin, {
      defaultPath: `reading-graphic-${Date.now()}.png`,
      filters: [{ name: "PNG Image", extensions: ["png"] }],
    });
    if (canceled || !filePath) return { ok: false, error: null };
    fs.writeFileSync(filePath, image.toPNG());
    return { ok: true, filePath };
  });

  widgetWin = createWidgetWindow();
  modalWin = createModalWindow();

  // The page's own IPC listeners aren't registered until it finishes loading,
  // so a send() fired right after createWidgetWindow() can arrive before
  // anyone is listening and get silently dropped. Track the state here and
  // replay it once the page is actually ready, the same way badge count is.
  let backendState = "waking";
  widgetWin.webContents.once("did-finish-load", () => {
    widgetWin.webContents.send("badge", library.unseenCount());
    if (backendState === "ready") widgetWin.webContents.send("backend-ready");
    else if (backendState === "waking") widgetWin.webContents.send("backend-waking");
    // an "error" state was already delivered via capture-error when it happened
  });

  // The icon must appear immediately - a reviewer double-clicking the app
  // should see it launch right away, not stare at nothing for up to 45s
  // while a cold-started hosted backend wakes up. So the backend check runs
  // after the windows exist, not before, with its own "waking up" indicator;
  // runCapture()/regenerate() await this same promise instead of racing it.
  backendReadyPromise = (async () => {
    const status = await backend.ensureBackend();
    backendBaseUrl = status.baseUrl;
    if (status.error) {
      backendState = "error";
      if (widgetWin) widgetWin.webContents.send("capture-error", status.error);
    } else {
      backendState = "ready";
      if (widgetWin) widgetWin.webContents.send("backend-ready");
    }
    return status;
  })();

  globalShortcut.register(CAPTURE_SHORTCUT, runCapture);
});

app.on("window-all-closed", (e) => e.preventDefault());

app.on("before-quit", () => {
  // Read by the library window's close handler (lib/windows.js) so it can
  // tell "the app is quitting, let this window actually close" apart from
  // "the user just closed this one window, hide it instead" - without this
  // distinction the app could never quit at all (see the comment there).
  app.isQuittingApp = true;
  globalShortcut.unregisterAll();
  backend.stopBackend();
});
