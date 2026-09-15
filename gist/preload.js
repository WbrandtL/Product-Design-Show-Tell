"use strict";

const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("widget", {
  click: () => ipcRenderer.send("widget-click"),
  contextMenu: () => ipcRenderer.send("widget-context-menu"),
  openLibrary: () => ipcRenderer.send("open-library"),
  onCaptureStarted: (cb) => ipcRenderer.on("capture-started", cb),
  onCaptureFinishedIdle: (cb) => ipcRenderer.on("capture-finished-idle", cb),
  onCaptureError: (cb) => ipcRenderer.on("capture-error", (_e, message) => cb(message)),
  onBadge: (cb) => ipcRenderer.on("badge", (_e, count) => cb(count)),
  onQueueSize: (cb) => ipcRenderer.on("queue-size", (_e, n) => cb(n)),
  onBackendWaking: (cb) => ipcRenderer.on("backend-waking", cb),
  onBackendReady: (cb) => ipcRenderer.on("backend-ready", cb),
  onRateLimited: (cb) => ipcRenderer.on("rate-limited", (_e, retryAfterMs) => cb(retryAfterMs)),
});

contextBridge.exposeInMainWorld("library", {
  list: () => ipcRenderer.invoke("get-library"),
  delete: (id) => ipcRenderer.invoke("delete-graphic", id),
  regenerate: (id) => ipcRenderer.invoke("regenerate", id),
  exportCardImage: (rect, mode) => ipcRenderer.invoke("export-card-image", { rect, mode }),
  backendStatus: () => ipcRenderer.invoke("get-backend-status"),
  onChanged: (cb) => ipcRenderer.on("library-changed", cb),
});
