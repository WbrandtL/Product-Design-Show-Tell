/**
 * String constants that both the main process (schema seeding, aggregation)
 * and the renderer (category/location theming) need to agree on. Kept in
 * shared/ rather than main/db/schema.ts so the renderer never has to reach
 * into main-process-only modules to reference them.
 */

/** Fallback category used when no rule matches an app or domain. */
export const UNCATEGORIZED = 'Uncategorized'

/** Fallback location label used when an SSID has no user-defined label. */
export const DEFAULT_LOCATION_LABEL = 'Other'

/**
 * The one reserved location-derived pseudo-category: hours spent on any
 * Wi-Fi network NOT labeled exactly "Home" (case-insensitive). It is not
 * produced by any category_rules row — goals and trends for it are
 * special-cased in main/aggregation/trends.ts to read from ssid_labels /
 * raw_events.ssid instead of app/domain categorization.
 */
export const OUTSIDE_PSEUDO_CATEGORY = 'Outside'

/** The location label that counts as "home" for the Outside pseudo-category. */
export const HOME_LOCATION_LABEL = 'Home'
