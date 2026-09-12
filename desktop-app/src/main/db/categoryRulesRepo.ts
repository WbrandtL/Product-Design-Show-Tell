import type Database from 'better-sqlite3'
import { guessCategory } from '../aggregation/categorize'
import type { CategoryMatchType, CategoryRule } from '../../shared/types'

interface CategoryRuleRow {
  id: number
  match_type: CategoryMatchType
  pattern: string
  category: string
  is_default: number
  auto_suggested: number
}

function rowToRule(row: CategoryRuleRow): CategoryRule {
  return {
    id: row.id,
    matchType: row.match_type,
    pattern: row.pattern,
    category: row.category,
    isDefault: row.is_default === 1,
    autoSuggested: row.auto_suggested === 1
  }
}

/**
 * Returns every category rule (default, auto-suggested, and user-added),
 * ordered by category.
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
 * Creates or updates a category rule for an exact app/domain pattern.
 * Matching is case-insensitive exact match, kept intentionally simple for
 * v1 (see README "extend categorization rules"). A manual upsert always
 * clears is_default/auto_suggested — once a human has confirmed or
 * overridden a mapping, it's no longer just a shipped default or a guess.
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
    `INSERT INTO category_rules (match_type, pattern, category, is_default, auto_suggested)
     VALUES (@matchType, @pattern, @category, 0, 0)
     ON CONFLICT (match_type, pattern) DO UPDATE SET category = excluded.category, is_default = 0, auto_suggested = 0`
  ).run({ matchType, pattern, category })
  const row = db
    .prepare(`SELECT * FROM category_rules WHERE match_type = ? AND pattern = ?`)
    .get(matchType, pattern) as CategoryRuleRow
  return rowToRule(row)
}

/**
 * Deletes a category rule by id. Used from the settings UI to remove a
 * mapping (default and auto-suggested rules can also be removed). Deleting
 * an auto-suggested rule stays deleted — see autoCategorizeIfNew, which
 * never retries a (matchType, pattern) it has already attempted once.
 * Parameters:
 *     db (Database.Database): open database connection
 *     id (number): id of the rule to delete
 * Returns:
 *     void
 */
export function deleteCategoryRule(db: Database.Database, id: number): void {
  db.prepare(`DELETE FROM category_rules WHERE id = ?`).run(id)
}

/**
 * Attempts to auto-categorize a single app name or domain the first time
 * it's ever seen: if this exact (matchType, pattern) has never been
 * attempted before, runs the keyword heuristic (see aggregation/categorize)
 * and, if it produces a guess, inserts a real category_rules row for it
 * (marked auto_suggested, so the Settings UI can flag it for review).
 *
 * Recording the attempt regardless of outcome is what makes deleting an
 * auto-suggested rule stick — without it, the very next matching event
 * would just recreate the guess.
 * Parameters:
 *     db (Database.Database): open database connection
 *     matchType (CategoryMatchType): whether pattern is an app name or a domain
 *     pattern (string): the app name or domain observed
 * Returns:
 *     void
 */
export function autoCategorizeIfNew(db: Database.Database, matchType: CategoryMatchType, pattern: string): void {
  const attempted = db
    .prepare(`INSERT OR IGNORE INTO category_auto_attempts (match_type, pattern) VALUES (?, ?)`)
    .run(matchType, pattern)
  if (attempted.changes === 0) return // already tried this exact pattern before

  const guessed = guessCategory(matchType, pattern)
  if (guessed === null) return

  db.prepare(
    `INSERT OR IGNORE INTO category_rules (match_type, pattern, category, is_default, auto_suggested)
     VALUES (?, ?, ?, 0, 1)`
  ).run(matchType, pattern, guessed)
}

/**
 * Runs auto-categorization once over every distinct app name / domain
 * already present in raw_events, so activity recorded before this feature
 * existed (or before the daemon happens to see that app again) gets
 * categorized immediately rather than waiting for the next matching event.
 * Cheap to call on every launch: already-attempted patterns are skipped.
 * Parameters:
 *     db (Database.Database): open database connection
 * Returns:
 *     void
 */
export function backfillAutoCategorization(db: Database.Database): void {
  const appNames = db
    .prepare(`SELECT DISTINCT app_name FROM raw_events WHERE source = 'desktop'`)
    .all() as Array<{ app_name: string }>
  for (const { app_name } of appNames) {
    autoCategorizeIfNew(db, 'app', app_name)
  }

  const domains = db
    .prepare(`SELECT DISTINCT domain FROM raw_events WHERE source = 'browser_extension' AND domain IS NOT NULL`)
    .all() as Array<{ domain: string }>
  for (const { domain } of domains) {
    autoCategorizeIfNew(db, 'domain', domain)
  }
}
