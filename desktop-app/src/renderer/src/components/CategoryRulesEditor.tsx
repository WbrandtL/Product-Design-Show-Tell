import { useState } from 'react'
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
export default function CategoryRulesEditor({ rules, onChanged }: Props): JSX.Element {
  const [matchType, setMatchType] = useState<CategoryMatchType>('app')
  const [pattern, setPattern] = useState('')
  const [category, setCategory] = useState('')

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

  return (
    <div className="settings-section">
      <table className="data-table">
        <thead>
          <tr>
            <th>Type</th>
            <th>Matches</th>
            <th>Category</th>
            <th />
            <th />
          </tr>
        </thead>
        <tbody>
          {rules.map((rule) => (
            <tr key={rule.id}>
              <td>{rule.matchType}</td>
              <td>{rule.pattern}</td>
              <td>{rule.category}</td>
              <td>{rule.autoSuggested && <span className="rule-badge">auto-suggested</span>}</td>
              <td>
                <button className="text-button" onClick={() => void handleDelete(rule.id)}>
                  remove
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <form className="inline-form" onSubmit={(e) => void handleSubmit(e)}>
        <select value={matchType} onChange={(e) => setMatchType(e.target.value as CategoryMatchType)}>
          <option value="app">app name</option>
          <option value="domain">domain</option>
        </select>
        <input
          placeholder={matchType === 'app' ? 'e.g. Figma' : 'e.g. notion.so'}
          value={pattern}
          onChange={(e) => setPattern(e.target.value)}
        />
        <span className="goal-meta">→</span>
        <input placeholder="Category" value={category} onChange={(e) => setCategory(e.target.value)} />
        <button type="submit">Add Rule</button>
      </form>
    </div>
  )
}
