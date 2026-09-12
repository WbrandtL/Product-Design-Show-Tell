import { useState } from 'react'
import type { GoalConstraintType, GoalProgress } from '../../../shared/types'

interface Props {
  progress: GoalProgress[]
  categories: string[]
  onChanged: () => void
}

/**
 * Computes today's progress fraction (0-1+) toward a goal's daily hour
 * threshold, and whether that counts as a breach right now.
 * Parameters:
 *     item (GoalProgress): today's hours plus the goal definition
 * Returns:
 *     result ({ fraction: number; breached: boolean }): progress fraction and breach flag
 */
function computeProgress(item: GoalProgress): { fraction: number; breached: boolean } {
  const { goal, todayHours } = item
  if (goal.constraintType === 'max') {
    return { fraction: Math.min(todayHours / goal.hoursPerDay, 1), breached: todayHours > goal.hoursPerDay }
  }
  return { fraction: Math.min(todayHours / goal.hoursPerDay, 1), breached: todayHours < goal.hoursPerDay }
}

/**
 * Displays goal-vs-actual for every active goal (today's hours against the
 * daily threshold, plus the 7-day average) directly beside the trend chart,
 * and provides the inline form to add or change a goal — goals are always
 * editable, and past versions are preserved as history by the backend.
 * Parameters:
 *     progress (GoalProgress[]): current goal progress snapshots
 *     categories (string[]): known categories, offered as datalist suggestions
 *     onChanged (() => void): called after a goal is set or cleared, to trigger a re-fetch
 * Returns:
 *     element (JSX.Element): the goals panel
 */
export default function GoalPanel({ progress, categories, onChanged }: Props): JSX.Element {
  const [category, setCategory] = useState('')
  const [constraintType, setConstraintType] = useState<GoalConstraintType>('max')
  const [hoursPerDay, setHoursPerDay] = useState('2')

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault()
    const hours = Number.parseFloat(hoursPerDay)
    if (!category.trim() || Number.isNaN(hours) || hours <= 0) return
    await window.timeaware.setGoal(category.trim(), constraintType, hours)
    setCategory('')
    onChanged()
  }

  const handleClear = async (goalCategory: string): Promise<void> => {
    await window.timeaware.clearGoal(goalCategory)
    onChanged()
  }

  return (
    <div className="goal-list">
      {progress.length === 0 ? (
        <div className="empty-state">No goals set yet — add one below.</div>
      ) : (
        progress.map((item) => {
          const { fraction, breached } = computeProgress(item)
          return (
            <div className="goal-item" key={item.goal.id}>
              <div className="goal-item-header">
                <span className="goal-label">
                  {item.goal.constraintType === 'max' ? 'Max' : 'Min'} {item.goal.hoursPerDay}h/day ·{' '}
                  {item.goal.category}
                </span>
                <span className={`goal-status ${breached ? 'breach' : 'ok'}`}>
                  {breached ? (item.goal.constraintType === 'max' ? 'Over budget' : 'Below target') : 'On track'}
                </span>
              </div>
              <div className="progress-track">
                <div
                  className={`progress-fill ${breached ? 'breach' : ''}`}
                  style={{ width: `${Math.round(fraction * 100)}%` }}
                />
              </div>
              <div className="goal-meta">
                Today: {item.todayHours.toFixed(1)}h · 7-day avg: {item.averageDailyHoursLast7Days.toFixed(1)}h/day
                {' · '}
                <button className="text-button" onClick={() => void handleClear(item.goal.category)}>
                  remove goal
                </button>
              </div>
            </div>
          )
        })
      )}

      <form className="inline-form" onSubmit={(e) => void handleSubmit(e)}>
        <input
          list="category-options"
          placeholder="Category"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
        />
        <datalist id="category-options">
          {categories.map((c) => (
            <option key={c} value={c} />
          ))}
        </datalist>
        <select value={constraintType} onChange={(e) => setConstraintType(e.target.value as GoalConstraintType)}>
          <option value="max">max</option>
          <option value="min">min</option>
        </select>
        <input
          type="number"
          min="0.25"
          step="0.25"
          style={{ width: 64 }}
          value={hoursPerDay}
          onChange={(e) => setHoursPerDay(e.target.value)}
        />
        <span className="goal-meta">hours/day</span>
        <button type="submit">Set Goal</button>
      </form>
    </div>
  )
}
