import type { WeekOverWeekDelta } from '../../../shared/types'

interface Props {
  deltas: WeekOverWeekDelta[]
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
 * Lists each category's week-over-week percent change in time spent,
 * e.g. "+12% more time on Social Media than last week".
 * Parameters:
 *     deltas (WeekOverWeekDelta[]): per-category deltas
 * Returns:
 *     element (JSX.Element): the delta list, or an empty state
 */
export default function WeekOverWeekList({ deltas }: Props): JSX.Element {
  if (deltas.length === 0) {
    return <div className="empty-state">Not enough history yet to compare weeks.</div>
  }

  return (
    <div className="delta-list">
      {deltas.map((delta) => {
        const direction = delta.percentChange === null || delta.percentChange === 0
          ? 'flat'
          : delta.percentChange > 0
            ? 'up'
            : 'down'
        return (
          <div className="delta-row" key={delta.category}>
            <span>{delta.category}</span>
            <span>
              <span className={`delta-badge ${direction}`}>{formatDelta(delta)}</span>{' '}
              <span style={{ color: 'var(--text-muted)' }}>
                {delta.thisWeekHours.toFixed(1)}h this week vs {delta.lastWeekHours.toFixed(1)}h last week
              </span>
            </span>
          </div>
        )
      })}
    </div>
  )
}
