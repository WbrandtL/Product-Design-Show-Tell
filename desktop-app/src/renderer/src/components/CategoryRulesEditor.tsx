import { useState } from 'react'
import { Plus, Search } from 'lucide-react'
import { getCategoryTheme } from '../lib/categoryTheme'
import type { CategoryMatchType, CategoryRule } from '../../../shared/types'

interface Props {
  rules: CategoryRule[]
  onChanged: () => void
}

/**
 * Table + inline form for the app/domain -> category mapping. Deleting a
 * default rule just removes that one mapping (it can be re-added); it does
 * not affect already-recorded raw events, only future categorization. Rows
 * marked "auto-suggested" were guessed by the built-in keyword heuristic
 * the first time that app/domain was observed (see README "How new
 * apps/domains get categorized automatically") — worth a glance, since a
 * guess can be wrong; re-adding the same pattern with a different category
 * overrides it and clears the "auto-suggested" flag.
 * Parameters:
 *     rules (CategoryRule[]): all configured rules
 *     onChanged (() => void): called after an add/delete, to trigger a re-fetch
 * Returns:
 *     element (JSX.Element): the rules editor
 */
export function CategoryRulesEditor({ rules, onChanged }: Props): JSX.Element {
  const [matchType, setMatchType] = useState<CategoryMatchType>('app')
  const [pattern, setPattern] = useState('')
  const [category, setCategory] = useState('')
  const [searchQuery, setSearchQuery] = useState('')

  const existingCategories = Array.from(new Set(rules.map((r) => r.category))).sort()

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault()
    if (!pattern.trim() || !category.trim()) return
    await window.timeaware.upsertCategoryRule(matchType, pattern.trim(), category.trim())
    setPattern('')
    setCategory('')
    onChanged()
  }

  const handleDelete = async (id: number): Promise<void> => {
    await window.timeaware.deleteCategoryRule(id)
    onChanged()
  }

  const filteredRules = rules.filter(
    (r) => r.pattern.toLowerCase().includes(searchQuery.toLowerCase()) || r.category.toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <div className="bg-white rounded-2xl border border-zinc-200 shadow-2xs overflow-hidden">
      <div className="p-5 border-b border-zinc-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-zinc-900">Categorization rules</h2>
          <p className="text-xs text-zinc-500 mt-0.5">Map an app or domain to a category. Applies to future data on next view.</p>
        </div>
        <div className="relative w-full sm:w-56">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Filter rules..."
            className="w-full pl-8 pr-3 py-1.5 bg-zinc-50 border border-zinc-200 rounded-lg text-xs text-zinc-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          />
        </div>
      </div>

      <div className="overflow-x-auto max-h-[420px]">
        <table className="w-full text-left text-xs border-collapse">
          <thead className="bg-zinc-50/80 text-zinc-500 font-semibold sticky top-0 z-10 border-b border-zinc-200">
            <tr>
              <th className="py-2.5 px-6 w-20">Type</th>
              <th className="py-2.5 px-6">Matches</th>
              <th className="py-2.5 px-6">Category</th>
              <th className="py-2.5 px-6 text-right w-24">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {filteredRules.map((rule) => {
              const theme = getCategoryTheme(rule.category)
              return (
                <tr key={rule.id} className="hover:bg-zinc-50/60 transition">
                  <td className="py-2.5 px-6 font-mono text-zinc-500">
                    <span className="px-2 py-0.5 rounded bg-zinc-100 text-[11px] font-medium text-zinc-700">{rule.matchType}</span>
                  </td>
                  <td className="py-2.5 px-6 font-medium text-zinc-900 font-mono">{rule.pattern}</td>
                  <td className="py-2.5 px-6">
                    <span
                      className="inline-block px-2.5 py-0.5 rounded-full text-[11px] font-medium mr-1.5"
                      style={{ backgroundColor: `${theme.color}1A`, color: theme.color }}
                    >
                      {rule.category}
                    </span>
                    {rule.autoSuggested && (
                      <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full text-amber-700 bg-amber-100">auto-suggested</span>
                    )}
                  </td>
                  <td className="py-2.5 px-6 text-right">
                    <button onClick={() => void handleDelete(rule.id)} className="text-blue-600 hover:text-rose-600 font-medium hover:underline text-xs transition cursor-pointer">
                      remove
                    </button>
                  </td>
                </tr>
              )
            })}
            {filteredRules.length === 0 && (
              <tr>
                <td colSpan={4} className="py-8 text-center text-zinc-400">
                  No rules found matching &quot;{searchQuery}&quot;.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <form onSubmit={(e) => void handleSubmit(e)} className="p-5 border-t border-zinc-100 bg-zinc-50/40 grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
        <div>
          <label className="block text-xs font-semibold text-zinc-700 mb-1">Type</label>
          <select
            value={matchType}
            onChange={(e) => setMatchType(e.target.value as CategoryMatchType)}
            className="w-full px-3 py-2 bg-white border border-zinc-200 rounded-xl text-xs text-zinc-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          >
            <option value="app">app name</option>
            <option value="domain">domain</option>
          </select>
        </div>
        <div className="sm:col-span-2">
          <label className="block text-xs font-semibold text-zinc-700 mb-1">Matches (app name or domain)</label>
          <input
            value={pattern}
            onChange={(e) => setPattern(e.target.value)}
            placeholder={matchType === 'app' ? 'e.g. Figma' : 'e.g. notion.so'}
            className="w-full px-3 py-2 bg-white border border-zinc-200 rounded-xl text-xs text-zinc-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-zinc-700 mb-1">Category</label>
          <input
            list="existing-categories"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            placeholder="Category"
            className="w-full px-3 py-2 bg-white border border-zinc-200 rounded-xl text-xs text-zinc-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          />
          <datalist id="existing-categories">
            {existingCategories.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </div>
        <button
          type="submit"
          className="sm:col-span-4 inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white transition shadow-2xs cursor-pointer"
        >
          <Plus size={14} />
          <span>Add Rule</span>
        </button>
      </form>
    </div>
  )
}
