import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { LocationTrendPoint } from '../../../shared/types'

interface Props {
  points: LocationTrendPoint[]
}

const PALETTE = ['#2563eb', '#d97706', '#6b7280', '#7c3aed']

/**
 * Pivots flat (date, locationLabel, hours) points into one row per date
 * with a column per location, for a stacked bar chart.
 * Parameters:
 *     points (LocationTrendPoint[]): flat trend points
 * Returns:
 *     result ({ rows: Record<string, number | string>[]; locations: string[] }): pivoted rows and distinct location list
 */
function pivot(points: LocationTrendPoint[]): { rows: Record<string, number | string>[]; locations: string[] } {
  const dates = Array.from(new Set(points.map((p) => p.date))).sort()
  const locations = Array.from(new Set(points.map((p) => p.locationLabel))).sort()
  const rows = dates.map((date) => {
    const row: Record<string, number | string> = { date }
    for (const location of locations) {
      const match = points.find((p) => p.date === date && p.locationLabel === location)
      row[location] = match ? Math.round(match.hours * 100) / 100 : 0
    }
    return row
  })
  return { rows, locations }
}

/**
 * Renders daily active hours split by labeled Wi-Fi location (e.g. Home vs
 * Other) as a stacked bar chart.
 * Parameters:
 *     points (LocationTrendPoint[]): the data to plot
 * Returns:
 *     element (JSX.Element): the chart, or an empty state if there's no data yet
 */
export default function LocationTrendChart({ points }: Props): JSX.Element {
  if (points.length === 0) {
    return <div className="empty-state">No location data yet.</div>
  }

  const { rows, locations } = pivot(points)

  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={rows} margin={{ top: 4, right: 12, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
        <XAxis dataKey="date" tick={{ fontSize: 11 }} />
        <YAxis tick={{ fontSize: 11 }} unit="h" />
        <Tooltip />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        {locations.map((location, i) => (
          <Bar key={location} dataKey={location} stackId="location" fill={PALETTE[i % PALETTE.length]} />
        ))}
      </BarChart>
    </ResponsiveContainer>
  )
}
