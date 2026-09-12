import {
  Bot,
  Calculator,
  Clock,
  Code,
  Compass,
  Figma,
  FileText,
  Folder,
  Gamepad2,
  Globe,
  Headphones,
  Key,
  Mail,
  MessageCircle,
  Music,
  Phone,
  Sparkles,
  Terminal
} from 'lucide-react'

interface Props {
  name: string
  isDomain?: boolean
  size?: number
}

/**
 * Picks a representative icon + background color for an app name or
 * domain, via simple keyword matching (same spirit as the categorization
 * heuristic — no icon library ships one icon per possible app, so this is
 * a best-effort visual, not a lookup of the app's actual icon).
 * Parameters:
 *     name (string): app name or domain
 *     isDomain (boolean): true if `name` is a domain (biases the fallback icon to Globe)
 * Returns:
 *     result ({ Icon: LucideIcon; bg: string }): icon component and background color
 */
function resolveIcon(name: string, isDomain: boolean): { Icon: typeof Bot; bg: string } {
  const lower = name.toLowerCase()
  if (lower.includes('whatsapp') || lower.includes('messages') || lower.includes('slack') || lower.includes('teams'))
    return { Icon: MessageCircle, bg: '#25D366' }
  if (lower.includes('figma')) return { Icon: Figma, bg: '#A259FF' }
  if (lower.includes('claude') || lower.includes('chatgpt') || lower.includes('openai')) return { Icon: Bot, bg: '#D97706' }
  if (lower.includes('spotify') || lower.includes('music')) return { Icon: Headphones, bg: '#1DB954' }
  if (lower.includes('firefox')) return { Icon: Globe, bg: '#FF7139' }
  if (lower.includes('safari')) return { Icon: Compass, bg: '#007AFF' }
  if (lower.includes('code') || lower.includes('xcode') || lower.includes('studio')) return { Icon: Code, bg: '#3B82F6' }
  if (lower.includes('terminal') || lower.includes('iterm')) return { Icon: Terminal, bg: '#1C1C1E' }
  if (lower.includes('finder') || lower.includes('explorer')) return { Icon: Folder, bg: '#1F75FE' }
  if (lower.includes('mail')) return { Icon: Mail, bg: '#0A84FF' }
  if (lower.includes('calculator') || lower.includes('rechner')) return { Icon: Calculator, bg: '#FF9500' }
  if (lower.includes('clock') || lower.includes('uhr')) return { Icon: Clock, bg: '#2C2C2E' }
  if (lower.includes('password') || lower.includes('key') || lower.includes('passw')) return { Icon: Key, bg: '#636366' }
  if (lower.includes('phone') || lower.includes('telefon')) return { Icon: Phone, bg: '#34C759' }
  if (lower.includes('notes') || lower.includes('notion') || lower.includes('notizen')) return { Icon: FileText, bg: '#F5A623' }
  if (lower.includes('game')) return { Icon: Gamepad2, bg: '#000000' }
  if (isDomain) return { Icon: Globe, bg: '#3B82F6' }
  return { Icon: Sparkles, bg: '#3B82F6' }
}

/**
 * Small rounded square icon representing an app or domain in activity
 * lists/tables.
 * Parameters:
 *     name (string): app name or domain to represent
 *     isDomain (boolean): true if `name` is a domain rather than an app name
 *     size (number): icon box size in px
 * Returns:
 *     element (JSX.Element): the icon
 */
export function AppIcon({ name, isDomain = false, size = 28 }: Props): JSX.Element {
  const { Icon, bg } = resolveIcon(name, isDomain)
  const iconSize = Math.round(size * 0.58)
  return (
    <div
      className="rounded-lg flex items-center justify-center shadow-xs shrink-0 select-none"
      style={{ width: size, height: size, backgroundColor: bg }}
    >
      <Icon size={iconSize} className="text-white" />
    </div>
  )
}
