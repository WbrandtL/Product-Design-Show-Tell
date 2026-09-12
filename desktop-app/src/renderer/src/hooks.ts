import { useCallback, useEffect, useState } from 'react'
import type {
  CategoryRule,
  CategoryTrendPoint,
  Goal,
  GoalProgress,
  LocationTrendPoint,
  RangeOption,
  SsidLabel,
  TrackingStatus,
  WeekOverWeekDelta
} from '../../shared/types'

/**
 * Polls tracking status every few seconds so the dashboard reflects the
 * daemon's live state (e.g. toggled from the tray menu) without a manual refresh.
 * Parameters:
 *     none
 * Returns:
 *     result ({ status: TrackingStatus | null; refresh: () => void }): latest status and a manual refresh trigger
 */
export function useTrackingStatus(): { status: TrackingStatus | null; refresh: () => void } {
  const [status, setStatus] = useState<TrackingStatus | null>(null)

  const refresh = useCallback(() => {
    void window.timeaware.getTrackingStatus().then(setStatus)
  }, [])

  useEffect(() => {
    refresh()
    const interval = setInterval(refresh, 5000)
    return () => clearInterval(interval)
  }, [refresh])

  return { status, refresh }
}

/**
 * Fetches the category time trend for a given range, re-fetching whenever
 * the range or refreshKey changes.
 * Parameters:
 *     range (RangeOption): '7d' or '30d'
 *     refreshKey (number): bump this to force a re-fetch (e.g. after a goal edit)
 * Returns:
 *     points (CategoryTrendPoint[]): the trend data, empty while loading
 */
export function useCategoryTrend(range: RangeOption, refreshKey = 0): CategoryTrendPoint[] {
  const [points, setPoints] = useState<CategoryTrendPoint[]>([])
  useEffect(() => {
    void window.timeaware.getCategoryTrend(range).then(setPoints)
  }, [range, refreshKey])
  return points
}

/**
 * Fetches the location (home/other) time trend for a given range.
 * Parameters:
 *     range (RangeOption): '7d' or '30d'
 * Returns:
 *     points (LocationTrendPoint[]): the trend data, empty while loading
 */
export function useLocationTrend(range: RangeOption): LocationTrendPoint[] {
  const [points, setPoints] = useState<LocationTrendPoint[]>([])
  useEffect(() => {
    void window.timeaware.getLocationTrend(range).then(setPoints)
  }, [range])
  return points
}

/**
 * Fetches week-over-week percent-change deltas per category.
 * Parameters:
 *     refreshKey (number): bump this to force a re-fetch
 * Returns:
 *     deltas (WeekOverWeekDelta[]): the deltas, empty while loading
 */
export function useWeekOverWeekDelta(refreshKey = 0): WeekOverWeekDelta[] {
  const [deltas, setDeltas] = useState<WeekOverWeekDelta[]>([])
  useEffect(() => {
    void window.timeaware.getWeekOverWeekDelta().then(setDeltas)
  }, [refreshKey])
  return deltas
}

/**
 * Fetches goal-vs-actual progress for every active goal.
 * Parameters:
 *     refreshKey (number): bump this to force a re-fetch (e.g. after a goal edit)
 * Returns:
 *     result ({ progress: GoalProgress[]; refresh: () => void }): current progress and a manual refresh trigger
 */
export function useGoalProgress(refreshKey = 0): { progress: GoalProgress[]; refresh: () => void } {
  const [progress, setProgress] = useState<GoalProgress[]>([])

  const refresh = useCallback(() => {
    void window.timeaware.getGoalProgress().then(setProgress)
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh, refreshKey])

  return { progress, refresh }
}

/**
 * Fetches the full goal history (all categories, past and present).
 * Parameters:
 *     refreshKey (number): bump this to force a re-fetch
 * Returns:
 *     goals (Goal[]): full goal history
 */
export function useGoalHistory(refreshKey = 0): Goal[] {
  const [goals, setGoals] = useState<Goal[]>([])
  useEffect(() => {
    void window.timeaware.getGoals().then(setGoals)
  }, [refreshKey])
  return goals
}

/**
 * Fetches every configured category rule (default and user-added).
 * Parameters:
 *     refreshKey (number): bump this to force a re-fetch
 * Returns:
 *     result ({ rules: CategoryRule[]; refresh: () => void }): current rules and a manual refresh trigger
 */
export function useCategoryRules(refreshKey = 0): { rules: CategoryRule[]; refresh: () => void } {
  const [rules, setRules] = useState<CategoryRule[]>([])

  const refresh = useCallback(() => {
    void window.timeaware.getCategoryRules().then(setRules)
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh, refreshKey])

  return { rules, refresh }
}

/**
 * Fetches labeled SSIDs plus any observed-but-unlabeled SSIDs, for the
 * location settings screen.
 * Parameters:
 *     refreshKey (number): bump this to force a re-fetch
 * Returns:
 *     result ({ labels: SsidLabel[]; unlabeled: string[]; refresh: () => void }): current state and a manual refresh trigger
 */
export function useSsidLabels(refreshKey = 0): {
  labels: SsidLabel[]
  unlabeled: string[]
  refresh: () => void
} {
  const [labels, setLabels] = useState<SsidLabel[]>([])
  const [unlabeled, setUnlabeled] = useState<string[]>([])

  const refresh = useCallback(() => {
    void window.timeaware.getSsidLabels().then(setLabels)
    void window.timeaware.getUnlabeledSsids().then(setUnlabeled)
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh, refreshKey])

  return { labels, unlabeled, refresh }
}
