import { sendBrowserEvents, type BrowserEventPayload } from './ingestClient'

/** Matches the desktop app's idle threshold (see desktop-app idleDetector.ts). */
const IDLE_DETECTION_SECONDS = 60
const HEARTBEAT_ALARM = 'timeaware-heartbeat'

interface TrackedSegment {
  /** The domain currently being timed, or null if nothing eligible is focused. */
  domain: string | null
  /** When this segment started, unix ms. */
  since: number
}

let browserFocused = true
let activeTabUrl: string | null = null
let idleState: chrome.idle.IdleState = 'active'
let segment: TrackedSegment = { domain: null, since: Date.now() }

/**
 * Resolves the domain that should currently be counted as "being viewed",
 * or null if tracking shouldn't be happening right now (browser
 * unfocused, user idle, or the active tab isn't a regular http/https page).
 * Parameters:
 *     none
 * Returns:
 *     domain (string | null): the eligible domain, or null
 */
function computeEligibleDomain(): string | null {
  if (!browserFocused || idleState !== 'active' || !activeTabUrl) return null
  try {
    const url = new URL(activeTabUrl)
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null
    return url.hostname
  } catch {
    return null
  }
}

/**
 * Reports the time accumulated in the current segment (if any) up to `now`,
 * without changing which domain is being tracked. Used both when a segment
 * ends and by the periodic heartbeat to flush long-running segments in
 * regular chunks instead of one giant interval.
 * Parameters:
 *     now (number): the current time, unix ms
 * Returns:
 *     void
 */
function flushSegment(now: number): void {
  if (segment.domain === null || now <= segment.since) return
  const payload: BrowserEventPayload = {
    timestamp: segment.since,
    durationMs: now - segment.since,
    domain: segment.domain,
    isIdle: false
  }
  void sendBrowserEvents([payload])
}

/**
 * Flushes the current segment and starts a new one for `newDomain`. Called
 * whenever focus, idle state, or the active tab's URL changes.
 * Parameters:
 *     newDomain (string | null): the domain to start tracking, or null
 * Returns:
 *     void
 */
function transitionTo(newDomain: string | null): void {
  const now = Date.now()
  flushSegment(now)
  segment = { domain: newDomain, since: now }
}

/**
 * Recomputes the eligible domain from current state and transitions to it
 * if it changed. No-op (and no flush) if nothing changed, so unrelated tab
 * events don't fragment a single continuous viewing session.
 * Parameters:
 *     none
 * Returns:
 *     void
 */
function reevaluate(): void {
  const eligible = computeEligibleDomain()
  if (eligible !== segment.domain) transitionTo(eligible)
}

chrome.tabs.onActivated.addListener(({ tabId }) => {
  chrome.tabs.get(tabId, (tab) => {
    activeTabUrl = tab?.url ?? null
    reevaluate()
  })
})

chrome.tabs.onUpdated.addListener((_tabId, changeInfo, tab) => {
  if (tab.active && changeInfo.url) {
    activeTabUrl = changeInfo.url
    reevaluate()
  }
})

chrome.windows.onFocusChanged.addListener((windowId) => {
  browserFocused = windowId !== chrome.windows.WINDOW_ID_NONE
  if (!browserFocused) {
    reevaluate()
    return
  }
  chrome.tabs.query({ active: true, windowId }, ([tab]) => {
    activeTabUrl = tab?.url ?? null
    reevaluate()
  })
})

chrome.idle.onStateChanged.addListener((state) => {
  idleState = state
  reevaluate()
})

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name !== HEARTBEAT_ALARM) return
  const now = Date.now()
  flushSegment(now)
  // Same domain (if any) keeps being tracked, just in a fresh chunk.
  segment = { domain: segment.domain, since: now }
})

/**
 * Populates initial focus/tab/idle state on service-worker startup (which
 * happens both on browser launch and whenever Chrome wakes a previously
 * suspended MV3 service worker), and (re)registers the heartbeat alarm.
 * Parameters:
 *     none
 * Returns:
 *     void
 */
function initialize(): void {
  chrome.idle.setDetectionInterval(IDLE_DETECTION_SECONDS)
  chrome.alarms.create(HEARTBEAT_ALARM, { periodInMinutes: 1 })

  chrome.idle.queryState(IDLE_DETECTION_SECONDS, (state) => {
    idleState = state
  })

  chrome.windows.getLastFocused({ windowTypes: ['normal'] }, (win) => {
    browserFocused = win?.focused ?? false
    if (!browserFocused || win?.id === undefined) {
      reevaluate()
      return
    }
    chrome.tabs.query({ active: true, windowId: win.id }, ([tab]) => {
      activeTabUrl = tab?.url ?? null
      reevaluate()
    })
  })
}

initialize()
