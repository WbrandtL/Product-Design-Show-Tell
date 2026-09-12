import { UNCATEGORIZED } from '../db/schema'
import type { CategoryMatchType, CategoryRule } from '../../shared/types'

/** Process names recognized as web browsers, for double-count avoidance. See trends.ts. */
export const BROWSER_APP_NAMES = [
  'google chrome',
  'chrome',
  'microsoft edge',
  'msedge',
  'brave browser',
  'brave',
  'safari',
  'firefox',
  'arc'
]

/**
 * Resolves the category for an app name using exact, case-insensitive
 * matching against the "app" rules. Falls back to UNCATEGORIZED.
 * Parameters:
 *     rules (CategoryRule[]): all configured category rules
 *     appName (string): the app name to categorize
 * Returns:
 *     category (string): the matched category, or UNCATEGORIZED
 */
export function resolveCategoryForApp(rules: CategoryRule[], appName: string): string {
  const needle = appName.trim().toLowerCase()
  const match = rules.find((r) => r.matchType === 'app' && r.pattern.trim().toLowerCase() === needle)
  return match?.category ?? UNCATEGORIZED
}

/**
 * Resolves the category for a domain using exact, case-insensitive matching
 * against the "domain" rules. Falls back to UNCATEGORIZED.
 * Parameters:
 *     rules (CategoryRule[]): all configured category rules
 *     domain (string): the domain to categorize, e.g. "github.com"
 * Returns:
 *     category (string): the matched category, or UNCATEGORIZED
 */
export function resolveCategoryForDomain(rules: CategoryRule[], domain: string): string {
  const needle = domain.trim().toLowerCase()
  const match = rules.find((r) => r.matchType === 'domain' && r.pattern.trim().toLowerCase() === needle)
  return match?.category ?? UNCATEGORIZED
}

/**
 * Ordered keyword groups used to guess a category for an app/domain that
 * has no exact rule yet. Deliberately simple substring matching (no ML, no
 * network call) so a guess is always traceable to one of these keywords —
 * see autoCategorize.ts for how/when this runs, and README.md for how to
 * edit or extend this table.
 */
const HEURISTIC_RULES: ReadonlyArray<{ category: string; keywords: readonly string[] }> = [
  {
    category: 'System',
    keywords: [
      'finder', 'explorer.exe', 'system settings', 'system preferences',
      'control panel', 'systemuiserver', 'spotlight', 'loginwindow', 'searchui'
    ]
  },
  {
    category: 'Communication',
    keywords: [
      'mail', 'chat', 'meet', 'zoom', 'teams', 'slack', 'discord',
      'telegram', 'whatsapp', 'skype', 'messenger'
    ]
  },
  {
    category: 'Productivity',
    keywords: [
      'code', 'terminal', 'studio', 'editor', 'docs.google', 'github', 'gitlab',
      'notion', 'linear', 'figma', 'postman', 'docker', 'xcode', 'iterm', 'vim',
      'jetbrains', 'sourcetree', 'claude', 'chatgpt', 'openai',
      'excel', 'sheets', 'word', 'powerpoint', 'keynote', 'pages', 'numbers'
    ]
  },
  {
    category: 'Entertainment',
    keywords: [
      'spotify', 'music', 'netflix', 'youtube', 'twitch', 'steam', 'game',
      'hulu', 'disney', 'prime video', 'vlc', 'plex', 'podcast'
    ]
  },
  {
    category: 'Social Media',
    keywords: [
      'twitter', 'instagram', 'facebook', 'reddit', 'tiktok', 'snapchat',
      'linkedin', 'pinterest', 'mastodon', 'threads'
    ]
  }
]

/**
 * Guesses a category for a pattern with no exact rule yet, via case-
 * insensitive substring matching against HEURISTIC_RULES (first match
 * wins), falling back to "Browsing" for a recognized bare browser app name.
 * Returns null (no guess) rather than UNCATEGORIZED so callers can tell
 * "we tried and found nothing" apart from "not attempted yet".
 * Parameters:
 *     matchType (CategoryMatchType): whether pattern is an app name or a domain
 *     pattern (string): the app name or domain to guess a category for
 * Returns:
 *     category (string | null): a guessed category, or null if nothing matched
 */
export function guessCategory(matchType: CategoryMatchType, pattern: string): string | null {
  const needle = pattern.trim().toLowerCase()
  for (const rule of HEURISTIC_RULES) {
    if (rule.keywords.some((keyword) => needle.includes(keyword))) return rule.category
  }
  if (matchType === 'app' && BROWSER_APP_NAMES.includes(needle)) return 'Browsing'
  return null
}
