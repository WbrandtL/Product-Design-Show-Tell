import { useState } from 'react'
import { CategoryRulesEditor } from '../components/CategoryRulesEditor'
import { SsidLabeler } from '../components/SsidLabeler'
import { useCategoryRules, useSsidLabels, useTrackingStatus } from '../hooks'

/**
 * Settings page: category rule editing and Wi-Fi SSID labeling, plus a
 * status readout of the local ingest server the browser extension talks to.
 * Parameters:
 *     none
 * Returns:
 *     element (JSX.Element): the settings page
 */
export default function Settings(): JSX.Element {
  const [refreshKey, setRefreshKey] = useState(0)
  const bump = (): void => setRefreshKey((k) => k + 1)

  const { rules, refresh: refreshRules } = useCategoryRules(refreshKey)
  const { labels, unlabeled, refresh: refreshSsids } = useSsidLabels(refreshKey)
  const { status } = useTrackingStatus()

  const handleRulesChanged = (): void => {
    refreshRules()
    bump()
  }

  const handleSsidsChanged = (): void => {
    refreshSsids()
    bump()
  }

  return (
    <div className="w-full max-w-5xl mx-auto space-y-6 pb-16">
      <div className="border-b border-zinc-200/80 pb-4">
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900">Settings</h1>
        <p className="text-xs sm:text-sm text-zinc-500 mt-0.5">Configure app categorization rules and network location labels.</p>
      </div>

      <CategoryRulesEditor rules={rules} onChanged={handleRulesChanged} />
      <SsidLabeler labels={labels} unlabeled={unlabeled} onChanged={handleSsidsChanged} />

      <div className="bg-white rounded-2xl border border-zinc-200 p-6 shadow-2xs">
        <h2 className="text-base font-bold text-zinc-900 mb-1">Browser extension</h2>
        <p className="text-xs text-zinc-500 mb-3">
          The TimeAware browser extension sends domain-level activity to this app over a local-only connection —
          nothing leaves your machine.
        </p>
        <p className="text-xs text-zinc-500">
          Local ingest server: <code className="px-1.5 py-0.5 bg-zinc-100 rounded text-zinc-700">http://127.0.0.1:{status?.ingestServerPort ?? '…'}</code>
          {' — install the unpacked extension from '}
          <code className="px-1.5 py-0.5 bg-zinc-100 rounded text-zinc-700">browser-extension/</code>
          {' (see README) to enable per-domain tracking while browsing. Without it, browser time is still tracked at the app level (e.g. "Chrome").'}
        </p>
      </div>
    </div>
  )
}
