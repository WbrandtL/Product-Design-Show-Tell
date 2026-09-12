import { ChevronRight, Target, TrendingDown, TrendingUp } from 'lucide-react'
import { getCategoryTheme } from '../lib/categoryTheme'
import { formatMinutes } from '../lib/format'
import { TrendLineChart, type TrendPoint } from './TrendLineChart'
import type { Goal } from '../../../shared/types'

interface Props {
  category: string
  description?: string
  todayMinutes: number
  weekOverWeekPercent: number | null
  history: TrendPoint[]
  goal: Goal | null
  onOpenDrilldown: () => void
  onOpenGoalModal: () => void
}

/**
 * Computes a sensible y-axis range for a trend chart from its own data
 * (plus the goal line, if any), so small-magnitude categories don't get
 * squashed against a chart scaled for a much larger one.
 * Parameters:
 *     history (TrendPoint[]): the series being charted
 *     goalMinutes (number | undefined): the goal line to also fit, if any
 * Returns:
 *     bounds ({ minY: number; maxY: number; ticks: number[] }): y-axis bounds and two guide ticks
 */
function computeYBounds(history: TrendPoint[], goalMinutes: number | undefined): { minY: number; maxY: number; ticks: number[] } {
  const values = history.map((p) => p.minutes)
  if (goalMinutes !== undefined) values.push(goalMinutes)
  const dataMax = Math.max(1, ...values)
  const dataMin = Math.min(...values, 0)
  const padding = Math.max(5, Math.round(dataMax * 0.15))
  const minY = Math.max(0, dataMin - padding)
  const maxY = dataMax + padding
  const ticks = [Math.round(minY + (maxY - minY) * 0.3), Math.round(minY + (maxY - minY) * 0.7)]
  return { minY, maxY, ticks }
}

/**
 * One Apple Health-style hero card: category icon/name, today's total,
 * week-over-week delta, the trend chart (with a dashed goal line if one is
 * set), and buttons to drill into per-app detail or edit the goal.
 * Parameters:
 *     category (string): category name this card represents
 *     description (string | undefined): optional one-line description under the headline number
 *     todayMinutes (number): today's total minutes so far
 *     weekOverWeekPercent (number | null): percent change vs. last week, or null if no prior data
 *     history (TrendPoint[]): daily series to chart
 *     goal (Goal | null): the active goal for this category, if any
 *     onOpenDrilldown (() => void): called when "Activity Details" is clicked
 *     onOpenGoalModal (() => void): called when "Edit Goal" is clicked
 * Returns:
 *     element (JSX.Element): the card
 */
export function MetricCard({
  category,
  description,
  todayMinutes,
  weekOverWeekPercent,
  history,
  goal,
  onOpenDrilldown,
  onOpenGoalModal
}: Props): JSX.Element {
  const theme = getCategoryTheme(category)
  const Icon = theme.icon
  const goalMinutes = goal ? Math.round(goal.hoursPerDay * 60) : undefined
  const { minY, maxY, ticks } = computeYBounds(history, goalMinutes)
  const isPositive = weekOverWeekPercent !== null && weekOverWeekPercent >= 0

  return (
    <div className="bg-white rounded-3xl border border-black/5 shadow-[0_2px_14px_rgba(0,0,0,0.04)] hover:shadow-[0_4px_20px_rgba(0,0,0,0.06)] transition-all duration-200 p-6 sm:p-7">
      <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-6">
        <div className="w-full lg:w-64 shrink-0 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2.5 mb-2.5">
              <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${theme.color}1A`, color: theme.color }}>
                <Icon size={18} strokeWidth={2.4} />
              </div>
              <div className="flex flex-col">
                <span className="text-xs font-bold tracking-wider uppercase font-mono" style={{ color: theme.color }}>
                  {category}
                </span>
                <span className="text-[11px] text-zinc-400 font-medium">Daily Trend</span>
              </div>
            </div>

            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-4xl sm:text-5xl font-extrabold tracking-tight text-zinc-900 font-mono">{todayMinutes}</span>
              <span className="text-sm font-bold text-zinc-400 uppercase tracking-wide">min</span>
            </div>

            <div className="mt-1 flex items-center gap-2 flex-wrap">
              <span className="text-xs font-semibold text-zinc-600">{formatMinutes(todayMinutes)} today</span>
              {weekOverWeekPercent !== null && (
                <>
                  <span className="text-zinc-300">·</span>
                  <span className={`text-xs font-semibold inline-flex items-center gap-1 ${isPositive ? 'text-emerald-600' : 'text-amber-600'}`}>
                    {isPositive ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                    {isPositive ? '+' : ''}
                    {Math.round(weekOverWeekPercent)}% vs. last week
                  </span>
                </>
              )}
            </div>

            {description && <p className="text-xs text-zinc-500 mt-2.5 leading-relaxed line-clamp-2">{description}</p>}
          </div>
        </div>

        <div className="flex-1 w-full min-w-0 bg-[#F9F9FB] rounded-2xl p-4 border border-zinc-100">
          <div className="flex items-center justify-between text-[11px] text-zinc-400 font-mono px-2 mb-1">
            <span>Active Minutes / Day</span>
            <span className="text-zinc-400">Straight Trend</span>
          </div>
          <TrendLineChart
            data={history}
            targetGoalMinutes={goalMinutes}
            color={theme.color}
            height={135}
            minY={minY}
            maxY={maxY}
            yAxisTicks={ticks}
            showLabels={history.length <= 10}
          />
        </div>

        <div className="shrink-0 flex flex-col items-stretch sm:items-end justify-center gap-2.5">
          <button
            onClick={onOpenDrilldown}
            className="px-4 py-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 active:scale-98 text-white text-xs font-semibold inline-flex items-center justify-center gap-2 transition cursor-pointer shadow-xs"
          >
            <span>Activity Details</span>
            <ChevronRight size={14} />
          </button>

          <button
            onClick={onOpenGoalModal}
            className="px-3 py-1.5 rounded-lg text-xs font-medium text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 transition inline-flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <Target size={13} style={{ color: theme.color }} />
            <span>{goal ? 'Edit Goal' : 'Set Goal'}</span>
          </button>
        </div>
      </div>
    </div>
  )
}
