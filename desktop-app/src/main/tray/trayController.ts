import { Menu, Tray, nativeImage } from 'electron'
import { join } from 'node:path'
import type { TrackingDaemon } from '../tracking/trackingDaemon'

export interface TrayCallbacks {
  onOpenDashboard: () => void
  onQuit: () => void
}

/**
 * Builds and wires up the menu-bar/system-tray icon: a single "Start
 * Tracking" toggle plus "Open Dashboard" and "Quit", per the zero-friction
 * setup requirement — there is no other tracking on/off control anywhere
 * in the app.
 * Parameters:
 *     daemon (TrackingDaemon): the tracking daemon this tray toggle controls
 *     resourcesPath (string): absolute path to the app's resources directory
 *     callbacks (TrayCallbacks): handlers for the other menu actions
 * Returns:
 *     tray (Tray): the created tray instance (keep a reference to prevent GC)
 */
export function createTray(daemon: TrackingDaemon, resourcesPath: string, callbacks: TrayCallbacks): Tray {
  const icon = nativeImage.createFromPath(join(resourcesPath, 'tray-icon.png'))
  const tray = new Tray(icon)
  tray.setToolTip('TimeAware')

  const rebuildMenu = (): void => {
    const status = daemon.getStatus()
    const menu = Menu.buildFromTemplate([
      {
        label: status.isTracking ? 'Stop Tracking' : 'Start Tracking',
        type: 'checkbox',
        checked: status.isTracking,
        click: () => {
          if (status.isTracking) daemon.stop()
          else daemon.start()
          rebuildMenu()
        }
      },
      { type: 'separator' },
      { label: 'Open Dashboard', click: callbacks.onOpenDashboard },
      { type: 'separator' },
      { label: 'Quit TimeAware', click: callbacks.onQuit }
    ])
    tray.setContextMenu(menu)
  }

  rebuildMenu()
  tray.on('click', callbacks.onOpenDashboard)
  return tray
}
