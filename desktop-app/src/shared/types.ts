/**
 * Types shared across the main process, preload bridge, and renderer UI.
 * This is the single contract both sides of the IPC boundary agree on.
 */

export type EventSource = 'desktop' | 'browser_extension'

/** A single raw activity sample as stored in the `raw_events` table. */
export interface RawEvent {
  id: number
  source: EventSource
  timestamp: number
  durationMs: number
  appName: string
  windowTitle: string | null
  domain: string | null
  isIdle: boolean
  ssid: string | null
}

/** Payload the tracking daemon writes for a desktop-level poll tick. */
export interface DesktopEventInput {
  timestamp: number
  durationMs: number
  appName: string
  windowTitle: string | null
  isIdle: boolean
  ssid: string | null
}

/** Payload the browser extension POSTs to the local ingest server. */
export interface BrowserEventInput {
  timestamp: number
  durationMs: number
  domain: string
  isIdle: boolean
}

export type CategoryMatchType = 'app' | 'domain'

/** A user-editable (or default-seeded) rule mapping an app/domain to a category. */
export interface CategoryRule {
  id: number
  matchType: CategoryMatchType
  pattern: string
  category: string
  isDefault: boolean
}

/** A user label for a Wi-Fi SSID, e.g. "AndreasWifi" -> "Home". */
export interface SsidLabel {
  ssid: string
  label: string
}

export type GoalConstraintType = 'max' | 'min'

/** One version of a goal. Editing a goal closes the old row and inserts a new one. */
export interface Goal {
  id: number
  category: string
  constraintType: GoalConstraintType
  hoursPerDay: number
  validFrom: number
  validTo: number | null
}

export interface CategoryTrendPoint {
  /** Start of the day, as a `YYYY-MM-DD` string in local time. */
  date: string
  category: string
  hours: number
}

export interface LocationTrendPoint {
  date: string
  locationLabel: string
  hours: number
}

export interface WeekOverWeekDelta {
  category: string
  thisWeekHours: number
  lastWeekHours: number
  percentChange: number | null
}

export interface GoalProgress {
  goal: Goal
  todayHours: number
  averageDailyHoursLast7Days: number
}

export interface TrackingStatus {
  isTracking: boolean
  lastPolledAt: number | null
  lastAppName: string | null
  lastIsIdle: boolean
  lastSsid: string | null
  ingestServerPort: number | null
}

export const RANGE_OPTIONS = ['7d', '30d'] as const
export type RangeOption = (typeof RANGE_OPTIONS)[number]
