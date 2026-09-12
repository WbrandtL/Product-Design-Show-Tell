import { formatDisplayDate, hoursToMinutes } from './format'
import type { TrendPoint } from '../components/TrendLineChart'

/**
 * Formats a Date as a local `YYYY-MM-DD` string, matching how the backend's
 * SQLite `date(timestamp/1000, 'unixepoch', 'localtime')` formats dates.
 * Parameters:
 *     date (Date): the date to format
 * Returns:
 *     dateStr (string): `YYYY-MM-DD`
 */
function toLocalDateString(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/** Today's date as a local `YYYY-MM-DD` string. */
export function getTodayDateString(): string {
  return toLocalDateString(new Date())
}

/**
 * Builds a complete, gap-free daily series for the last `rangeDays` days
 * (including today), filling in 0 for any day with no recorded hours.
 * Without this, a trend chart would draw a straight line connecting two
 * non-adjacent days as if they were consecutive, implying a slope that
 * isn't real.
 * Parameters:
 *     rangeDays (number): how many trailing days to include (7 or 30)
 *     points (Array<{ date: string; hours: number }>): sparse daily hours, any category already filtered
 * Returns:
 *     series (TrendPoint[]): one point per day, oldest first
 */
export function buildDailySeries(rangeDays: number, points: Array<{ date: string; hours: number }>): TrendPoint[] {
  const hoursByDate = new Map(points.map((p) => [p.date, p.hours]))
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const series: TrendPoint[] = []
  for (let i = rangeDays - 1; i >= 0; i--) {
    const day = new Date(today)
    day.setDate(day.getDate() - i)
    const dateStr = toLocalDateString(day)
    series.push({
      date: dateStr,
      displayDate: formatDisplayDate(dateStr),
      minutes: hoursToMinutes(hoursByDate.get(dateStr) ?? 0)
    })
  }
  return series
}
