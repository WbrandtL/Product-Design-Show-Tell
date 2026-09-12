/** Channel name contract shared by the preload bridge and the main-process handlers. */
export const IPC = {
  getTrackingStatus: 'timeaware:getTrackingStatus',
  startTracking: 'timeaware:startTracking',
  stopTracking: 'timeaware:stopTracking',
  getCategoryTrend: 'timeaware:getCategoryTrend',
  getLocationTrend: 'timeaware:getLocationTrend',
  getWeekOverWeekDelta: 'timeaware:getWeekOverWeekDelta',
  getGoalProgress: 'timeaware:getGoalProgress',
  getGoals: 'timeaware:getGoals',
  setGoal: 'timeaware:setGoal',
  clearGoal: 'timeaware:clearGoal',
  getCategoryRules: 'timeaware:getCategoryRules',
  upsertCategoryRule: 'timeaware:upsertCategoryRule',
  deleteCategoryRule: 'timeaware:deleteCategoryRule',
  getSsidLabels: 'timeaware:getSsidLabels',
  setSsidLabel: 'timeaware:setSsidLabel',
  deleteSsidLabel: 'timeaware:deleteSsidLabel',
  getUnlabeledSsids: 'timeaware:getUnlabeledSsids'
} as const
