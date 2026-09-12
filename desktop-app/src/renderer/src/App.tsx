import { useState } from 'react'
import Dashboard from './pages/Dashboard'
import Settings from './pages/Settings'
import TrackingStatusBar from './components/TrackingStatusBar'

type Tab = 'trends' | 'settings'

/**
 * Root component: header with tab navigation and live tracking status, and
 * the active page body below it.
 * Parameters:
 *     none
 * Returns:
 *     element (JSX.Element): the app shell
 */
export default function App(): JSX.Element {
  const [tab, setTab] = useState<Tab>('trends')

  return (
    <div className="app-shell">
      <header className="app-header">
        <h1 className="app-title">TimeAware</h1>
        <nav className="tab-nav">
          <button className={`tab-button ${tab === 'trends' ? 'active' : ''}`} onClick={() => setTab('trends')}>
            Trends
          </button>
          <button className={`tab-button ${tab === 'settings' ? 'active' : ''}`} onClick={() => setTab('settings')}>
            Settings
          </button>
        </nav>
        <TrackingStatusBar />
      </header>
      <main className="app-body">{tab === 'trends' ? <Dashboard /> : <Settings />}</main>
    </div>
  )
}
