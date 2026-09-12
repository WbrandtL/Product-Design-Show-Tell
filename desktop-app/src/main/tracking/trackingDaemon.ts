import type Database from 'better-sqlite3'
import { insertDesktopEvent } from '../db/rawEventsRepo'
import { getActiveWindow } from './activeWindowPoller'
import { isSystemIdle } from './idleDetector'
import { getCurrentSsid } from './ssidReader'

/** How often the daemon samples the active window, in ms. */
export const POLL_INTERVAL_MS = 7_500

/** How often the daemon re-checks the current Wi-Fi SSID, in ms (cheaper to poll less often). */
const SSID_REFRESH_INTERVAL_MS = 60_000

export interface DaemonStatusSnapshot {
  isTracking: boolean
  lastPolledAt: number | null
  lastAppName: string | null
  lastIsIdle: boolean
  lastSsid: string | null
}

/**
 * Polls the active window on an interval and writes one raw_events row per
 * tick. This is the only place desktop-level tracking happens, and every
 * poll it performs is logged to the console so the daemon is inspectable —
 * nothing is captured or sent anywhere beyond this process's own SQLite file.
 */
export class TrackingDaemon {
  private readonly getDb: () => Database.Database
  private timer: ReturnType<typeof setInterval> | null = null
  private lastSsid: string | null = null
  private lastSsidCheckedAt = 0
  private status: DaemonStatusSnapshot = {
    isTracking: false,
    lastPolledAt: null,
    lastAppName: null,
    lastIsIdle: false,
    lastSsid: null
  }

  constructor(getDb: () => Database.Database) {
    this.getDb = getDb
  }

  /**
   * Starts polling. No-op if already running.
   * Parameters:
   *     none
   * Returns:
   *     void
   */
  start(): void {
    if (this.timer) return
    this.status.isTracking = true
    void this.poll()
    this.timer = setInterval(() => void this.poll(), POLL_INTERVAL_MS)
  }

  /**
   * Stops polling. No-op if already stopped.
   * Parameters:
   *     none
   * Returns:
   *     void
   */
  stop(): void {
    if (this.timer) clearInterval(this.timer)
    this.timer = null
    this.status.isTracking = false
  }

  /**
   * Returns a snapshot of the daemon's current state for display in the UI.
   * Parameters:
   *     none
   * Returns:
   *     status (DaemonStatusSnapshot): tracking on/off plus last observed values
   */
  getStatus(): DaemonStatusSnapshot {
    return { ...this.status }
  }

  private async poll(): Promise<void> {
    const now = Date.now()
    const isIdle = isSystemIdle()
    const window = await getActiveWindow()

    if (now - this.lastSsidCheckedAt >= SSID_REFRESH_INTERVAL_MS) {
      this.lastSsid = await getCurrentSsid()
      this.lastSsidCheckedAt = now
    }

    const appName = window?.appName ?? 'Unknown'
    const windowTitle = window?.windowTitle ?? null

    insertDesktopEvent(this.getDb(), {
      timestamp: now,
      durationMs: POLL_INTERVAL_MS,
      appName,
      windowTitle,
      isIdle,
      ssid: this.lastSsid
    })

    this.status = {
      isTracking: true,
      lastPolledAt: now,
      lastAppName: appName,
      lastIsIdle: isIdle,
      lastSsid: this.lastSsid
    }

    console.log(
      `[trackingDaemon] ${new Date(now).toISOString()} app="${appName}" idle=${isIdle} ssid=${this.lastSsid ?? 'n/a'}`
    )
  }
}
