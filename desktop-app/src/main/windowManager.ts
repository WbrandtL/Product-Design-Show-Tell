import { BrowserWindow, nativeImage, shell } from 'electron'
import { join } from 'node:path'
import { is } from './platform'

let mainWindow: BrowserWindow | null = null

/**
 * Creates the single dashboard/settings window if it doesn't already exist,
 * or focuses it if it does. The window hides (rather than closes) when the
 * user clicks its close button, so the app keeps running from the tray.
 * Parameters:
 *     preloadPath (string): absolute path to the compiled preload script
 *     resourcesPath (string): absolute path to the app's resources directory (for the window/taskbar icon)
 * Returns:
 *     window (BrowserWindow): the app's single window
 */
export function showMainWindow(preloadPath: string, resourcesPath: string): BrowserWindow {
  if (mainWindow) {
    mainWindow.show()
    mainWindow.focus()
    return mainWindow
  }

  mainWindow = new BrowserWindow({
    width: 1100,
    height: 760,
    minWidth: 820,
    minHeight: 560,
    title: 'TimeAware',
    icon: nativeImage.createFromPath(join(resourcesPath, 'app-icon.png')),
    show: false,
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  })

  mainWindow.on('ready-to-show', () => mainWindow?.show())

  mainWindow.on('close', (event) => {
    event.preventDefault()
    mainWindow?.hide()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    void shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    void mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    void mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  return mainWindow
}

/**
 * Fully destroys the main window reference, used during app shutdown so a
 * new one isn't accidentally reused after quit.
 * Parameters:
 *     none
 * Returns:
 *     void
 */
export function destroyMainWindow(): void {
  mainWindow?.destroy()
  mainWindow = null
}
