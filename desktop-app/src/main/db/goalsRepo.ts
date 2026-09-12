import type Database from 'better-sqlite3'
import type { Goal, GoalConstraintType } from '../../shared/types'

interface GoalRow {
  id: number
  category: string
  constraint_type: GoalConstraintType
  hours_per_day: number
  valid_from: number
  valid_to: number | null
}

function rowToGoal(row: GoalRow): Goal {
  return {
    id: row.id,
    category: row.category,
    constraintType: row.constraint_type,
    hoursPerDay: row.hours_per_day,
    validFrom: row.valid_from,
    validTo: row.valid_to
  }
}

/**
 * Returns the currently-active goal for every category that has one
 * (valid_to IS NULL), plus every past (superseded) goal version. Callers
 * that only need "goals in effect right now" should filter on validTo.
 * Parameters:
 *     db (Database.Database): open database connection
 * Returns:
 *     goals (Goal[]): full goal history, newest-per-category first
 */
export function getAllGoals(db: Database.Database): Goal[] {
  const rows = db.prepare(`SELECT * FROM goals ORDER BY category, valid_from DESC`).all() as GoalRow[]
  return rows.map(rowToGoal)
}

/**
 * Returns only the goals currently in effect (one per category at most).
 * Parameters:
 *     db (Database.Database): open database connection
 * Returns:
 *     goals (Goal[]): active goals, one per category
 */
export function getActiveGoals(db: Database.Database): Goal[] {
  const rows = db
    .prepare(`SELECT * FROM goals WHERE valid_to IS NULL ORDER BY category`)
    .all() as GoalRow[]
  return rows.map(rowToGoal)
}

/**
 * Sets the goal for a category. If a goal is already active for that
 * category, it is closed (valid_to = now) rather than overwritten, so trend
 * charts can still render the old goal line for the period it was active.
 * Parameters:
 *     db (Database.Database): open database connection
 *     category (string): category the goal applies to
 *     constraintType (GoalConstraintType): 'max' or 'min'
 *     hoursPerDay (number): the goal threshold, in hours/day
 * Returns:
 *     goal (Goal): the newly created active goal
 */
export function setGoal(
  db: Database.Database,
  category: string,
  constraintType: GoalConstraintType,
  hoursPerDay: number
): Goal {
  const now = Date.now()
  const createGoal = db.transaction(() => {
    db.prepare(`UPDATE goals SET valid_to = ? WHERE category = ? AND valid_to IS NULL`).run(now, category)
    const result = db
      .prepare(
        `INSERT INTO goals (category, constraint_type, hours_per_day, valid_from, valid_to)
         VALUES (?, ?, ?, ?, NULL)`
      )
      .run(category, constraintType, hoursPerDay, now)
    return result.lastInsertRowid as number
  })
  const id = createGoal()
  const row = db.prepare(`SELECT * FROM goals WHERE id = ?`).get(id) as GoalRow
  return rowToGoal(row)
}

/**
 * Ends a goal (sets valid_to = now) without replacing it, removing the
 * constraint going forward while keeping its history intact.
 * Parameters:
 *     db (Database.Database): open database connection
 *     category (string): category whose active goal should be cleared
 * Returns:
 *     void
 */
export function clearGoal(db: Database.Database, category: string): void {
  db.prepare(`UPDATE goals SET valid_to = ? WHERE category = ? AND valid_to IS NULL`).run(Date.now(), category)
}
