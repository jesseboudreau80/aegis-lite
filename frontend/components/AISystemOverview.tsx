'use client'

import { useEffect, useState } from 'react'
import { api } from '@/lib/api'
import { AISystem } from '@/lib/types'

const RISK_COLORS: Record<string, string> = {
  low:      'text-green-400 bg-green-900/20 border-green-700/30',
  medium:   'text-yellow-400 bg-yellow-900/20 border-yellow-700/30',
  high:     'text-orange-400 bg-orange-900/20 border-orange-700/30',
  critical: 'text-red-400 bg-red-900/20 border-red-700/30',
}

const STATUS_COLORS: Record<string, string> = {
  active:     'text-green-400',
  draft:      'text-gray-400',
  deprecated: 'text-red-400',
}

export default function AISystemOverview() {
  const [systems, setSystems] = useState<AISystem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.getSystems()
      .then(res => setSystems(res.data as AISystem[]))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  if (loading) return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
      <div className="h-4 bg-gray-800 rounded w-40 mb-3 animate-pulse" />
      <div className="h-8 bg-gray-800 rounded animate-pulse" />
    </div>
  )

  const active = systems.filter(s => s.status === 'active').length
  const high_risk = systems.filter(s => ['high', 'critical'].includes(s.risk_level)).length

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-white">AI System Registry</h2>
        <div className="flex items-center gap-3 text-xs text-gray-500">
          <span>{active} active</span>
          {high_risk > 0 && <span className="text-orange-400">{high_risk} high-risk</span>}
        </div>
      </div>

      {systems.length === 0 ? (
        <p className="text-xs text-gray-500">No AI systems registered. Register systems in the AI Registry.</p>
      ) : (
        <div className="space-y-2">
          {systems.slice(0, 5).map(s => (
            <div key={s.id} className="flex items-center justify-between py-1.5 border-b border-gray-800 last:border-0">
              <div className="min-w-0">
                <p className="text-xs text-gray-200 font-medium truncate">{s.name}</p>
                {s.department && <p className="text-[10px] text-gray-500">{s.department}</p>}
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <span className={`px-1.5 py-0.5 text-[10px] rounded border ${RISK_COLORS[s.risk_level] || RISK_COLORS.medium}`}>
                  {s.risk_level}
                </span>
                <span className={`text-[10px] ${STATUS_COLORS[s.status] || 'text-gray-400'}`}>
                  {s.status}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
