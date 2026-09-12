import { useState } from 'react'
import { Header } from './components/Header'
import Trends from './pages/Trends'
import Settings from './pages/Settings'

type Tab = 'overview' | 'settings'

/**
 * Root component: the custom title bar (Header) and the active page below
 * it — Trends (the default) or Settings.
 * Parameters:
 *     none
 * Returns:
 *     element (JSX.Element): the app shell
 */
export default function App(): JSX.Element {
  const [tab, setTab] = useState<Tab>('overview')

  return (
    <div className="min-h-screen bg-[#F2F2F7] text-zinc-900 flex flex-col selection:bg-rose-100 selection:text-rose-900">
      <Header activeTab={tab} setActiveTab={setTab} />
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 pt-6 sm:pt-8">
        {tab === 'overview' ? <Trends /> : <Settings />}
      </main>
    </div>
  )
}
