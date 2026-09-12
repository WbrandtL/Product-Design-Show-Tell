import type {
  ActivityBreakdownRow,
  CategoryMatchType,
  CategoryRule,
  CategoryTrendPoint,
  Goal,
  GoalConstraintType,
  GoalProgress,
  LocationTrendPoint,
  RangeOption,
  SsidLabel,
  TrackingStatus,
  WeekOverWeekDelta
} from '../shared/types'

/** Renderer-side type contract for `window.timeaware`, matching preload/index.ts. */
interface TimeawareApi {
  getTrackingStatus: () => Promise<TrackingStatus>
  startTracking: () => Promise<void>
  stopTracking: () => Promise<void>

  getCategoryTrend: (range: RangeOption) => Promise<CategoryTrendPoint[]>
  getLocationTrend: (range: RangeOption) => Promise<LocationTrendPoint[]>
  getOutsideTrend: (range: RangeOption) => Promise<CategoryTrendPoint[]>
  getActivityBreakdown: (category: string | null, range: RangeOption) => Promise<ActivityBreakdownRow[]>
  getWeekOverWeekDelta: () => Promise<WeekOverWeekDelta[]>
  getGoalProgress: () => Promise<GoalProgress[]>

  getGoals: () => Promise<Goal[]>
  setGoal: (category: string, constraintType: GoalConstraintType, hoursPerDay: number) => Promise<Goal>
  clearGoal: (category: string) => Promise<void>

  getCategoryRules: () => Promise<CategoryRule[]>
  upsertCategoryRule: (matchType: CategoryMatchType, pattern: string, category: string) => Promise<CategoryRule>
  deleteCategoryRule: (id: number) => Promise<void>

  getSsidLabels: () => Promise<SsidLabel[]>
  setSsidLabel: (ssid: string, label: string) => Promise<void>
  deleteSsidLabel: (ssid: string) => Promise<void>
  getUnlabeledSsids: () => Promise<string[]>

  hideWindow: () => Promise<void>
  minimizeWindow: () => Promise<void>
  toggleFullScreenWindow: () => Promise<void>
}

declare global {
  interface Window {
    timeaware: TimeawareApi
  }
}

export {}
