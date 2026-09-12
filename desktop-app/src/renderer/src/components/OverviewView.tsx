import { MetricCard } from './MetricCard'
import { WeekOverWeekList } from './WeekOverWeekList'
import type { TrendPoint } from './TrendLineChart'
import type { Goal, RangeOption, WeekOverWeekDelta } from '../../../shared/types'

export interface HeroCardData {
  category: string
  description: string
  todayMinutes: number
  weekOverWeekPercent: number | null
  history: TrendPoint[]
  goal: Goal | null
}

interface Props {
  range: RangeOption
  setRange: (range: RangeOption) => void
  heroCards: HeroCardData[]
  weekOverWeekDeltas: WeekOverWeekDelta[]
  onOpenDrilldown: (category: string) => void
  onOpenGoalModal: (category: string) => void
}

/**
 * The main trend view: a range toggle, the three hero metric cards
 * (Productivity, Entertainment, Outside), and the full week-over-week
 * breakdown for every other category the app has observed.
 * Parameters:
 *     range (RangeOption): currently selected range
 *     setRange ((range: RangeOption) => void): switches the range
 *     heroCards (HeroCardData[]): pre-computed data for the three hero cards
 *     weekOverWeekDeltas (WeekOverWeekDelta[]): per-category deltas for the full list
 *     onOpenDrilldown ((category: string) => void): opens Activity Details for a category
 *     onOpenGoalModal ((category: string) => void): opens the goal-planning modal for a category
 * Returns:
 *     element (JSX.Element): the overview page
 */
export function OverviewView({ range, setRange, heroCards, weekOverWeekDeltas, onOpenDrilldown, onOpenGoalModal }: Props): JSX.Element {
  return (
    <div className="w-full max-w-5xl mx-auto space-y-6 pb-20">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-2">
        <div>
          <div className="text-[11px] font-bold tracking-wider text-zinc-400 uppercase font-mono">Summary &amp; Trends</div>
          <h1 className="text-3xl font-extrabold tracking-tight text-zinc-900 mt-0.5">Activity Trends</h1>
          <p className="text-xs text-zinc-500 mt-1">Tracking daily focus, screen leisure, and time away from home.</p>
        </div>

        <div className="bg-zinc-200/70 p-1 rounded-xl flex items-center text-xs font-semibold text-zinc-600">
          <button
            onClick={() => setRange('7d')}
            className={`px-3 py-1 rounded-lg transition cursor-pointer ${range === '7d' ? 'bg-white text-zinc-950 shadow-xs font-bold' : 'text-zinc-500 hover:text-zinc-900'}`}
          >
            Last 7 days
          </button>
          <button
            onClick={() => setRange('30d')}
            className={`px-3 py-1 rounded-lg transition cursor-pointer ${range === '30d' ? 'bg-white text-zinc-950 shadow-xs font-bold' : 'text-zinc-500 hover:text-zinc-900'}`}
          >
            Last 30 days
          </button>
        </div>
      </div>

      <div className="space-y-5">
        {heroCards.map((card) => (
          <MetricCard
            key={card.category}
            category={card.category}
            description={card.description}
            todayMinutes={card.todayMinutes}
            weekOverWeekPercent={card.weekOverWeekPercent}
            history={card.history}
            goal={card.goal}
            onOpenDrilldown={() => onOpenDrilldown(card.category)}
            onOpenGoalModal={() => onOpenGoalModal(card.category)}
          />
        ))}
      </div>

      <div className="bg-white rounded-2xl border border-zinc-200 shadow-2xs p-5">
        <div className="mb-1">
          <h2 className="text-base font-bold text-zinc-900">Every category, week over week</h2>
          <p className="text-xs text-zinc-500 mt-0.5">Includes categories without a hero card above. Click one for details.</p>
        </div>
        <WeekOverWeekList deltas={weekOverWeekDeltas} onSelectCategory={onOpenDrilldown} />
      </div>
    </div>
  )
}
