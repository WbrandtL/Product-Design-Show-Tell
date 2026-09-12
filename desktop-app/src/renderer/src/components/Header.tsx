import { Activity, Pause, Play } from 'lucide-react'
import { useTrackingStatus } from '../hooks'

type Tab = 'overview' | 'settings'

interface Props {
  activeTab: Tab
  setActiveTab: (tab: Tab) => void
}

/**
 * The app's custom title bar: draggable macOS-style traffic-light dots
 * (this window is fully frameless — see main/windowManager.ts — so these
 * are the only window controls, wired to real hide/minimize/fullscreen
 * IPC calls), brand + tab nav, and a live tracking status pill sourced
 * from the real tracking daemon.
 * Parameters:
 *     activeTab (Tab): which top-level tab is active
 *     setActiveTab ((tab: Tab) => void): switches the active tab
 * Returns:
 *     element (JSX.Element): the header
 */
export function Header({ activeTab, setActiveTab }: Props): JSX.Element {
  const { status, refresh } = useTrackingStatus()

  const handleToggleTracking = async (): Promise<void> => {
    if (!status) return
    if (status.isTracking) await window.timeaware.stopTracking()
    else await window.timeaware.startTracking()
    refresh()
  }

  return (
    <header className="w-full bg-white/85 backdrop-blur-md border-b border-black/[0.06] sticky top-0 z-30 shadow-[0_1px_3px_rgba(0,0,0,0.02)] [-webkit-app-region:drag]">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 pr-2 [-webkit-app-region:no-drag]">
            <button
              onClick={() => void window.timeaware.hideWindow()}
              className="w-3 h-3 rounded-full bg-[#FF5F56] border border-[#E0443E]/60 cursor-pointer"
              title="Close"
              aria-label="Close"
            />
            <button
              onClick={() => void window.timeaware.minimizeWindow()}
              className="w-3 h-3 rounded-full bg-[#FFBD2E] border border-[#DEA123]/60 cursor-pointer"
              title="Minimize"
              aria-label="Minimize"
            />
            <button
              onClick={() => void window.timeaware.toggleFullScreenWindow()}
              className="w-3 h-3 rounded-full bg-[#27C93F] border border-[#1AAB29]/60 cursor-pointer"
              title="Fullscreen"
              aria-label="Toggle fullscreen"
            />
          </div>

          <div onClick={() => setActiveTab('overview')} className="flex items-center gap-2 cursor-pointer group [-webkit-app-region:no-drag]">
            <div className="w-7 h-7 rounded-lg bg-[#FF2D55] text-white flex items-center justify-center shadow-xs group-hover:scale-105 transition-transform">
              <Activity size={15} strokeWidth={2.5} />
            </div>
            <span className="text-base font-bold tracking-tight text-zinc-900">TimeAware</span>
          </div>

          <nav className="hidden sm:flex items-center bg-zinc-200/60 p-1 rounded-xl ml-4 text-xs font-semibold [-webkit-app-region:no-drag]">
            <button
              onClick={() => setActiveTab('overview')}
              className={`px-3 py-1 rounded-lg transition cursor-pointer ${
                activeTab === 'overview' ? 'bg-white text-zinc-950 shadow-xs font-bold' : 'text-zinc-500 hover:text-zinc-900'
              }`}
            >
              Trends
            </button>
            <button
              onClick={() => setActiveTab('settings')}
              className={`px-3 py-1 rounded-lg transition cursor-pointer ${
                activeTab === 'settings' ? 'bg-white text-zinc-950 shadow-xs font-bold' : 'text-zinc-500 hover:text-zinc-900'
              }`}
            >
              Settings
            </button>
          </nav>
        </div>

        <div className="flex items-center gap-3 [-webkit-app-region:no-drag]">
          <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-zinc-100/90 border border-zinc-200/80 text-xs text-zinc-700 font-medium">
            <span className={`w-2 h-2 rounded-full ${status?.isTracking ? 'bg-emerald-500 animate-pulse' : 'bg-zinc-400'}`} />
            <span className="text-zinc-500">{status?.isTracking ? 'Tracking' : 'Paused'} ·</span>
            <span className="font-semibold text-zinc-800">{status?.lastAppName ?? '…'}</span>
          </div>

          <button
            onClick={() => void handleToggleTracking()}
            className={`px-3 py-1 rounded-md text-xs font-medium border transition flex items-center gap-1.5 cursor-pointer ${
              status?.isTracking
                ? 'border-emerald-500 text-emerald-700 bg-emerald-50/70 hover:bg-emerald-100/80'
                : 'border-zinc-300 text-zinc-700 bg-white hover:bg-zinc-50'
            }`}
          >
            {status?.isTracking ? (
              <>
                <Pause size={12} className="text-emerald-600" />
                <span>Stop Tracking</span>
              </>
            ) : (
              <>
                <Play size={12} className="text-zinc-600" />
                <span>Start Tracking</span>
              </>
            )}
          </button>
        </div>
      </div>

      <div className="sm:hidden flex items-center justify-around border-t border-black/[0.06] px-3 py-2 bg-zinc-100/90 backdrop-blur-md [-webkit-app-region:no-drag]">
        <button
          onClick={() => setActiveTab('overview')}
          className={`px-4 py-1.5 text-xs rounded-xl transition ${activeTab === 'overview' ? 'font-bold text-zinc-950 bg-white shadow-2xs' : 'text-zinc-500'}`}
        >
          Trends
        </button>
        <button
          onClick={() => setActiveTab('settings')}
          className={`px-4 py-1.5 text-xs rounded-xl transition ${activeTab === 'settings' ? 'font-bold text-zinc-950 bg-white shadow-2xs' : 'text-zinc-500'}`}
        >
          Settings
        </button>
      </div>
    </header>
  )
}
