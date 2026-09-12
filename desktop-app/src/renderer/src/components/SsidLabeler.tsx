import { useState } from 'react'
import { Wifi } from 'lucide-react'
import { HOME_LOCATION_LABEL } from '../../../shared/constants'
import type { SsidLabel } from '../../../shared/types'

interface Props {
  labels: SsidLabel[]
  unlabeled: string[]
  onChanged: () => void
}

const LOCATION_COLORS = ['#0066FF', '#34C759', '#AF52DE', '#FF9500', '#FF2D55']

/**
 * Lets the user label Wi-Fi SSIDs once (e.g. "Home", "Library") so the
 * location trend can group time by that label instead of raw network
 * names. Labeling a network exactly "Home" (case-insensitive) is what
 * makes the Outside hero card on the Trends page mean something — it's
 * "time away from whichever network you call Home".
 * Parameters:
 *     labels (SsidLabel[]): SSIDs that already have a user-defined label
 *     unlabeled (string[]): SSIDs observed while tracking but not yet labeled
 *     onChanged (() => void): called after a label is set or removed, to trigger a re-fetch
 * Returns:
 *     element (JSX.Element): the SSID labeling UI
 */
export function SsidLabeler({ labels, unlabeled, onChanged }: Props): JSX.Element {
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
    <div className="bg-white rounded-2xl border border-zinc-200 p-6 shadow-2xs">
      <div className="flex items-center gap-2 mb-2">
        <Wifi size={16} className="text-blue-600" />
        <h2 className="text-base font-bold text-zinc-900">Labeled Wi-Fi Networks</h2>
      </div>
      <p className="text-xs text-zinc-500 mb-4">
        Label the network you consider home exactly <strong>&quot;{HOME_LOCATION_LABEL}&quot;</strong> — the Outside metric on the Trends
        page is everything that isn&apos;t it. Other labels are just for your own reference.
      </p>

      {labels.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-5">
          {labels.map((l, i) => (
            <div key={l.ssid} className="p-3.5 rounded-xl border border-zinc-200 bg-zinc-50/50 flex items-center justify-between gap-2">
              <div className="min-w-0">
                <div className="text-xs font-semibold text-zinc-800 truncate">{l.label}</div>
                <div className="text-[11px] text-zinc-400 font-mono mt-0.5 truncate">{l.ssid}</div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="w-3 h-3 rounded-full" style={{ backgroundColor: LOCATION_COLORS[i % LOCATION_COLORS.length] }} />
                <button onClick={() => void handleRemove(l.ssid)} className="text-[11px] text-zinc-400 hover:text-rose-600 transition">
                  remove
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {unlabeled.length === 0 ? (
        <p className="text-xs text-zinc-400">No unlabeled networks observed yet. Unlabeled networks default to &quot;Other&quot;.</p>
      ) : (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-zinc-600">Observed but not labeled yet:</p>
          {unlabeled.map((ssid) => (
            <form
              key={ssid}
              onSubmit={(e) => {
                e.preventDefault()
                void handleSave(ssid)
              }}
              className="flex items-center gap-2"
            >
              <span className="text-xs font-mono text-zinc-600 min-w-[140px] truncate">{ssid}</span>
              <input
                value={drafts[ssid] ?? ''}
                onChange={(e) => setDrafts((d) => ({ ...d, [ssid]: e.target.value }))}
                placeholder={`Label, e.g. ${HOME_LOCATION_LABEL}`}
                className="flex-1 px-3 py-1.5 bg-zinc-50 border border-zinc-200 rounded-lg text-xs text-zinc-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              />
              <button type="submit" className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold transition cursor-pointer">
                Save
              </button>
            </form>
          ))}
        </div>
      )}
    </div>
  )
}
