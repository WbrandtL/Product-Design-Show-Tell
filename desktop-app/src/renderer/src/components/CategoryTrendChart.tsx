import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts'
import type { CategoryTrendPoint, Goal } from '../../../shared/types'

interface Props {
  points: CategoryTrendPoint[]
  goals: Goal[]
}

const PALETTE = ['#2563eb', '#16a34a', '#d97706', '#dc2626', '#7c3aed', '#0891b2', '#db2777']

/**
 * Pivots flat (date, category, hours) points into one row per date with a
 * column per category, the shape Recharts' multi-line chart expects.
 * Parameters:
 *     points (CategoryTrendPoint[]): flat trend points
 * Returns:
 *     result ({ rows: Record<string, number | string>[]; categories: string[] }): pivoted rows and the distinct category list
 */
function pivot(points: CategoryTrendPoint[]): { rows: Record<string, number | string>[]; categories: string[] } {
  const dates = Array.from(new Set(points.map((p) => p.date))).sort()
  const categories = Array.from(new Set(points.map((p) => p.category))).sort()
  const rows = dates.map((date) => {
    const row: Record<string, number | string> = { date }
    for (const category of categories) {
      const match = points.find((p) => p.date === date && p.category === category)
      row[category] = match ? Math.round(match.hours * 100) / 100 : 0
    }
    return row
  })
  return { rows, categories }
}

/**
 * Renders per-category hours-per-day as a multi-line trend chart, with a
 * dashed vertical marker at each date a goal changed (see goals prop),
 * satisfying "trend charts can show goal changed here".
 * Parameters:
 *     points (CategoryTrendPoint[]): the data to plot
 *     goals (Goal[]): full goal history, used only for their validFrom markers
 * Returns:
 *     element (JSX.Element): the chart, or an empty state if there's no data yet
 */
export default function CategoryTrendChart({ points, goals }: Props): JSX.Element {
  if (points.length === 0) {
    return <div className="empty-state">No activity recorded yet for this range.</div>
  }

  const { rows, categories } = pivot(points)
  const rowDates = new Set(rows.map((r) => r.date as string))
  const goalChangeDates = Array.from(
    new Set(
      goals
        .map((g) => new Date(g.validFrom).toISOString().slice(0, 10))
        .filter((date) => rowDates.has(date))
    )
  )

  return (
    <ResponsiveContainer width="100%" height={280}>
      <LineChart data={rows} margin={{ top: 4, right: 12, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
        <XAxis dataKey="date" tick={{ fontSize: 11 }} />
        <YAxis tick={{ fontSize: 11 }} unit="h" />
        <Tooltip />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        {categories.map((category, i) => (
          <Line
            key={category}
            type="monotone"
            dataKey={category}
            stroke={PALETTE[i % PALETTE.length]}
            dot={false}
            strokeWidth={2}
          />
        ))}
        {goalChangeDates.map((date) => (
          <ReferenceLine key={date} x={date} stroke="var(--text-muted)" strokeDasharray="4 4" label={{ value: 'goal changed', fontSize: 10, position: 'top' }} />
        ))}
      </LineChart>
    </ResponsiveContainer>
  )
}
