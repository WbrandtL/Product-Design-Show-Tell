import { useState } from 'react'
import CategoryRulesEditor from '../components/CategoryRulesEditor'
import SsidLabeler from '../components/SsidLabeler'
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
    <>
      <div className="card">
        <div className="card-header">
          <div>
            <h2 className="card-title">Categorization rules</h2>
            <p className="card-subtitle">Map an app or domain to a category. Applies to future data on next view.</p>
          </div>
        </div>
        <CategoryRulesEditor rules={rules} onChanged={handleRulesChanged} />
      </div>

      <div className="card">
        <div className="card-header">
          <div>
            <h2 className="card-title">Locations</h2>
            <p className="card-subtitle">Label Wi-Fi networks once to group time by location.</p>
          </div>
        </div>
        <SsidLabeler labels={labels} unlabeled={unlabeled} onChanged={handleSsidsChanged} />
      </div>

      <div className="card">
        <div className="card-header">
          <div>
            <h2 className="card-title">Browser extension</h2>
            <p className="card-subtitle">
              The TimeAware browser extension sends domain-level activity to this app over a local-only
              connection — nothing leaves your machine.
            </p>
          </div>
        </div>
        <p className="goal-meta">
          Local ingest server: <code>http://127.0.0.1:{status?.ingestServerPort ?? '…'}</code> — install the
          unpacked extension from <code>browser-extension/</code> (see README) to enable per-domain tracking
          while browsing. Without it, browser time is still tracked at the app level (e.g. "Chrome").
        </p>
      </div>
    </>
  )
}
