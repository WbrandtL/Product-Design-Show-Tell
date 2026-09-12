import { useMemo, useState } from 'react'
import { ArrowLeft, Search, Target, TrendingDown, TrendingUp } from 'lucide-react'
import { AppIcon } from './AppIcon'
import { getCategoryTheme } from '../lib/categoryTheme'
import { formatMinutes } from '../lib/format'
import { useActivityBreakdown } from '../hooks'
import type { RangeOption } from '../../../shared/types'

interface Props {
  category: string | null
  range: RangeOption
  onBack: () => void
  onOpenGoalModal: (category: string) => void
}

/**
 * Per-app/domain activity breakdown for a category (or, when category is
 * null, everything): search/filter over real duration, real activation
 * counts, and trend derived from the raw event stream — nothing here is
 * fabricated.
 * Parameters:
 *     category (string | null): category to show, or null for all activity
 *     range (RangeOption): '7d' or '30d', matching the Overview page's selection
 *     onBack (() => void): called to return to the Overview
 *     onOpenGoalModal ((category: string) => void): called to open the goal modal for this category
 * Returns:
 *     element (JSX.Element): the drilldown view
 */
export function ActivityDrilldownView({ category, range, onBack, onOpenGoalModal }: Props): JSX.Element {
  const [searchQuery, setSearchQuery] = useState('')
  const rows = useActivityBreakdown(category, range)

  const totalActivations = useMemo(() => rows.reduce((acc, r) => acc + r.activations, 0), [rows])
  const totalMinutes = useMemo(() => Math.round(rows.reduce((acc, r) => acc + r.durationMs, 0) / 60000), [rows])

  const filteredRows = rows.filter(
    (r) => r.name.toLowerCase().includes(searchQuery.toLowerCase()) || r.category.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const theme = category ? getCategoryTheme(category) : null

  return (
    <div className="w-full max-w-5xl mx-auto space-y-6 pb-16">
      <div className="flex items-center justify-between">
        <button onClick={onBack} className="inline-flex items-center gap-2 text-xs font-semibold text-zinc-600 hover:text-zinc-950 transition cursor-pointer px-2.5 py-1.5 rounded-lg hover:bg-zinc-100">
          <ArrowLeft size={14} />
          <span>Back to Overview</span>
        </button>

        {category && (
          <button
            onClick={() => onOpenGoalModal(category)}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-zinc-700 bg-white hover:bg-zinc-100 px-3.5 py-1.5 rounded-xl border border-zinc-200/80 shadow-2xs transition cursor-pointer"
          >
            <Target size={14} style={{ color: theme?.color }} />
            <span>Edit Goal</span>
          </button>
        )}
      </div>

      <div className="bg-white rounded-3xl border border-black/5 shadow-[0_2px_14px_rgba(0,0,0,0.04)] p-6 sm:p-8">
        <div className="text-xs font-bold text-zinc-400 uppercase tracking-wider font-mono mb-3">
          {category ?? 'All Activity'} · Details
        </div>
        <div className="flex items-center gap-4 flex-wrap">
          <div className="bg-zinc-50 px-3 py-2 rounded-xl border border-zinc-100">
            <div className="text-[11px] text-zinc-500">Total activations</div>
            <div className="text-base font-bold text-zinc-900 font-mono">{totalActivations}</div>
          </div>
          <div className="bg-zinc-50 px-3 py-2 rounded-xl border border-zinc-100">
            <div className="text-[11px] text-zinc-500">Active time</div>
            <div className="text-base font-bold text-zinc-900 font-mono">{formatMinutes(totalMinutes)}</div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-zinc-200 shadow-2xs overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-zinc-100 bg-zinc-50/40">
          <div className="relative w-full sm:w-72">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search apps or domains..."
              className="w-full pl-9 pr-4 py-2 bg-white border border-zinc-200 rounded-xl text-xs text-zinc-800 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-[#007AFF] text-white font-semibold">
                <th className="py-2.5 px-4 sm:px-6">App / Domain</th>
                <th className="py-2.5 px-4 text-right">Activations</th>
                <th className="py-2.5 px-4 text-right hidden sm:table-cell">Duration</th>
                <th className="py-2.5 px-4 hidden md:table-cell">Category</th>
                <th className="py-2.5 px-4 text-right hidden lg:table-cell">Trend</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {filteredRows.map((row, index) => {
                const minutes = Math.round(row.durationMs / 60000)
                return (
                  <tr key={`${row.matchType}-${row.name}`} className={`hover:bg-zinc-50/80 transition ${index % 2 === 0 ? 'bg-white' : 'bg-zinc-50/30'}`}>
                    <td className="py-2.5 px-4 sm:px-6">
                      <div className="flex items-center gap-3">
                        <AppIcon name={row.name} isDomain={row.matchType === 'domain'} size={28} />
                        <span className="font-medium text-zinc-900 text-xs sm:text-sm">{row.name}</span>
                      </div>
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono font-semibold text-zinc-800 text-xs sm:text-sm">{row.activations}</td>
                    <td className="py-2.5 px-4 text-right font-mono text-zinc-500 hidden sm:table-cell">{formatMinutes(minutes)}</td>
                    <td className="py-2.5 px-4 hidden md:table-cell">
                      <span
                        className="inline-block px-2 py-0.5 rounded-md text-[11px] font-medium"
                        style={{ backgroundColor: `${getCategoryTheme(row.category).color}1A`, color: getCategoryTheme(row.category).color }}
                      >
                        {row.category}
                      </span>
                    </td>
                    <td className="py-2.5 px-4 text-right hidden lg:table-cell">
                      {row.direction === 'up' && (
                        <span className="text-rose-600 inline-flex items-center gap-0.5 font-mono text-[11px]">
                          <TrendingUp size={12} />+{row.trendPercent}%
                        </span>
                      )}
                      {row.direction === 'down' && (
                        <span className="text-emerald-600 inline-flex items-center gap-0.5 font-mono text-[11px]">
                          <TrendingDown size={12} />-{row.trendPercent}%
                        </span>
                      )}
                      {row.direction === 'stable' && <span className="text-zinc-400 font-mono text-[11px]">—</span>}
                    </td>
                  </tr>
                )
              })}

              {filteredRows.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-zinc-400">
                    {rows.length === 0 ? 'No activity recorded yet for this range.' : `No apps found for "${searchQuery}".`}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
