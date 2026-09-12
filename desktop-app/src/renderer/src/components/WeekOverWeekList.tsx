import { ChevronRight } from 'lucide-react'
import { getCategoryTheme } from '../lib/categoryTheme'
import { formatMinutes, hoursToMinutes } from '../lib/format'
import type { WeekOverWeekDelta } from '../../../shared/types'

interface Props {
  deltas: WeekOverWeekDelta[]
  onSelectCategory: (category: string) => void
}

/**
 * Formats a percent-change value as a signed, rounded string, or "new" when
 * there was no time in that category last week to compare against.
 * Parameters:
 *     delta (WeekOverWeekDelta): the delta to format
 * Returns:
 *     label (string): human-readable delta label
 */
function formatDelta(delta: WeekOverWeekDelta): string {
  if (delta.percentChange === null) return delta.thisWeekHours > 0 ? 'new' : '—'
  const rounded = Math.round(delta.percentChange)
  return `${rounded > 0 ? '+' : ''}${rounded}%`
}

/**
 * Lists every category's week-over-week percent change in time spent (the
 * full breakdown — not just the three hero categories above). Clicking a
 * row opens the Activity Details drilldown filtered to that category.
 * Parameters:
 *     deltas (WeekOverWeekDelta[]): per-category deltas, all categories with any data
 *     onSelectCategory ((category: string) => void): called when a row is clicked
 * Returns:
 *     element (JSX.Element): the delta list, or an empty state
 */
export function WeekOverWeekList({ deltas, onSelectCategory }: Props): JSX.Element {
  if (deltas.length === 0) {
    return <div className="py-8 text-center text-zinc-400 text-sm">Not enough history yet to compare weeks.</div>
  }

  return (
    <div className="divide-y divide-zinc-100">
      {deltas.map((delta) => {
        const theme = getCategoryTheme(delta.category)
        const Icon = theme.icon
        const direction = delta.percentChange === null || delta.percentChange === 0 ? 'flat' : delta.percentChange > 0 ? 'up' : 'down'
        return (
          <button
            key={delta.category}
            onClick={() => onSelectCategory(delta.category)}
            className="w-full flex items-center justify-between gap-3 py-3 px-1 hover:bg-zinc-50/80 transition text-left cursor-pointer group"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: `${theme.color}1A`, color: theme.color }}>
                <Icon size={14} />
              </div>
              <span className="text-sm font-medium text-zinc-800 truncate">{delta.category}</span>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <span
                className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                  direction === 'up' ? 'text-rose-600 bg-rose-50' : direction === 'down' ? 'text-emerald-600 bg-emerald-50' : 'text-zinc-500 bg-zinc-100'
                }`}
              >
                {formatDelta(delta)}
              </span>
              <span className="text-xs text-zinc-400 font-mono hidden sm:inline">
                {formatMinutes(hoursToMinutes(delta.thisWeekHours))} this wk
              </span>
              <ChevronRight size={14} className="text-zinc-300 group-hover:text-zinc-500 transition" />
            </div>
          </button>
        )
      })}
    </div>
  )
}
