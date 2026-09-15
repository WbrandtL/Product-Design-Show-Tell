"use strict";

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

let dir = null;

/**
 * Points the library at a directory (called once at startup with app.getPath("userData")).
 * @param {string} userDataDir
 * @returns {void}
 */
function init(userDataDir) {
  dir = path.join(userDataDir, "library");
  fs.mkdirSync(dir, { recursive: true });
}

/**
 * Lists all stored graphics, newest first.
 * @returns {Array<object>} the stored records
 */
function list() {
  const files = fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .sort()
    .reverse();
  return files.map((f) => JSON.parse(fs.readFileSync(path.join(dir, f), "utf-8")));
}

/**
 * Saves a new graphic record to the library.
 * @param {{passage: string, context: string|null, response: object|null, error: string|null}} entry
 * @returns {object} the stored record, including its generated id and createdAt
 */
function save(entry) {
  const id = crypto.randomUUID();
  const record = { id, createdAt: new Date().toISOString(), seen: false, ...entry };
  fs.writeFileSync(path.join(dir, `${record.createdAt.replace(/[:.]/g, "-")}-${id}.json`), JSON.stringify(record, null, 2));
  return record;
}

/**
 * Overwrites an existing record (used after a regenerate call).
 * @param {string} id
 * @param {object} patch fields to merge into the stored record
 * @returns {object|null} the updated record, or null if the id wasn't found
 */
function update(id, patch) {
  const files = fs.readdirSync(dir).filter((f) => f.endsWith(`-${id}.json`));
  if (files.length === 0) return null;
  const file = path.join(dir, files[0]);
  const record = { ...JSON.parse(fs.readFileSync(file, "utf-8")), ...patch };
  fs.writeFileSync(file, JSON.stringify(record, null, 2));
  return record;
}

/**
 * Deletes a stored graphic by id.
 * @param {string} id
 * @returns {boolean} true if a file was removed
 */
function remove(id) {
  const files = fs.readdirSync(dir).filter((f) => f.endsWith(`-${id}.json`));
  files.forEach((f) => fs.unlinkSync(path.join(dir, f)));
  return files.length > 0;
}

/**
 * Marks every stored record as seen (called when the library is opened).
 * @returns {void}
 */
function markAllSeen() {
  fs.readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .forEach((f) => {
      const p = path.join(dir, f);
      const record = JSON.parse(fs.readFileSync(p, "utf-8"));
      if (!record.seen) {
        record.seen = true;
        fs.writeFileSync(p, JSON.stringify(record, null, 2));
      }
    });
}

/**
 * Counts unseen records, for the widget's badge.
 * @returns {number}
 */
function unseenCount() {
  return list().filter((r) => !r.seen).length;
}

module.exports = { init, list, save, update, remove, markAllSeen, unseenCount };
