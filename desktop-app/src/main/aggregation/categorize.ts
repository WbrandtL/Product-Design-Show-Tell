import { UNCATEGORIZED } from '../db/schema'
import type { CategoryRule } from '../../shared/types'

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
