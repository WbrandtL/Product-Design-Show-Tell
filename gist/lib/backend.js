"use strict";

const { app } = require("electron");
const { spawn } = require("child_process");
const http = require("http");
const https = require("https");
const path = require("path");
const fs = require("fs");

const PORT = 8731;
const BASE_URL = `http://127.0.0.1:${PORT}`;

// Set once the backend is deployed for review (see gist-backend/DEPLOY.md).
// A packaged (.app) build always talks to this hosted backend instead of
// spawning a local Python process - a reviewer's machine has no venv, no
// Groq key, and shouldn't need either. `npm start` (dev mode) is unaffected:
// it still spawns/reuses a local backend, unless GIST_BACKEND_URL is set.
const HOSTED_BACKEND_URL = "https://designtask1.onrender.com";

// Packaged (.app) and unpacked (`electron .`) runs resolve __dirname
// differently, and a packaged app's Resources dir isn't next to the actual
// gist-backend project on disk. This is a personal-machine dev fallback,
// not something meant to be redistributed, so trying a short list of
// plausible locations - ending in this machine's known dev path - is a
// reasonable, honest shortcut rather than building full asset bundling for a
// Python venv. Distributed builds should use HOSTED_BACKEND_URL instead.
const CANDIDATE_BACKEND_DIRS = [
  path.join(__dirname, "..", "..", "gist-backend"),
  path.join(process.resourcesPath || "", "gist-backend"),
  "/Users/macbookvonluis/Documents/Code/timeaware/gist-backend",
];

function findBackendDir() {
  return CANDIDATE_BACKEND_DIRS.find((dir) => fs.existsSync(path.join(dir, ".venv", "bin", "uvicorn"))) || CANDIDATE_BACKEND_DIRS[0];
}

const BACKEND_DIR = findBackendDir();
const UVICORN_BIN = path.join(BACKEND_DIR, ".venv", "bin", "uvicorn");

let child = null;

// A GIST_BACKEND_URL env var always wins (handy for testing a hosted deploy
// from a dev run without rebuilding). Otherwise only a packaged build uses
// HOSTED_BACKEND_URL - `npm start` (dev mode) keeps spawning/reusing a local
// process on BASE_URL, so local backend development doesn't need this file
// touched again every time.
function resolveRemoteUrl() {
  if (process.env.GIST_BACKEND_URL) return process.env.GIST_BACKEND_URL;
  if (app.isPackaged) return HOSTED_BACKEND_URL || null;
  return null;
}

/**
 * Checks whether something is already answering /healthz at the given
 * base URL (defaults to the local dev port).
 * @param {string} [baseUrl]
 * @returns {Promise<boolean>} true if a live backend responds
 * @param {number} [timeout] ms to wait before giving up
 */
function isAlive(baseUrl = BASE_URL, timeout = 1200) {
  return new Promise((resolve) => {
    const client = baseUrl.startsWith("https:") ? https : http;
    const req = client.get(`${baseUrl}/healthz`, { timeout }, (res) => {
      res.resume();
      resolve(res.statusCode === 200);
    });
    req.on("error", () => resolve(false));
    req.on("timeout", () => {
      req.destroy();
      resolve(false);
    });
  });
}

/**
 * Waits, polling isAlive(), until the backend responds or the timeout elapses.
 * @param {number} timeoutMs
 * @param {string} [baseUrl]
 * @returns {Promise<boolean>}
 */
function waitUntilAlive(timeoutMs, baseUrl = BASE_URL) {
  const start = Date.now();
  return new Promise((resolve) => {
    const tick = async () => {
      if (await isAlive(baseUrl, 4000)) return resolve(true);
      if (Date.now() - start > timeoutMs) return resolve(false);
      setTimeout(tick, 1000);
    };
    tick();
  });
}

/**
 * Ensures a gist-backend is reachable. A hosted URL (GIST_BACKEND_URL, or
 * HOSTED_BACKEND_URL in a packaged build) is used as-is and never spawned -
 * that's how a distributed build reaches its backend without a reviewer
 * needing Python at all. Otherwise, reuses an already-running local instance
 * (e.g. one started manually with --reload for development) if found, and
 * spawns the bundled venv's uvicorn otherwise.
 * @returns {Promise<{baseUrl: string, spawned: boolean, error: string|null}>}
 */
async function ensureBackend() {
  const remote = resolveRemoteUrl();
  if (remote) {
    // Free-tier hosts can cold-start from sleep, so give this a generous
    // window rather than the 15s used for a local spawn.
    const ok = await waitUntilAlive(45000, remote);
    return {
      baseUrl: remote,
      spawned: false,
      error: ok ? null : `Hosted backend at ${remote} did not respond within 45s.`,
    };
  }

  if (await isAlive(BASE_URL)) {
    return { baseUrl: BASE_URL, spawned: false, error: null };
  }

  if (!fs.existsSync(UVICORN_BIN)) {
    return {
      baseUrl: BASE_URL,
      spawned: false,
      error: `No gist-backend virtualenv found at ${UVICORN_BIN}. Run "python3.11 -m venv .venv && .venv/bin/pip install -r requirements.txt" inside gist-backend/ first.`,
    };
  }

  child = spawn(UVICORN_BIN, ["app.main:app", "--port", String(PORT)], {
    cwd: BACKEND_DIR,
    stdio: ["ignore", "pipe", "pipe"],
  });
  child.stdout.on("data", (d) => process.stdout.write(`[backend] ${d}`));
  child.stderr.on("data", (d) => process.stderr.write(`[backend] ${d}`));
  child.on("exit", (code) => {
    console.log(`[backend] exited with code ${code}`);
    child = null;
  });

  const ok = await waitUntilAlive(15000);
  return {
    baseUrl: BASE_URL,
    spawned: true,
    error: ok ? null : "gist-backend did not become healthy within 15s",
  };
}

/**
 * Stops the backend subprocess if this app spawned one.
 * @returns {void}
 */
function stopBackend() {
  if (child) {
    child.kill();
    child = null;
  }
}

module.exports = { ensureBackend, stopBackend, BASE_URL, isAlive };
