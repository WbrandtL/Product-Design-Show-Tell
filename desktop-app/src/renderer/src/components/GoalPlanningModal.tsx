import { useEffect, useState } from 'react'
import { Check, Minus, Plus, Sparkles, Target, X } from 'lucide-react'
import type { Goal, GoalConstraintType } from '../../../shared/types'

interface Props {
  isOpen: boolean
  /** The category this goal applies to — always known by the time the modal opens (every entry point already has a category in hand: a hero card, or a drilldown reached from the week-over-week list). */
  category: string
  /** The currently active goal for `category`, if any, used to prefill the form. */
  currentGoal: Goal | null
  onClose: () => void
  onSaved: () => void
}

const DEFAULT_PRESETS = [30, 60, 90, 120, 180, 240]

/**
 * The dark "+/-" goal-planning popup: pick a min/max constraint and a
 * daily minutes target via stepper, slider, or presets, then persist it as
 * a real goal. Goals are always editable — saving here just calls the same
 * setGoal() used everywhere else, which closes out the previous version
 * rather than overwriting it.
 * Parameters:
 *     isOpen (boolean): whether the modal is visible
 *     category (string): the category this goal applies to
 *     currentGoal (Goal | null): existing goal to prefill from, if any
 *     onClose (() => void): called to dismiss the modal
 *     onSaved (() => void): called after a successful save, to trigger a re-fetch
 * Returns:
 *     element (JSX.Element | null): the modal, or null when closed
 */
export function GoalPlanningModal({ isOpen, category, currentGoal, onClose, onSaved }: Props): JSX.Element | null {
  const [constraintType, setConstraintType] = useState<GoalConstraintType>('max')
  const [minutes, setMinutes] = useState<number>(120)

  useEffect(() => {
    if (!isOpen) return
    setConstraintType(currentGoal?.constraintType ?? 'max')
    setMinutes(currentGoal ? Math.round(currentGoal.hoursPerDay * 60) : 120)
  }, [isOpen, currentGoal])

  if (!isOpen) return null

  const handleSave = async (): Promise<void> => {
    await window.timeaware.setGoal(category, constraintType, minutes / 60)
    onSaved()
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
      <div className="absolute inset-0" onClick={onClose} />

      <div className="relative z-10 w-full max-w-md bg-[#18181B] text-white rounded-2xl shadow-2xl border border-zinc-800 p-7 flex flex-col items-center select-none">
        <button onClick={onClose} className="absolute top-4 right-4 p-1.5 rounded-full text-zinc-400 hover:text-white hover:bg-zinc-800 transition" aria-label="Close">
          <X size={18} />
        </button>

        <div className="flex items-center gap-2 text-xs font-semibold tracking-wider text-zinc-400 uppercase mb-4">
          <Target size={14} className="text-rose-500" />
          <span>Set Daily Goal</span>
        </div>

        <div className="text-sm font-semibold text-zinc-200 mb-4">{category}</div>

        <div className="flex items-center bg-zinc-800/80 rounded-xl p-1 mb-2 text-xs font-semibold">
          <button
            onClick={() => setConstraintType('max')}
            className={`px-3 py-1 rounded-lg transition ${constraintType === 'max' ? 'bg-[#FF2D55] text-white' : 'text-zinc-400'}`}
          >
            max
          </button>
          <button
            onClick={() => setConstraintType('min')}
            className={`px-3 py-1 rounded-lg transition ${constraintType === 'min' ? 'bg-[#FF2D55] text-white' : 'text-zinc-400'}`}
          >
            min
          </button>
        </div>

        <div className="w-full flex items-center justify-between py-6 px-4 my-2">
          <button
            type="button"
            onClick={() => setMinutes((prev) => Math.max(5, prev - 5))}
            className="w-14 h-14 rounded-full bg-[#FF2D55] hover:bg-[#E0264A] active:scale-95 text-white flex items-center justify-center shadow-lg shadow-rose-900/40 transition cursor-pointer"
            aria-label="Decrease goal"
          >
            <Minus size={28} strokeWidth={3} />
          </button>

          <span className="text-6xl sm:text-7xl font-bold tracking-tight text-white font-mono">{minutes}</span>

          <button
            type="button"
            onClick={() => setMinutes((prev) => Math.min(720, prev + 5))}
            className="w-14 h-14 rounded-full bg-[#FF2D55] hover:bg-[#E0264A] active:scale-95 text-white flex items-center justify-center shadow-lg shadow-rose-900/40 transition cursor-pointer"
            aria-label="Increase goal"
          >
            <Plus size={28} strokeWidth={3} />
          </button>
        </div>

        <div className="text-sm font-bold tracking-widest text-zinc-300 uppercase mt-1 mb-6 text-center">
          DAILY {constraintType === 'max' ? 'MAXIMUM' : 'MINIMUM'} (MINUTES)
        </div>

        <div className="w-full px-2 mb-5">
          <input
            type="range"
            min="5"
            max="600"
            step="5"
            value={minutes}
            onChange={(e) => setMinutes(parseInt(e.target.value, 10))}
            className="w-full h-1.5 bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-[#FF2D55]"
          />
          <div className="flex justify-between text-[11px] text-zinc-500 font-mono mt-1">
            <span>5 min</span>
            <span>
              {Math.floor(minutes / 60)}h {minutes % 60}m
            </span>
            <span>10h</span>
          </div>
        </div>

        <div className="w-full flex items-center justify-center flex-wrap gap-2 mb-6">
          <span className="text-[11px] text-zinc-400 mr-1">Presets:</span>
          {DEFAULT_PRESETS.map((preset) => (
            <button
              key={preset}
              type="button"
              onClick={() => setMinutes(preset)}
              className={`px-3 py-1 rounded-md text-xs font-semibold transition cursor-pointer ${
                minutes === preset ? 'bg-[#FF2D55] text-white shadow-xs' : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
              }`}
            >
              {preset}
            </button>
          ))}
        </div>

        <div className="w-full bg-zinc-900/80 rounded-xl p-3 text-xs text-zinc-400 border border-zinc-800/80 mb-6 flex items-start gap-2.5">
          <Sparkles size={16} className="text-amber-400 shrink-0 mt-0.5" />
          <div>
            <span>Setting a {constraintType === 'max' ? 'maximum' : 'minimum'} of </span>
            <strong className="text-white font-semibold">{minutes} minutes/day</strong>
            <span> updates the dashed benchmark line on the trend chart.</span>
          </div>
        </div>

        <div className="w-full flex items-center gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2.5 px-4 rounded-xl text-sm font-medium text-zinc-400 hover:text-white bg-zinc-800/80 hover:bg-zinc-800 transition cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void handleSave()}
            className="flex-1 py-2.5 px-4 rounded-xl text-sm font-semibold text-white bg-[#FF2D55] hover:bg-[#E0264A] transition shadow-md shadow-rose-950/50 flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <Check size={16} />
            <span>Save Goal</span>
          </button>
        </div>
      </div>
    </div>
  )
}
