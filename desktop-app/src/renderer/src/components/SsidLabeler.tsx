import { useState } from 'react'
import type { SsidLabel } from '../../../shared/types'

interface Props {
  labels: SsidLabel[]
  unlabeled: string[]
  onChanged: () => void
}

/**
 * Lets the user label Wi-Fi SSIDs once (e.g. "Home", "Library") so the
 * location trend can group time by that label instead of raw network
 * names. Unlabeled networks the daemon has actually observed are listed
 * separately so there's a clear next action, satisfying "zero-friction
 * setup" for this feature.
 * Parameters:
 *     labels (SsidLabel[]): SSIDs that already have a user-defined label
 *     unlabeled (string[]): SSIDs observed while tracking but not yet labeled
 *     onChanged (() => void): called after a label is set or removed, to trigger a re-fetch
 * Returns:
 *     element (JSX.Element): the SSID labeling UI
 */
export default function SsidLabeler({ labels, unlabeled, onChanged }: Props): JSX.Element {
  const [drafts, setDrafts] = useState<Record<string, string>>({})

  const handleSave = async (ssid: string): Promise<void> => {
    const label = drafts[ssid]?.trim()
    if (!label) return
    await window.timeaware.setSsidLabel(ssid, label)
    setDrafts((d) => ({ ...d, [ssid]: '' }))
    onChanged()
  }

  const handleRemove = async (ssid: string): Promise<void> => {
    await window.timeaware.deleteSsidLabel(ssid)
    onChanged()
  }

  return (
    <div className="settings-section">
      {labels.length > 0 && (
        <table className="data-table">
          <thead>
            <tr>
              <th>Network (SSID)</th>
              <th>Label</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {labels.map((l) => (
              <tr key={l.ssid}>
                <td>{l.ssid}</td>
                <td>{l.label}</td>
                <td>
                  <button className="text-button" onClick={() => void handleRemove(l.ssid)}>
                    remove
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {unlabeled.length === 0 ? (
        <p className="card-subtitle">No unlabeled networks observed yet. Unlabeled networks default to "Other".</p>
      ) : (
        <div className="settings-section">
          <p className="card-subtitle">Observed but not labeled yet:</p>
          {unlabeled.map((ssid) => (
            <form
              className="inline-form"
              key={ssid}
              onSubmit={(e) => {
                e.preventDefault()
                void handleSave(ssid)
              }}
            >
              <span style={{ minWidth: 140 }}>{ssid}</span>
              <input
                placeholder="Label, e.g. Home"
                value={drafts[ssid] ?? ''}
                onChange={(e) => setDrafts((d) => ({ ...d, [ssid]: e.target.value }))}
              />
              <button type="submit">Save</button>
            </form>
          ))}
        </div>
      )}
    </div>
  )
}
