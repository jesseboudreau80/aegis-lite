'use client'

import { useEffect, useState } from 'react'
import { api } from '@/lib/api'
import { UsageData } from '@/lib/types'

const MODEL_COLORS: Record<string, string> = {
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

function Skeleton({ w, h }: { w?: string; h?: string }) {
  return <div className={`skeleton ${w ?? 'w-full'} ${h ?? 'h-4'}`} />
}

function BudgetRing({ pct }: { pct: number }) {
  const r = 36
  const circ = 2 * Math.PI * r
  const stroke = circ * (1 - pct / 100)
  const color = pct >= 90 ? '#ef4444' : pct >= 70 ? '#f59e0b' : '#3b82f6'
  return (
    <svg width="88" height="88" viewBox="0 0 88 88">
      <circle cx="44" cy="44" r={r} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="6" />
      <circle
        cx="44" cy="44" r={r} fill="none"
        stroke={color} strokeWidth="6"
        strokeDasharray={circ} strokeDashoffset={stroke}
        strokeLinecap="round"
        className="risk-ring"
        style={{ transition: 'stroke-dashoffset 0.8s cubic-bezier(0.4,0,0.2,1), stroke 0.3s' }}
      />
      <text x="44" y="47" textAnchor="middle" fontSize="14" fontWeight="700" fill="white" fontFamily="inherit">
        {pct.toFixed(0)}%
      </text>
    </svg>
  )
}

export default function UsageDashboard({ isAdmin = false }: { isAdmin?: boolean }) {
  const [data, setData]     = useState<UsageData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.getUsage().then(r => setData(r.data as UsageData)).catch(() => {}).finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="card p-5">
          <Skeleton w="w-24" h="h-3" />
          <div className="mt-4 flex gap-6">
            <Skeleton w="w-20" h="h-20" />
            <div className="flex-1 space-y-3 pt-2">
              <Skeleton w="w-32" h="h-3" />
              <Skeleton h="h-2" />
              <Skeleton w="w-40" h="h-2" />
            </div>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3">
          {[0, 1, 2].map(i => <div key={i} className="card p-4"><Skeleton w="w-12" h="h-6" /></div>)}
        </div>
      </div>
    )
  }

  if (!data) return null

  const { budget, usage_by_model } = data
  const pctUsed = Math.min(100, budget.percentage_used)
  const total_requests = usage_by_model.reduce((s, m) => s + m.request_count, 0)
  const total_tokens   = usage_by_model.reduce((s, m) => s + m.total_input_tokens + m.total_output_tokens, 0)
  const max_cost = Math.max(...usage_by_model.map(m => m.total_cost_usd), 0.0001)

  const pctColor = pctUsed >= 90 ? '#ef4444' : pctUsed >= 70 ? '#f59e0b' : '#3b82f6'

  return (
    <div className="space-y-4 fade-up">

      {/* Budget card */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-white">Monthly Budget</h2>
          <span className="badge" style={{
            color: pctColor,
            background: `${pctColor}15`,
            borderColor: `${pctColor}35`,
          }}>
            {pctUsed.toFixed(1)}% used
          </span>
        </div>
        <div className="flex items-center gap-5">
          <BudgetRing pct={pctUsed} />
          <div className="flex-1 min-w-0 space-y-3">
            <div>
              <div className="flex justify-between text-xs mb-1.5">
                <span className="text-gray-400">${budget.current_usage_usd.toFixed(4)} spent</span>
                <span className="text-gray-600">${budget.monthly_budget_usd.toFixed(2)} limit</span>
              </div>
              <div className="progress-track">
                <div className="progress-fill" style={{ width: `${pctUsed}%`, background: pctColor }} />
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full"
                style={{ background: pctUsed >= 80 ? '#f59e0b' : '#10b981' }} />
              <span className="text-[10px] text-gray-500">
                {pctUsed >= 80
                  ? 'Budget nearing limit — premium models will be downgraded'
                  : `$${budget.remaining_usd.toFixed(4)} remaining this month`}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-3">
        {[
          {
            label: 'Requests',
            value: total_requests.toLocaleString(),
            sub: 'this month',
            icon: 'M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z',
            color: '#3b82f6',
          },
          {
            label: 'Tokens',
            value: total_tokens > 1_000_000 ? `${(total_tokens / 1_000_000).toFixed(2)}M` : total_tokens > 1000 ? `${(total_tokens / 1000).toFixed(1)}k` : total_tokens.toLocaleString(),
            sub: 'processed',
            icon: 'M13 10V3L4 14h7v7l9-11h-7z',
            color: '#8b5cf6',
          },
          {
            label: 'Cost',
            value: `$${budget.current_usage_usd < 0.01 ? budget.current_usage_usd.toFixed(6) : budget.current_usage_usd.toFixed(4)}`,
            sub: 'USD',
            icon: 'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
            color: '#10b981',
          },
        ].map(({ label, value, sub, icon, color }) => (
          <div key={label} className="card p-4 card-hover">
            <div className="flex items-start justify-between mb-3">
              <p className="stat-label">{label}</p>
              <div className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{ background: `${color}15` }}>
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke={color} strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d={icon} />
                </svg>
              </div>
            </div>
            <p className="stat-number">{value}</p>
            <p className="text-[10px] text-gray-600 mt-0.5">{sub}</p>
          </div>
        ))}
      </div>

      {/* Model breakdown */}
      {usage_by_model.length > 0 ? (
        <div className="card p-5">
          <h3 className="stat-label mb-4">Usage by Runtime</h3>
          <div className="space-y-3">
            {usage_by_model.sort((a, b) => b.total_cost_usd - a.total_cost_usd).map(m => {
              const pct = (m.total_cost_usd / max_cost) * 100
              const color = MODEL_COLORS[m.model] || '#6b7280'
              return (
                <div key={m.model}>
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: color }} />
                      <span className="text-xs text-gray-300 font-mono">{m.model}</span>
                    </div>
                    <div className="flex items-center gap-4 text-[11px] text-gray-500">
                      <span>{m.request_count} req</span>
                      <span className="font-mono text-gray-400">${m.total_cost_usd.toFixed(4)}</span>
                    </div>
                  </div>
                  <div className="progress-track">
                    <div className="progress-fill" style={{ width: `${pct}%`, background: color }} />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      ) : (
        <div className="card p-8 text-center">
          <div className="inline-flex items-center justify-center w-10 h-10 rounded-xl mb-3 border border-white/[0.06]"
            style={{ background: 'rgba(255,255,255,0.03)' }}>
            <svg className="w-5 h-5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </div>
          <p className="text-sm text-gray-400 font-medium mb-1">No usage yet</p>
          <p className="text-xs text-gray-600">Usage data will appear after your first AI request.</p>
        </div>
      )}
    </div>
  )
}
