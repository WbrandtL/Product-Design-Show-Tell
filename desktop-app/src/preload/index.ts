import { contextBridge, ipcRenderer } from 'electron'
import { IPC } from '../shared/ipcChannels'
import type {
  CategoryMatchType,
  GoalConstraintType,
  RangeOption
} from '../shared/types'

/**
 * The narrow, typed surface exposed to the renderer. Every call is a thin
 * pass-through to an ipcMain.handle() registered in main/ipcHandlers.ts —
 * no business logic lives here, so the contract stays easy to audit.
 */
const timeawareApi = {
  getTrackingStatus: () => ipcRenderer.invoke(IPC.getTrackingStatus),
  startTracking: () => ipcRenderer.invoke(IPC.startTracking),
  stopTracking: () => ipcRenderer.invoke(IPC.stopTracking),

  getCategoryTrend: (range: RangeOption) => ipcRenderer.invoke(IPC.getCategoryTrend, range),
  getLocationTrend: (range: RangeOption) => ipcRenderer.invoke(IPC.getLocationTrend, range),
  getOutsideTrend: (range: RangeOption) => ipcRenderer.invoke(IPC.getOutsideTrend, range),
  getActivityBreakdown: (category: string | null, range: RangeOption) =>
    ipcRenderer.invoke(IPC.getActivityBreakdown, category, range),
  getWeekOverWeekDelta: () => ipcRenderer.invoke(IPC.getWeekOverWeekDelta),
  getGoalProgress: () => ipcRenderer.invoke(IPC.getGoalProgress),

  getGoals: () => ipcRenderer.invoke(IPC.getGoals),
  setGoal: (category: string, constraintType: GoalConstraintType, hoursPerDay: number) =>
    ipcRenderer.invoke(IPC.setGoal, category, constraintType, hoursPerDay),
  clearGoal: (category: string) => ipcRenderer.invoke(IPC.clearGoal, category),

  getCategoryRules: () => ipcRenderer.invoke(IPC.getCategoryRules),
  upsertCategoryRule: (matchType: CategoryMatchType, pattern: string, category: string) =>
    ipcRenderer.invoke(IPC.upsertCategoryRule, matchType, pattern, category),
  deleteCategoryRule: (id: number) => ipcRenderer.invoke(IPC.deleteCategoryRule, id),

  getSsidLabels: () => ipcRenderer.invoke(IPC.getSsidLabels),
  setSsidLabel: (ssid: string, label: string) => ipcRenderer.invoke(IPC.setSsidLabel, ssid, label),
  deleteSsidLabel: (ssid: string) => ipcRenderer.invoke(IPC.deleteSsidLabel, ssid),
  getUnlabeledSsids: () => ipcRenderer.invoke(IPC.getUnlabeledSsids),

  hideWindow: () => ipcRenderer.invoke(IPC.hideWindow),
  minimizeWindow: () => ipcRenderer.invoke(IPC.minimizeWindow),
  toggleFullScreenWindow: () => ipcRenderer.invoke(IPC.toggleFullScreenWindow)
}

contextBridge.exposeInMainWorld('timeaware', timeawareApi)

export type TimeawareApi = typeof timeawareApi
