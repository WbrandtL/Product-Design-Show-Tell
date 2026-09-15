"use strict";

const { execFile } = require("child_process");
const { promisify } = require("util");
const execFileAsync = promisify(execFile);

const SENTINEL_PREFIX = "gist-sentinel-";

/**
 * Escapes a string for safe interpolation inside a double-quoted AppleScript
 * string literal.
 * @param {string} s
 * @returns {string}
 */
function asQuoted(s) {
  return String(s).replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

/**
 * Asks System Events for the name of the frontmost application's process.
 * @returns {Promise<string|null>} the app name, or null if it couldn't be determined
 */
async function getFrontmostAppName() {
  try {
    const { stdout } = await execFileAsync("osascript", [
      "-e",
      'tell application "System Events" to name of first process whose frontmost is true',
    ]);
    return stdout.trim() || null;
  } catch {
    return null;
  }
}

/**
 * Re-activates the given app (if any) and then simulates Cmd+C, as one
 * AppleScript call. Re-activating immediately before the keystroke matters:
 * clicking our own window can transiently disturb which app is receiving
 * keyboard events even when it never shows up as a frontmost-app change on
 * either side of the click (confirmed empirically - triggering a capture via
 * a native menu item, which never touches our window's content view at all,
 * works instantly every time, while a raw click on our BrowserWindow does
 * not) - explicitly re-asserting the target app right before the keystroke
 * is the reliable fix for that, regardless of the exact underlying cause.
 * Requires the app to be granted Accessibility permission in System Settings
 * > Privacy & Security > Accessibility.
 * @param {string|null} targetAppName app to reactivate first, if known
 * @returns {Promise<void>}
 */
async function sendCopyKeystroke(targetAppName) {
  const activate = targetAppName ? `tell application "${asQuoted(targetAppName)}" to activate\n` : "";
  const script = `${activate}tell application "System Events" to keystroke "c" using command down`;
  await execFileAsync("osascript", ["-e", script]);
}

/**
 * Sleeps for the given number of milliseconds.
 * @param {number} ms
 * @returns {Promise<void>}
 */
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// This Electron version's clipboard.readText()/writeText() are asynchronous
// (resolve to/return a Promise), not the traditionally-synchronous API - an
// unawaited call here previously produced a Promise object where a string
// was expected everywhere downstream, which is why every read silently came
// back empty regardless of what was actually on the clipboard, and why an
// unresolved Promise passed to writeText() once threw a "conversion failure"
// TypeError that left the widget stuck in its busy state forever. Every
// clipboard call is awaited and the result type-checked - this function must
// always resolve to {text, error}, never throw.
async function safeReadText(clipboard) {
  try {
    const v = await clipboard.readText();
    return typeof v === "string" ? v : "";
  } catch {
    return "";
  }
}
async function safeWriteText(clipboard, text) {
  try {
    await clipboard.writeText(typeof text === "string" ? text : "");
  } catch {
    // Best-effort restore; nothing more we can do if even this fails.
  }
}

/**
 * Captures whatever text is currently selected in the frontmost application,
 * by writing a sentinel to the clipboard, simulating Cmd+C, and polling for
 * the clipboard to change. The user's original clipboard contents are
 * restored afterwards either way.
 * @param {Electron.Clipboard} clipboard the Electron clipboard module
 * @param {string|null} [targetAppName] the app to make sure is frontmost
 *   immediately before sending the keystroke (see sendCopyKeystroke)
 * @returns {Promise<{text: string|null, error: string|null}>}
 */
async function captureSelection(clipboard, targetAppName = null) {
  try {
    if (process.platform !== "darwin") {
      return { text: null, error: "System-wide selection capture is only implemented for macOS." };
    }

    const previousText = await safeReadText(clipboard);
    const sentinel = `${SENTINEL_PREFIX}${Date.now()}`;
    await safeWriteText(clipboard, sentinel);

    try {
      await sendCopyKeystroke(targetAppName);
    } catch (err) {
      await safeWriteText(clipboard, previousText);
      return {
        text: null,
        error:
          "Couldn't send Cmd+C to the frontmost app. Gist needs Accessibility " +
          "permission: System Settings → Privacy & Security → Accessibility, then " +
          "enable Gist (or your terminal, in development). " + String(err.message || err),
      };
    }

    let text = null;
    for (let i = 0; i < 20; i++) {
      await sleep(60);
      const current = await safeReadText(clipboard);
      if (current && current !== sentinel) {
        text = current;
        break;
      }
    }

    await safeWriteText(clipboard, previousText);

    if (!text) {
      return { text: null, error: "Nothing seemed to be selected — select some text first, then try again." };
    }
    return { text, error: null };
  } catch (err) {
    // Belt and braces: whatever goes wrong here, the caller still gets a
    // resolved result instead of an unhandled rejection that leaves the
    // widget spinning with no way to recover short of a restart.
    return { text: null, error: `Unexpected error capturing the selection: ${err.message || err}` };
  }
}

module.exports = { captureSelection, getFrontmostAppName };
