import {
  Globe,
  HelpCircle,
  Layers,
  MessageCircle,
  Settings,
  Share2,
  SunMedium,
  Tv,
  Zap,
  type LucideIcon
} from 'lucide-react'
import { OUTSIDE_PSEUDO_CATEGORY } from '../../../shared/constants'

export interface CategoryTheme {
  icon: LucideIcon
  /** Hex color. Apply via inline `style`, not a Tailwind class — category
   *  names (and therefore colors) are fully dynamic/user-defined, and
   *  Tailwind can only generate CSS for class names it finds literally in
   *  source, not ones built from runtime strings. */
  color: string
}

const NAMED_THEMES: Record<string, CategoryTheme> = {
  productivity: { icon: Zap, color: '#FF2D55' },
  entertainment: { icon: Tv, color: '#AF52DE' },
  [OUTSIDE_PSEUDO_CATEGORY.toLowerCase()]: { icon: SunMedium, color: '#30D158' },
  communication: { icon: MessageCircle, color: '#0A84FF' },
  'social media': { icon: Share2, color: '#FF9500' },
  system: { icon: Settings, color: '#8E8E93' },
  browsing: { icon: Globe, color: '#5AC8FA' },
  uncategorized: { icon: HelpCircle, color: '#A1A1AA' }
}

/** Stable fallback palette for categories the user names themselves. */
const FALLBACK_PALETTE = ['#FF2D55', '#AF52DE', '#30D158', '#0A84FF', '#FF9500', '#5AC8FA', '#FFD60A', '#BF5AF2']

/**
 * Deterministic (not cryptographic) string hash, used only to pick a
 * stable fallback color/icon for a category name we don't recognize.
 * Parameters:
 *     value (string): the string to hash
 * Returns:
 *     hash (number): a non-negative integer, stable for a given input
 */
function hashString(value: string): number {
  let hash = 0
  for (let i = 0; i < value.length; i++) {
    hash = (hash * 31 + value.charCodeAt(i)) | 0
  }
  return Math.abs(hash)
}

/**
 * Resolves an icon + color for a category name. Recognizes the built-in
 * category names (Productivity, Entertainment, Outside, Communication,
 * Social Media, System, Browsing, Uncategorized) with a curated theme;
 * any other user-defined category gets a generic icon and a color picked
 * deterministically from a fallback palette, so it's still visually
 * distinct and stable across renders without needing to be pre-registered.
 * Parameters:
 *     category (string): the category name to theme
 * Returns:
 *     theme (CategoryTheme): an icon component and a hex color
 */
export function getCategoryTheme(category: string): CategoryTheme {
  const key = category.trim().toLowerCase()
  const named = NAMED_THEMES[key]
  if (named) return named
  return { icon: Layers, color: FALLBACK_PALETTE[hashString(key) % FALLBACK_PALETTE.length] as string }
}
