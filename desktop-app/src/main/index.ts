import { app } from 'electron'
import { join } from 'node:path'
import { closeDatabase, getDatabase } from './db/database'
import { registerIpcHandlers } from './ipcHandlers'
import { startIngestServer } from './server/ingestServer'
import { TrackingDaemon } from './tracking/trackingDaemon'
import { createTray } from './tray/trayController'
import { destroyMainWindow, showMainWindow } from './windowManager'

// Determines the userData directory name (e.g. ~/Library/Application
// Support/TimeAware) independent of packaging, so dev and packaged builds
// share the same on-disk database location.
app.setName('TimeAware')

const resourcesPath = app.isPackaged ? process.resourcesPath : join(__dirname, '../../resources')

if (process.platform === 'darwin') {
  // Unpackaged dev builds otherwise show Electron's default dock icon.
  app.dock?.setIcon(join(resourcesPath, 'app-icon.png'))
}
const preloadPath = join(__dirname, '../preload/index.js')

let quitting = false

app.whenReady().then(() => {
  const db = getDatabase()
  const daemon = new TrackingDaemon(getDatabase)

  startIngestServer(getDatabase)
  registerIpcHandlers(getDatabase, daemon)

  createTray(daemon, resourcesPath, {
    onOpenDashboard: () => showMainWindow(preloadPath, resourcesPath),
    onQuit: () => {
      quitting = true
      app.quit()
    }
  })

  // Tracking starts automatically on launch; the tray toggle is only there
  // to pause/resume it, matching the "single Start Tracking toggle" spec.
  daemon.start()

  showMainWindow(preloadPath, resourcesPath)

  app.on('activate', () => showMainWindow(preloadPath, resourcesPath))

  void db
})

// This is a menu-bar app, not a document-window app: closing the window
// hides it (see windowManager.ts) rather than destroying it, so this event
// only fires during an explicit quit — no action needed, and by default
// Electron does not quit on Windows/Linux once a 'window-all-closed'
// listener is registered, which is the behavior we want here.
app.on('window-all-closed', () => {})

app.on('before-quit', () => {
  quitting = true
})

app.on('will-quit', () => {
  if (!quitting) return
  destroyMainWindow()
  closeDatabase()
})
