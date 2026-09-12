/**
 * Formats a `YYYY-MM-DD` date string as a short display label, e.g.
 * "Mon 9/7". Used as the x-axis label in trend charts.
 * Parameters:
 *     dateStr (string): a `YYYY-MM-DD` date string
 * Returns:
 *     label (string): the short display label
 */
export function formatDisplayDate(dateStr: string): string {
  const [year, month, day] = dateStr.split('-').map(Number)
  const date = new Date(year as number, (month as number) - 1, day)
  const weekday = date.toLocaleDateString('en-US', { weekday: 'short' })
  return `${weekday} ${date.getMonth() + 1}/${date.getDate()}`
}

/**
 * Formats a minute count as "Xh Ym" (omitting the zero part), e.g. 285 ->
 * "4h 45m", 45 -> "45m", 120 -> "2h".
 * Parameters:
 *     minutes (number): total minutes
 * Returns:
 *     label (string): the formatted duration
 */
export function formatMinutes(minutes: number): string {
  const hrs = Math.floor(minutes / 60)
  const mins = Math.round(minutes % 60)
  if (hrs === 0) return `${mins}m`
  if (mins === 0) return `${hrs}h`
  return `${hrs}h ${mins}m`
}

/**
 * Converts hours to whole minutes, rounding to the nearest minute.
 * Parameters:
 *     hours (number): duration in hours
 * Returns:
 *     minutes (number): duration in whole minutes
 */
export function hoursToMinutes(hours: number): number {
  return Math.round(hours * 60)
}
