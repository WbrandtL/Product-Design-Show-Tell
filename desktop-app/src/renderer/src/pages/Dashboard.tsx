import { useMemo, useState } from 'react'
import RangeSelector from '../components/RangeSelector'
import CategoryTrendChart from '../components/CategoryTrendChart'
import LocationTrendChart from '../components/LocationTrendChart'
import WeekOverWeekList from '../components/WeekOverWeekList'
import GoalPanel from '../components/GoalPanel'
import { useCategoryTrend, useGoalHistory, useGoalProgress, useLocationTrend, useWeekOverWeekDelta } from '../hooks'
import type { RangeOption } from '../../../shared/types'

/**
 * The main trend view: category time trends, week-over-week deltas,
 * goal-vs-actual, and the home/other location split — all on one screen,
 * with the 7d/30d range shared across every chart.
 * Parameters:
 *     none
 * Returns:
 *     element (JSX.Element): the dashboard page
 */
export default function Dashboard(): JSX.Element {
  const [range, setRange] = useState<RangeOption>('7d')
  const [refreshKey, setRefreshKey] = useState(0)

  const categoryPoints = useCategoryTrend(range, refreshKey)
  const locationPoints = useLocationTrend(range)
  const weekOverWeek = useWeekOverWeekDelta(refreshKey)
  const { progress, refresh: refreshGoals } = useGoalProgress(refreshKey)
  const goalHistory = useGoalHistory(refreshKey)

  const categories = useMemo(
    () => Array.from(new Set(categoryPoints.map((p) => p.category))).sort(),
    [categoryPoints]
  )

  const handleGoalsChanged = (): void => {
    refreshGoals()
    setRefreshKey((k) => k + 1)
  }

  return (
    <>
      <div className="row">
        <div className="card" style={{ flex: 2 }}>
          <div className="card-header">
            <div>
              <h2 className="card-title">Time by category</h2>
              <p className="card-subtitle">Hours per day, split by category</p>
            </div>
            <RangeSelector value={range} onChange={setRange} />
          </div>
          <CategoryTrendChart points={categoryPoints} goals={goalHistory} />
        </div>

        <div className="card">
          <div className="card-header">
            <div>
              <h2 className="card-title">Week over week</h2>
              <p className="card-subtitle">vs. the previous 7 days</p>
            </div>
          </div>
          <WeekOverWeekList deltas={weekOverWeek} />
        </div>
      </div>

      <div className="row">
        <div className="card">
          <div className="card-header">
            <div>
              <h2 className="card-title">Goals</h2>
              <p className="card-subtitle">Goal vs. actual, updated live</p>
            </div>
          </div>
          <GoalPanel progress={progress} categories={categories} onChanged={handleGoalsChanged} />
        </div>

        <div className="card">
          <div className="card-header">
            <div>
              <h2 className="card-title">Home vs. other locations</h2>
              <p className="card-subtitle">Based on labeled Wi-Fi networks (see Settings)</p>
            </div>
          </div>
          <LocationTrendChart points={locationPoints} />
        </div>
      </div>
    </>
  )
}
