import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)

export interface ActiveWindowInfo {
  appName: string
  windowTitle: string | null
}

const MAC_APPLESCRIPT_LINES = [
  'tell application "System Events"',
  'set frontApp to first application process whose frontmost is true',
  'set appName to name of frontApp',
  'set windowTitle to ""',
  'try',
  'tell frontApp to set windowTitle to name of front window',
  'end try',
  'end tell',
  'return appName & "||" & windowTitle'
]

/**
 * Reads the frontmost app name and window title via AppleScript talking to
 * System Events. Requires the user to grant Accessibility permission the
 * first time (macOS will prompt automatically); the exact command run here
 * is the only thing that touches the OS, so it stays fully inspectable.
 * Parameters:
 *     none
 * Returns:
 *     info (ActiveWindowInfo | null): frontmost app/window, or null on failure
 */
async function getActiveWindowMac(): Promise<ActiveWindowInfo | null> {
  const args = MAC_APPLESCRIPT_LINES.flatMap((line) => ['-e', line])
  const { stdout } = await execFileAsync('osascript', args)
  const [appName, windowTitle] = stdout.trim().split('||')
  if (!appName) return null
  return { appName, windowTitle: windowTitle && windowTitle.length > 0 ? windowTitle : null }
}

const WINDOWS_POWERSHELL_SCRIPT = `
Add-Type @"
  using System;
  using System.Runtime.InteropServices;
  using System.Text;
  public class Win32 {
    [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
    [DllImport("user32.dll")] public static extern int GetWindowText(IntPtr hWnd, StringBuilder text, int count);
    [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint processId);
  }
"@
$hwnd = [Win32]::GetForegroundWindow()
$sb = New-Object System.Text.StringBuilder 1024
[Win32]::GetWindowText($hwnd, $sb, $sb.Capacity) | Out-Null
$title = $sb.ToString()
$procId = 0
[Win32]::GetWindowThreadProcessId($hwnd, [ref]$procId) | Out-Null
$proc = Get-Process -Id $procId -ErrorAction SilentlyContinue
$name = if ($proc) { $proc.ProcessName } else { "Unknown" }
Write-Output "$name||$title"
`.trim()

/**
 * Reads the foreground window's process name and title via a PowerShell
 * script calling the Win32 GetForegroundWindow API. Requires no elevated
 * privileges; the script text above is the entirety of what runs.
 * Parameters:
 *     none
 * Returns:
 *     info (ActiveWindowInfo | null): foreground app/window, or null on failure
 */
async function getActiveWindowWindows(): Promise<ActiveWindowInfo | null> {
  const { stdout } = await execFileAsync('powershell.exe', [
    '-NoProfile',
    '-NonInteractive',
    '-Command',
    WINDOWS_POWERSHELL_SCRIPT
  ])
  const [appName, windowTitle] = stdout.trim().split('||')
  if (!appName) return null
  return { appName, windowTitle: windowTitle && windowTitle.length > 0 ? windowTitle : null }
}

/**
 * Returns the currently focused application and window title, using the
 * platform-appropriate strategy. Never throws: callers get null on any
 * failure (e.g. permission not yet granted, unsupported platform) so a
 * single failed poll tick doesn't crash the tracking daemon.
 * Parameters:
 *     none
 * Returns:
 *     info (ActiveWindowInfo | null): the active window, or null if unavailable
 */
export async function getActiveWindow(): Promise<ActiveWindowInfo | null> {
  try {
    if (process.platform === 'darwin') return await getActiveWindowMac()
    if (process.platform === 'win32') return await getActiveWindowWindows()
    return null
  } catch (error) {
    console.warn('[activeWindowPoller] failed to read active window:', error)
    return null
  }
}
