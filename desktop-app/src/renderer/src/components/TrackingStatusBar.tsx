import { useTrackingStatus } from '../hooks'

/**
 * Compact header widget showing whether tracking is on/off, the last
 * observed app, and a toggle button — the same on/off control as the tray
 * menu, kept in sync since both read the same daemon state.
 * Parameters:
 *     none
 * Returns:
 *     element (JSX.Element): the status bar
 */
export default function TrackingStatusBar(): JSX.Element {
  const { status, refresh } = useTrackingStatus()

  const handleToggle = async (): Promise<void> => {
    if (!status) return
    if (status.isTracking) await window.timeaware.stopTracking()
    else await window.timeaware.startTracking()
    refresh()
  }

  return (
    <div className="status-bar">
      <span className={`dot ${status?.isTracking ? 'on' : ''}`} />
      <span>
        {status?.isTracking
          ? `Tracking · ${status.lastAppName ?? '…'}${status.lastIsIdle ? ' (idle)' : ''}`
          : 'Tracking paused'}
      </span>
      <button className={`toggle-button ${status?.isTracking ? 'on' : ''}`} onClick={() => void handleToggle()}>
        {status?.isTracking ? 'Stop Tracking' : 'Start Tracking'}
      </button>
    </div>
  )
}
