"use strict";

const path = require("path");
const { app, BrowserWindow, screen } = require("electron");

// Deliberately small and fully interactive, no click-through. An earlier
// version made a larger window mostly click-through and toggled it live on
// hover, but that toggle is a real race against a fast click - the window
// could still be in "ignore mouse events" mode at the instant a click lands,
// letting it fall straight through to whatever app is behind it. A small
// fixed hit-region that's always interactive has no such race, at the cost
// of a small always-there click-blocking area in the corner - the same
// trade-off any persistent screen-corner utility makes.
const WIDGET_WIDTH = 130;
const WIDGET_HEIGHT = 104;
const WIDGET_MARGIN = 0;

/**
 * Creates the persistent, always-on-top floating icon window, pinned to the
 * vertical center of the right edge of the primary display.
 * @returns {Electron.BrowserWindow}
 */
function createWidgetWindow() {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;
  const win = new BrowserWindow({
    width: WIDGET_WIDTH,
    height: WIDGET_HEIGHT,
    x: width - WIDGET_WIDTH - WIDGET_MARGIN,
    y: Math.round((height - WIDGET_HEIGHT) / 2),
    frame: false,
    transparent: true,
    resizable: false,
    movable: false,
    hasShadow: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    fullscreenable: false,
    // Critical on macOS: a normal window becomes the frontmost app AND takes
    // keyboard focus (key window) when clicked, which would steal both
    // frontmost-app status and keyboard routing away from whatever app
    // actually has the text selection - so the simulated Cmd+C would copy
    // nothing from there, it would go to us instead. `type: "panel"` keeps
    // it from becoming the active application; `focusable: false` keeps it
    // from ever becoming key window, so keyboard events keep going to the
    // real target app even while a click on the icon is being handled.
    ...(process.platform === "darwin" ? { type: "panel" } : {}),
    focusable: false,
    webPreferences: {
      preload: path.join(__dirname, "..", "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  win.setAlwaysOnTop(true, "screen-saver");
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  win.loadFile(path.join(__dirname, "..", "renderer", "widget.html"));
  return win;
}

/**
 * Creates the larger library/result window, centered on the primary display.
 * Hidden rather than destroyed on close so state (scroll position etc.)
 * persists between openings; call .show() to reveal it again.
 * @returns {Electron.BrowserWindow}
 */
function createModalWindow() {
  const win = new BrowserWindow({
    width: 860,
    height: 760,
    minWidth: 620,
    minHeight: 480,
    show: false,
    frame: false,
    titleBarStyle: "hiddenInset",
    backgroundColor: "#EBE5DD",
    webPreferences: {
      preload: path.join(__dirname, "..", "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  win.loadFile(path.join(__dirname, "..", "renderer", "modal.html"));
  win.on("close", (e) => {
    // Without the isQuittingApp check, this unconditionally blocks the app
    // from ever quitting: macOS's normal quit sequence (Activity Monitor's
    // Quit, Cmd+Q, the Dock menu, `osascript -e 'tell application "Gist" to
    // quit'`) closes every window in turn, and preventDefault()-ing this
    // one's close - with no way to distinguish "just this window" from "the
    // whole app is quitting" - stalls that sequence forever. Confirmed by
    // direct reproduction: neither a graceful quit request nor SIGTERM
    // terminated the process while this was unconditional.
    if (app.isQuittingApp) return;
    e.preventDefault();
    win.hide();
  });
  return win;
}

module.exports = { createWidgetWindow, createModalWindow };
