/**
 * Contract with the TimeAware desktop app's local ingest server. Must stay
 * in sync with desktop-app/src/main/server/ingestServer.ts and the
 * BrowserEventInput shape in desktop-app/src/shared/types.ts — see
 * ARCHITECTURE.md "Extension <-> desktop app channel" for the full contract.
 */
const INGEST_BASE_URL = 'http://127.0.0.1:47850'

export interface BrowserEventPayload {
  timestamp: number
  durationMs: number
  domain: string
  isIdle: boolean
}

/**
 * Checks whether the TimeAware desktop app is currently running and
 * reachable, used by the popup to show connection status.
 * Parameters:
 *     none
 * Returns:
 *     reachable (Promise<boolean>): true if the local ingest server responded
 */
export async function isDesktopAppReachable(): Promise<boolean> {
  try {
    const response = await fetch(`${INGEST_BASE_URL}/health`, { signal: AbortSignal.timeout(1500) })
    return response.ok
  } catch {
    return false
  }
}

/**
 * Sends one or more tracked domain-time intervals to the desktop app. Fails
 * silently (logging to the service worker console) if the app isn't
 * running — there is no local queue/retry in v1, so events captured while
 * the desktop app is closed are simply not recorded (see README "future
 * extension points").
 * Parameters:
 *     events (BrowserEventPayload[]): the intervals to report
 * Returns:
 *     sent (Promise<boolean>): true if the desktop app accepted the events
 */
export async function sendBrowserEvents(events: BrowserEventPayload[]): Promise<boolean> {
  if (events.length === 0) return true
  try {
    const response = await fetch(`${INGEST_BASE_URL}/events/browser`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ events }),
      signal: AbortSignal.timeout(2000)
    })
    if (!response.ok) console.warn('[TimeAware] desktop app rejected events', response.status)
    return response.ok
  } catch (error) {
    console.warn('[TimeAware] desktop app unreachable, dropping events:', error)
    return false
  }
}
