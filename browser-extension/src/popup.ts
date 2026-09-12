import { isDesktopAppReachable } from './ingestClient'

/**
 * Updates the popup's connection indicator based on whether the local
 * TimeAware desktop app answered its health check.
 * Parameters:
 *     none
 * Returns:
 *     void
 */
async function refreshStatus(): Promise<void> {
  const dot = document.getElementById('status-dot')
  const text = document.getElementById('status-text')
  if (!dot || !text) return

  const reachable = await isDesktopAppReachable()
  dot.classList.toggle('ok', reachable)
  text.textContent = reachable ? 'Connected to TimeAware' : 'TimeAware desktop app not running'
}

void refreshStatus()
