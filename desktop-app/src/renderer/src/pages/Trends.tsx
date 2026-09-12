import { useMemo, useState } from 'react'
import { OverviewView, type HeroCardData } from '../components/OverviewView'
import { ActivityDrilldownView } from '../components/ActivityDrilldownView'
import { GoalPlanningModal } from '../components/GoalPlanningModal'
import { useCategoryTrend, useGoalProgress, useOutsideTrend, useWeekOverWeekDelta } from '../hooks'
import { buildDailySeries, getTodayDateString } from '../lib/series'
import { hoursToMinutes } from '../lib/format'
import { OUTSIDE_PSEUDO_CATEGORY } from '../../../shared/constants'
import type { RangeOption } from '../../../shared/types'

/** The three always-shown hero categories, in display order. */
const HERO_CATEGORIES = ['Productivity', 'Entertainment', OUTSIDE_PSEUDO_CATEGORY] as const

const HERO_DESCRIPTIONS: Record<string, string> = {
  Productivity: 'Deep work focus, deliberate tool usage, coding, and creative work.',
  Entertainment: 'Passive consumption, casual feeds, and media streaming.',
  [OUTSIDE_PSEUDO_CATEGORY]: 'Time spent away from your home Wi-Fi network — outdoors, commuting, or elsewhere.'
}

/**
 * Top-level trends page: fetches every category/location trend needed for
 * the three hero cards and the full week-over-week breakdown, and switches
 * between the Overview and a per-category Activity Details drilldown. The
 * goal-planning modal is rendered here so it's reachable from both.
 * Parameters:
 *     none
 * Returns:
 *     element (JSX.Element): the trends page
 */
export default function Trends(): JSX.Element {
  const [range, setRange] = useState<RangeOption>('7d')
  const [refreshKey, setRefreshKey] = useState(0)
  const [drilldownCategory, setDrilldownCategory] = useState<string | null>(null)
  const [goalModalCategory, setGoalModalCategory] = useState<string | null>(null)

  const rangeDays = range === '7d' ? 7 : 30
  const today = getTodayDateString()

  const categoryTrend = useCategoryTrend(range, refreshKey)
  const outsideTrend = useOutsideTrend(range, refreshKey)
  const weekOverWeekDeltas = useWeekOverWeekDelta(refreshKey)
  const { progress: goalProgress, refresh: refreshGoalProgress } = useGoalProgress(refreshKey)

  const goalByCategory = useMemo(() => new Map(goalProgress.map((g) => [g.goal.category, g.goal])), [goalProgress])

  const heroCards: HeroCardData[] = useMemo(
    () =>
      HERO_CATEGORIES.map((category) => {
        const sourcePoints = category === OUTSIDE_PSEUDO_CATEGORY ? outsideTrend : categoryTrend.filter((p) => p.category === category)
        const history = buildDailySeries(rangeDays, sourcePoints)
        const todayPoint = sourcePoints.find((p) => p.date === today)
        const delta = weekOverWeekDeltas.find((d) => d.category === category)
        return {
          category,
          description: HERO_DESCRIPTIONS[category] ?? '',
          todayMinutes: todayPoint ? hoursToMinutes(todayPoint.hours) : 0,
          weekOverWeekPercent: delta?.percentChange ?? null,
          history,
          goal: goalByCategory.get(category) ?? null
        }
      }),
    [categoryTrend, outsideTrend, weekOverWeekDeltas, goalByCategory, rangeDays, today]
  )

  const handleGoalSaved = (): void => {
    refreshGoalProgress()
    setRefreshKey((k) => k + 1)
  }

  return (
    <>
      {drilldownCategory === null ? (
        <OverviewView
          range={range}
          setRange={setRange}
          heroCards={heroCards}
          weekOverWeekDeltas={weekOverWeekDeltas}
          onOpenDrilldown={setDrilldownCategory}
          onOpenGoalModal={setGoalModalCategory}
        />
      ) : (
        <ActivityDrilldownView
          category={drilldownCategory}
          range={range}
          onBack={() => setDrilldownCategory(null)}
          onOpenGoalModal={setGoalModalCategory}
        />
      )}

      <GoalPlanningModal
        isOpen={goalModalCategory !== null}
        category={goalModalCategory ?? ''}
        currentGoal={goalModalCategory ? (goalByCategory.get(goalModalCategory) ?? null) : null}
        onClose={() => setGoalModalCategory(null)}
        onSaved={handleGoalSaved}
      />
    </>
  )
}
