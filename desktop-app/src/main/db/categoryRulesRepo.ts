import type Database from 'better-sqlite3'
import type { CategoryMatchType, CategoryRule } from '../../shared/types'

interface CategoryRuleRow {
  id: number
  match_type: CategoryMatchType
  pattern: string
  category: string
  is_default: number
}

function rowToRule(row: CategoryRuleRow): CategoryRule {
  return {
    id: row.id,
    matchType: row.match_type,
    pattern: row.pattern,
    category: row.category,
    isDefault: row.is_default === 1
  }
}

/**
 * Returns every category rule (default and user-added), ordered by category.
 * Parameters:
 *     db (Database.Database): open database connection
 * Returns:
 *     rules (CategoryRule[]): all app/domain -> category mappings
 */
export function getAllCategoryRules(db: Database.Database): CategoryRule[] {
  const rows = db
    .prepare(`SELECT * FROM category_rules ORDER BY category, match_type, pattern`)
    .all() as CategoryRuleRow[]
  return rows.map(rowToRule)
}

/**
 * Creates or updates a user-defined category rule for an exact app/domain
 * pattern. Matching is case-insensitive exact match, kept intentionally
 * simple for v1 (see README "extend categorization rules").
 * Parameters:
 *     db (Database.Database): open database connection
 *     matchType (CategoryMatchType): whether pattern matches an app name or a domain
 *     pattern (string): the app name or domain to match
 *     category (string): the category label to assign
 * Returns:
 *     rule (CategoryRule): the created or updated rule
 */
export function upsertCategoryRule(
  db: Database.Database,
  matchType: CategoryMatchType,
  pattern: string,
  category: string
): CategoryRule {
  db.prepare(
    `INSERT INTO category_rules (match_type, pattern, category, is_default)
     VALUES (@matchType, @pattern, @category, 0)
     ON CONFLICT (match_type, pattern) DO UPDATE SET category = excluded.category`
  ).run({ matchType, pattern, category })
  const row = db
    .prepare(`SELECT * FROM category_rules WHERE match_type = ? AND pattern = ?`)
    .get(matchType, pattern) as CategoryRuleRow
  return rowToRule(row)
}

/**
 * Deletes a category rule by id. Used from the settings UI to remove a
 * user-added mapping (default rules can also be removed if unwanted).
 * Parameters:
 *     db (Database.Database): open database connection
 *     id (number): id of the rule to delete
 * Returns:
 *     void
 */
export function deleteCategoryRule(db: Database.Database, id: number): void {
  db.prepare(`DELETE FROM category_rules WHERE id = ?`).run(id)
}
