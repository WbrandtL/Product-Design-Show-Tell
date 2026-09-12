import { ipcMain } from 'electron'
import type Database from 'better-sqlite3'
import { IPC } from '../shared/ipcChannels'
import type { CategoryMatchType, GoalConstraintType, RangeOption } from '../shared/types'
import type { TrackingDaemon } from './tracking/trackingDaemon'
import { INGEST_SERVER_PORT } from './server/ingestServer'
import { getCategoryTrend, getGoalProgress, getLocationTrend, getWeekOverWeekDelta } from './aggregation/trends'
import {
  deleteCategoryRule,
  getAllCategoryRules,
  upsertCategoryRule
} from './db/categoryRulesRepo'
import { clearGoal, getAllGoals, setGoal } from './db/goalsRepo'
import { deleteSsidLabel, getAllSsidLabels, getUnlabeledObservedSsids, setSsidLabel } from './db/ssidLabelsRepo'

const DAY_MS = 24 * 60 * 60 * 1000

/**
 * Converts a UI range selector into a concrete [startMs, endMs) window
 * ending now.
 * Parameters:
 *     range (RangeOption): '7d' or '30d'
 * Returns:
 *     window ({ startMs: number; endMs: number }): the resolved time window
 */
function resolveRange(range: RangeOption): { startMs: number; endMs: number } {
  const days = range === '7d' ? 7 : 30
  const endMs = Date.now()
  return { startMs: endMs - days * DAY_MS, endMs }
}

/**
 * Registers every ipcMain.handle() endpoint the renderer calls through the
 * preload bridge. This is the single place where renderer requests cross
 * into the data layer and tracking daemon — see preload/index.ts for the
 * matching contextBridge surface.
 * Parameters:
 *     getDb (() => Database.Database): accessor for the shared SQLite connection
 *     daemon (TrackingDaemon): the tracking daemon the UI's toggle controls
 * Returns:
 *     void
 */
export function registerIpcHandlers(getDb: () => Database.Database, daemon: TrackingDaemon): void {
  ipcMain.handle(IPC.getTrackingStatus, () => ({
    ...daemon.getStatus(),
    ingestServerPort: INGEST_SERVER_PORT
  }))

  ipcMain.handle(IPC.startTracking, () => daemon.start())
  ipcMain.handle(IPC.stopTracking, () => daemon.stop())

  ipcMain.handle(IPC.getCategoryTrend, (_event, range: RangeOption) => {
    const { startMs, endMs } = resolveRange(range)
    return getCategoryTrend(getDb(), startMs, endMs)
  })

  ipcMain.handle(IPC.getLocationTrend, (_event, range: RangeOption) => {
    const { startMs, endMs } = resolveRange(range)
    return getLocationTrend(getDb(), startMs, endMs)
  })

  ipcMain.handle(IPC.getWeekOverWeekDelta, () => getWeekOverWeekDelta(getDb()))
  ipcMain.handle(IPC.getGoalProgress, () => getGoalProgress(getDb()))

  ipcMain.handle(IPC.getGoals, () => getAllGoals(getDb()))
  ipcMain.handle(
    IPC.setGoal,
    (_event, category: string, constraintType: GoalConstraintType, hoursPerDay: number) =>
      setGoal(getDb(), category, constraintType, hoursPerDay)
  )
  ipcMain.handle(IPC.clearGoal, (_event, category: string) => clearGoal(getDb(), category))

  ipcMain.handle(IPC.getCategoryRules, () => getAllCategoryRules(getDb()))
  ipcMain.handle(
    IPC.upsertCategoryRule,
    (_event, matchType: CategoryMatchType, pattern: string, category: string) =>
      upsertCategoryRule(getDb(), matchType, pattern, category)
  )
  ipcMain.handle(IPC.deleteCategoryRule, (_event, id: number) => deleteCategoryRule(getDb(), id))

  ipcMain.handle(IPC.getSsidLabels, () => getAllSsidLabels(getDb()))
  ipcMain.handle(IPC.setSsidLabel, (_event, ssid: string, label: string) => setSsidLabel(getDb(), ssid, label))
  ipcMain.handle(IPC.deleteSsidLabel, (_event, ssid: string) => deleteSsidLabel(getDb(), ssid))
  ipcMain.handle(IPC.getUnlabeledSsids, () => getUnlabeledObservedSsids(getDb()))
}
