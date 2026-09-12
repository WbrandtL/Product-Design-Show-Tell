import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)

/**
 * Reads the current Wi-Fi SSID via `ipconfig getsummary`, falling back to
 * `system_profiler` parsing. Recent macOS versions may require Location
 * Services permission to return a real SSID; if unavailable this returns
 * null and the poll tick is simply recorded with no location.
 * Parameters:
 *     none
 * Returns:
 *     ssid (string | null): the current SSID, or null if not connected/unavailable
 */
async function getSsidMac(): Promise<string | null> {
  try {
    const { stdout } = await execFileAsync('bash', [
      '-c',
      "networksetup -listallhardwareports | awk '/Wi-Fi/{getline; print $2}'"
    ])
    const device = stdout.trim()
    if (!device) return null
    const { stdout: summary } = await execFileAsync('ipconfig', ['getsummary', device])
    const match = summary.match(/\sSSID\s*:\s*(.+)/)
    if (match?.[1]) return match[1].trim()
  } catch {
    // fall through to system_profiler
  }
  try {
    const { stdout } = await execFileAsync('system_profiler', ['SPAirPortDataType'])
    const match = stdout.match(/Current Network Information:\s*\n\s*(.+):/)
    if (match?.[1]) return match[1].trim()
  } catch {
    // Wi-Fi SSID unavailable (permission not granted, or no Wi-Fi hardware)
  }
  return null
}

/**
 * Reads the current Wi-Fi SSID via `netsh wlan show interfaces`.
 * Parameters:
 *     none
 * Returns:
 *     ssid (string | null): the current SSID, or null if not connected/unavailable
 */
async function getSsidWindows(): Promise<string | null> {
  try {
    const { stdout } = await execFileAsync('netsh', ['wlan', 'show', 'interfaces'])
    const match = stdout.match(/^\s*SSID\s*:\s*(.+)$/m)
    return match?.[1]?.trim() ?? null
  } catch {
    return null
  }
}

/**
 * Returns the current Wi-Fi SSID as a location proxy, or null when
 * unavailable. Never throws.
 * Parameters:
 *     none
 * Returns:
 *     ssid (string | null): the current SSID, or null
 */
export async function getCurrentSsid(): Promise<string | null> {
  if (process.platform === 'darwin') return getSsidMac()
  if (process.platform === 'win32') return getSsidWindows()
  return null
}
