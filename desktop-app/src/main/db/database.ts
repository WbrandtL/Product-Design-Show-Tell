import Database from 'better-sqlite3'
import { app } from 'electron'
import { join } from 'node:path'
import { DEFAULT_CATEGORY_RULES, SCHEMA_SQL } from './schema'

let db: Database.Database | null = null

/**
 * Opens (creating if needed) the on-disk SQLite database, applies the schema,
 * and seeds default category rules on first run. Safe to call multiple times;
 * subsequent calls return the already-open connection.
 * Parameters:
 *     none
 * Returns:
 *     db (Database.Database): the shared better-sqlite3 connection
 */
export function getDatabase(): Database.Database {
  if (db) return db

  const dbPath = join(app.getPath('userData'), 'timeaware.sqlite3')
  db = new Database(dbPath)
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')
  db.exec(SCHEMA_SQL)
  seedDefaultCategoryRules(db)
  return db
}

/**
 * Inserts the shipped default app/domain -> category rules if they are not
 * already present. Uses INSERT OR IGNORE so re-running on every launch is
 * idempotent and never clobbers a user's own edits to the same pattern.
 * Parameters:
 *     database (Database.Database): open connection to seed
 * Returns:
 *     void
 */
function seedDefaultCategoryRules(database: Database.Database): void {
  const insert = database.prepare(
    `INSERT OR IGNORE INTO category_rules (match_type, pattern, category, is_default)
     VALUES (@matchType, @pattern, @category, 1)`
  )
  const seedAll = database.transaction((rules: typeof DEFAULT_CATEGORY_RULES) => {
    for (const rule of rules) insert.run(rule)
  })
  seedAll(DEFAULT_CATEGORY_RULES)
}

/**
 * Closes the database connection if open. Called on app quit.
 * Parameters:
 *     none
 * Returns:
 *     void
 */
export function closeDatabase(): void {
  db?.close()
  db = null
}
