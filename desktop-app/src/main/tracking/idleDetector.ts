import { powerMonitor } from 'electron'

/** Seconds of no keyboard/mouse input after which a poll tick counts as idle. */
export const IDLE_THRESHOLD_SECONDS = 60

/**
 * Reports whether the system is currently idle, using Electron's built-in
 * OS-level idle timer (no extra native module, no accessibility permission
 * needed on any platform).
 * Parameters:
 *     none
 * Returns:
 *     isIdle (boolean): true if no keyboard/mouse input for IDLE_THRESHOLD_SECONDS
 */
export function isSystemIdle(): boolean {
  return powerMonitor.getSystemIdleTime() >= IDLE_THRESHOLD_SECONDS
}
