import type Database from 'better-sqlite3'
import { autoCategorizeIfNew } from './categoryRulesRepo'
import type { BrowserEventInput, DesktopEventInput, EventSource, RawEvent } from '../../shared/types'

interface RawEventRow {
  id: number
  source: EventSource
  timestamp: number
  duration_ms: number
  app_name: string
  window_title: string | null
  domain: string | null
  is_idle: number
  ssid: string | null
}

function rowToEvent(row: RawEventRow): RawEvent {
  return {
    id: row.id,
    source: row.source,
    timestamp: row.timestamp,
    durationMs: row.duration_ms,
    appName: row.app_name,
    windowTitle: row.window_title,
    domain: row.domain,
    isIdle: row.is_idle === 1,
    ssid: row.ssid
  }
}

/**
 * Inserts one desktop-tracker poll sample into raw_events.
 * Parameters:
 *     db (Database.Database): open database connection
 *     event (DesktopEventInput): one poll tick captured by the tracking daemon
 * Returns:
 *     void
 */
export function insertDesktopEvent(db: Database.Database, event: DesktopEventInput): void {
  db.prepare(
    `INSERT INTO raw_events (source, timestamp, duration_ms, app_name, window_title, domain, is_idle, ssid)
     VALUES ('desktop', @timestamp, @durationMs, @appName, @windowTitle, NULL, @isIdle, @ssid)`
  ).run({
    timestamp: event.timestamp,
    durationMs: event.durationMs,
    appName: event.appName,
    windowTitle: event.windowTitle,
    isIdle: event.isIdle ? 1 : 0,
    ssid: event.ssid
  })
  autoCategorizeIfNew(db, 'app', event.appName)
}

/**
 * Inserts one browser-extension domain-visit sample into raw_events. The
 * extension only ever reports domain-level detail, so app_name is fixed to
 * a sentinel the aggregation layer recognizes.
 * Parameters:
 *     db (Database.Database): open database connection
 *     event (BrowserEventInput): one tracked interval from the extension
 * Returns:
 *     void
 */
export function insertBrowserEvent(db: Database.Database, event: BrowserEventInput): void {
  db.prepare(
    `INSERT INTO raw_events (source, timestamp, duration_ms, app_name, window_title, domain, is_idle, ssid)
     VALUES ('browser_extension', @timestamp, @durationMs, 'Browser', NULL, @domain, @isIdle, NULL)`
  ).run({
    timestamp: event.timestamp,
    durationMs: event.durationMs,
    domain: event.domain,
    isIdle: event.isIdle ? 1 : 0
  })
  autoCategorizeIfNew(db, 'domain', event.domain)
}

/**
 * Fetches raw events within [startMs, endMs), ordered by timestamp.
 * Parameters:
 *     db (Database.Database): open database connection
 *     startMs (number): inclusive range start, unix ms
 *     endMs (number): exclusive range end, unix ms
 * Returns:
 *     events (RawEvent[]): matching raw events, oldest first
 */
export function getRawEventsInRange(db: Database.Database, startMs: number, endMs: number): RawEvent[] {
  const rows = db
    .prepare(
      `SELECT * FROM raw_events WHERE timestamp >= ? AND timestamp < ? ORDER BY timestamp ASC`
    )
    .all(startMs, endMs) as RawEventRow[]
  return rows.map(rowToEvent)
}

/**
 * Returns the most recent desktop-source event, if any. Used to show "last
 * seen" tracking status in the UI.
 * Parameters:
 *     db (Database.Database): open database connection
 * Returns:
 *     event (RawEvent | null): the latest desktop event, or null if none exist
 */
export function getLatestDesktopEvent(db: Database.Database): RawEvent | null {
  const row = db
    .prepare(`SELECT * FROM raw_events WHERE source = 'desktop' ORDER BY timestamp DESC LIMIT 1`)
    .get() as RawEventRow | undefined
  return row ? rowToEvent(row) : null
}
