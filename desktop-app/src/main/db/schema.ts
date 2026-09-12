/**
 * Raw SQL DDL for the TimeAware database.
 *
 * Design note: `raw_events` is append-only and never overwritten — it is the
 * source of truth. All trend/goal calculations in `aggregation/` read from it
 * (or from `category_rules` / `ssid_labels` / `goals`) with plain SQL queries
 * rather than materialized rollup tables, so a future data source or metric
 * only needs a new query, never a schema migration of historical data.
 */
export const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS raw_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source TEXT NOT NULL CHECK (source IN ('desktop', 'browser_extension')),
  timestamp INTEGER NOT NULL,
  duration_ms INTEGER NOT NULL,
  app_name TEXT NOT NULL,
  window_title TEXT,
  domain TEXT,
  is_idle INTEGER NOT NULL DEFAULT 0,
  ssid TEXT
);

CREATE INDEX IF NOT EXISTS idx_raw_events_timestamp ON raw_events (timestamp);
CREATE INDEX IF NOT EXISTS idx_raw_events_source_timestamp ON raw_events (source, timestamp);

CREATE TABLE IF NOT EXISTS category_rules (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  match_type TEXT NOT NULL CHECK (match_type IN ('app', 'domain')),
  pattern TEXT NOT NULL,
  category TEXT NOT NULL,
  is_default INTEGER NOT NULL DEFAULT 0,
  auto_suggested INTEGER NOT NULL DEFAULT 0,
  UNIQUE (match_type, pattern)
);

-- Records every (match_type, pattern) the auto-categorizer has ever tried,
-- whether or not it produced a guess. This is what makes deleting an
-- auto-suggested rule "stick": once attempted, it is never retried, so a
-- deleted guess doesn't just reappear on the next matching event.
CREATE TABLE IF NOT EXISTS category_auto_attempts (
  match_type TEXT NOT NULL CHECK (match_type IN ('app', 'domain')),
  pattern TEXT NOT NULL,
  PRIMARY KEY (match_type, pattern)
);

CREATE TABLE IF NOT EXISTS ssid_labels (
  ssid TEXT PRIMARY KEY,
  label TEXT NOT NULL
);

-- Goals are append-only history: editing a goal sets valid_to on the old row
-- and inserts a new row with valid_from = now, valid_to = NULL.
CREATE TABLE IF NOT EXISTS goals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  category TEXT NOT NULL,
  constraint_type TEXT NOT NULL CHECK (constraint_type IN ('max', 'min')),
  hours_per_day REAL NOT NULL,
  valid_from INTEGER NOT NULL,
  valid_to INTEGER
);

CREATE INDEX IF NOT EXISTS idx_goals_category_validity ON goals (category, valid_from, valid_to);
`

/** Default category rules seeded into a fresh database. */
export const DEFAULT_CATEGORY_RULES: Array<{
  matchType: 'app' | 'domain'
  pattern: string
  category: string
}> = [
  { matchType: 'app', pattern: 'Visual Studio Code', category: 'Productivity' },
  { matchType: 'app', pattern: 'Code', category: 'Productivity' },
  { matchType: 'app', pattern: 'Xcode', category: 'Productivity' },
  { matchType: 'app', pattern: 'Terminal', category: 'Productivity' },
  { matchType: 'app', pattern: 'iTerm2', category: 'Productivity' },
  { matchType: 'app', pattern: 'Slack', category: 'Communication' },
  { matchType: 'app', pattern: 'Microsoft Teams', category: 'Communication' },
  { matchType: 'app', pattern: 'Mail', category: 'Communication' },
  { matchType: 'app', pattern: 'Outlook', category: 'Communication' },
  { matchType: 'app', pattern: 'Messages', category: 'Communication' },
  { matchType: 'app', pattern: 'Spotify', category: 'Entertainment' },
  { matchType: 'app', pattern: 'Music', category: 'Entertainment' },
  { matchType: 'app', pattern: 'Steam', category: 'Entertainment' },
  { matchType: 'domain', pattern: 'github.com', category: 'Productivity' },
  { matchType: 'domain', pattern: 'stackoverflow.com', category: 'Productivity' },
  { matchType: 'domain', pattern: 'developer.mozilla.org', category: 'Productivity' },
  { matchType: 'domain', pattern: 'docs.google.com', category: 'Productivity' },
  { matchType: 'domain', pattern: 'mail.google.com', category: 'Communication' },
  { matchType: 'domain', pattern: 'slack.com', category: 'Communication' },
  { matchType: 'domain', pattern: 'youtube.com', category: 'Entertainment' },
  { matchType: 'domain', pattern: 'netflix.com', category: 'Entertainment' },
  { matchType: 'domain', pattern: 'twitch.tv', category: 'Entertainment' },
  { matchType: 'domain', pattern: 'twitter.com', category: 'Social Media' },
  { matchType: 'domain', pattern: 'x.com', category: 'Social Media' },
  { matchType: 'domain', pattern: 'instagram.com', category: 'Social Media' },
  { matchType: 'domain', pattern: 'reddit.com', category: 'Social Media' },
  { matchType: 'domain', pattern: 'facebook.com', category: 'Social Media' },
  { matchType: 'domain', pattern: 'tiktok.com', category: 'Social Media' }
]

// UNCATEGORIZED, DEFAULT_LOCATION_LABEL, OUTSIDE_PSEUDO_CATEGORY, and
// HOME_LOCATION_LABEL moved to ../../shared/constants.ts so the renderer
// can reference them without reaching into main-process-only modules.
export { UNCATEGORIZED, DEFAULT_LOCATION_LABEL, OUTSIDE_PSEUDO_CATEGORY, HOME_LOCATION_LABEL } from '../../shared/constants'
