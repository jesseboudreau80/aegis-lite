'use client'

import { useEffect, useState } from 'react'
import { api } from '@/lib/api'
import { UsageData } from '@/lib/types'

const TIER_COLORS: Record<string, string> = {
  claude_opus:          '#8b5cf6',
  claude_sonnet:        '#3b82f6',
  gpt4o:                '#10b981',
  gpt4o_mini:           '#06b6d4',
  mistral:              '#6366f1',
  llama3:               '#f59e0b',
  gemini:               '#ec4899',
  kimi:                 '#84cc16',
  perplexity_sonar:     '#f97316',
  perplexity_sonar_pro: '#ef4444',
}

export default function UsageDashboard({ isAdmin = false }: { isAdmin?: boolean }) {
  const [data, setData] = useState<UsageData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.getUsage()
      .then(res => setData(res.data as UsageData))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
        <div className="h-4 bg-gray-800 rounded w-32 mb-4 animate-pulse" />
        <div className="h-2 bg-gray-800 rounded w-full animate-pulse" />
      </div>
    )
  }

  if (!data) return null

  const { budget, usage_by_model } = data
  const pctUsed = Math.min(100, budget.percentage_used)
  const total_requests = usage_by_model.reduce((s, m) => s + m.request_count, 0)
  const total_tokens = usage_by_model.reduce((s, m) => s + m.total_input_tokens + m.total_output_tokens, 0)

  return (
    <div className="space-y-4">
      {/* Budget bar */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-white">Monthly Budget</h2>
          <span className={`text-xs font-medium ${pctUsed >= 90 ? 'text-red-400' : pctUsed >= 70 ? 'text-yellow-400' : 'text-green-400'}`}>
            {pctUsed.toFixed(1)}% used
          </span>
        </div>
        <div className="h-2 bg-gray-800 rounded-full overflow-hidden mb-2">
          <div
            className={`h-full rounded-full transition-all ${pctUsed >= 90 ? 'bg-red-500' : pctUsed >= 70 ? 'bg-yellow-500' : 'bg-blue-500'}`}
            style={{ width: `${pctUsed}%` }}
          />
        </div>
        <div className="flex justify-between text-xs text-gray-500">
          <span>${budget.current_usage_usd.toFixed(4)} used</span>
          <span>${budget.monthly_budget_usd.toFixed(2)} limit</span>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Requests', value: total_requests.toLocaleString() },
          { label: 'Tokens', value: total_tokens > 1000 ? `${(total_tokens / 1000).toFixed(1)}k` : total_tokens.toLocaleString() },
          { label: 'Cost', value: `$${budget.current_usage_usd.toFixed(4)}` },
        ].map(({ label, value }) => (
          <div key={label} className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">{label}</p>
            <p className="text-lg font-semibold text-white">{value}</p>
          </div>
        ))}
      </div>

      {/* Model breakdown */}
      {usage_by_model.length > 0 && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">Usage by Model</h3>
          <div className="space-y-3">
            {usage_by_model.map(m => (
              <div key={m.model} className="flex items-center justify-between">
                <div className="flex items-center gap-2 min-w-0">
                  <div
                    className="w-2 h-2 rounded-full flex-shrink-0"
                    style={{ backgroundColor: TIER_COLORS[m.model] || '#6b7280' }}
                  />
                  <span className="text-xs text-gray-300 truncate">{m.model}</span>
                </div>
                <div className="flex items-center gap-4 text-xs text-gray-500 flex-shrink-0">
                  <span>{m.request_count} req</span>
                  <span>${m.total_cost_usd.toFixed(4)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
