import type Database from 'better-sqlite3'
import type { SsidLabel } from '../../shared/types'

/**
 * Returns every user-defined SSID -> label mapping.
 * Parameters:
 *     db (Database.Database): open database connection
 * Returns:
 *     labels (SsidLabel[]): all labeled SSIDs
 */
export function getAllSsidLabels(db: Database.Database): SsidLabel[] {
  return db.prepare(`SELECT ssid, label FROM ssid_labels ORDER BY label`).all() as SsidLabel[]
}

/**
 * Creates or updates the label for a given SSID.
 * Parameters:
 *     db (Database.Database): open database connection
 *     ssid (string): the Wi-Fi network name to label
 *     label (string): user-facing label, e.g. "Home"
 * Returns:
 *     void
 */
export function setSsidLabel(db: Database.Database, ssid: string, label: string): void {
  db.prepare(
    `INSERT INTO ssid_labels (ssid, label) VALUES (?, ?)
     ON CONFLICT (ssid) DO UPDATE SET label = excluded.label`
  ).run(ssid, label)
}

/**
 * Removes a label for an SSID, letting it fall back to the default location.
 * Parameters:
 *     db (Database.Database): open database connection
 *     ssid (string): the Wi-Fi network name to unlabel
 * Returns:
 *     void
 */
export function deleteSsidLabel(db: Database.Database, ssid: string): void {
  db.prepare(`DELETE FROM ssid_labels WHERE ssid = ?`).run(ssid)
}

/**
 * Returns the distinct SSIDs seen in raw_events that do not yet have a
 * user-defined label, so the settings screen can prompt for them.
 * Parameters:
 *     db (Database.Database): open database connection
 * Returns:
 *     ssids (string[]): unlabeled SSIDs observed while tracking
 */
export function getUnlabeledObservedSsids(db: Database.Database): string[] {
  const rows = db
    .prepare(
      `SELECT DISTINCT r.ssid AS ssid
       FROM raw_events r
       LEFT JOIN ssid_labels s ON s.ssid = r.ssid
       WHERE r.ssid IS NOT NULL AND s.ssid IS NULL`
    )
    .all() as Array<{ ssid: string }>
  return rows.map((r) => r.ssid)
}
