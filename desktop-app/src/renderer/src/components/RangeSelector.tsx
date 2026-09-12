import type { RangeOption } from '../../../shared/types'

interface Props {
  value: RangeOption
  onChange: (value: RangeOption) => void
}

/**
 * Two-button toggle between the 7-day and 30-day trend views. Default view
 * is always one of these — there is intentionally no "today" option, since
 * trend comparison over time is the point of the app.
 * Parameters:
 *     value (RangeOption): the currently selected range
 *     onChange ((value: RangeOption) => void): called when the user picks a different range
 * Returns:
 *     element (JSX.Element): the range toggle
 */
export default function RangeSelector({ value, onChange }: Props): JSX.Element {
  return (
    <div className="range-selector">
      <button className={value === '7d' ? 'active' : ''} onClick={() => onChange('7d')}>
        Last 7 days
      </button>
      <button className={value === '30d' ? 'active' : ''} onClick={() => onChange('30d')}>
        Last 30 days
      </button>
    </div>
  )
}
