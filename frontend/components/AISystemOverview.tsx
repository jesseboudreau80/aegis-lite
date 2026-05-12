'use client'

import { useEffect, useState } from 'react'
import { api } from '@/lib/api'
import { AISystem } from '@/lib/types'

const RISK_BADGE: Record<string, string> = {
  low:      'badge badge-low',
  medium:   'badge badge-medium',
  high:     'badge badge-high',
  critical: 'badge badge-critical',
}

const STATUS_DOT: Record<string, string> = {
  active:     'bg-emerald-500',
  draft:      'bg-gray-600',
  deprecated: 'bg-red-500',
}

function Skeleton() {
  return (
    <div className="card p-5 space-y-3">
      <div className="skeleton w-36 h-3" />
      <div className="skeleton w-full h-8" />
      <div className="skeleton w-full h-8" />
    </div>
  )
}

export default function AISystemOverview() {
  const [systems, setSystems]   = useState<AISystem[]>([])
  const [loading, setLoading]   = useState(true)

  useEffect(() => {
    api.getSystems().then(r => setSystems(r.data as AISystem[])).catch(() => {}).finally(() => setLoading(false))
  }, [])

  if (loading) return <Skeleton />

  const active    = systems.filter(s => s.status === 'active').length
  const highRisk  = systems.filter(s => ['high', 'critical'].includes(s.risk_level)).length
  const draft     = systems.filter(s => s.status === 'draft').length

  return (
    <div className="card p-5 fade-up">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-sm font-semibold text-white">AI System Registry</h2>
          <p className="text-[10px] text-gray-600 mt-0.5">{systems.length} registered systems</p>
        </div>
        <div className="flex items-center gap-3">
          {active > 0 && (
            <div className="flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 pulse-dot" />
              <span className="text-[10px] text-gray-500">{active} active</span>
            </div>
          )}
          {highRisk > 0 && (
            <span className="badge badge-high">{highRisk} high-risk</span>
          )}
          {draft > 0 && (
            <span className="badge badge-info">{draft} draft</span>
          )}
        </div>
      </div>

      {systems.length === 0 ? (
        <div className="py-6 text-center">
          <p className="text-xs text-gray-500 mb-1">No systems registered</p>
          <p className="text-[10px] text-gray-600">
            Register AI systems in the{' '}
            <a href="/governance/systems" className="text-blue-400 hover:underline">AI Registry</a> to track governance.
          </p>
        </div>
      ) : (
        <div className="space-y-1.5">
          {systems.slice(0, 6).map(s => (
            <div key={s.id}
              className="flex items-center justify-between px-3 py-2.5 rounded-lg transition-colors hover:bg-white/[0.03]"
              style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.03)' }}>
              <div className="flex items-center gap-2.5 min-w-0">
                <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${STATUS_DOT[s.status] || 'bg-gray-600'}`} />
                <div className="min-w-0">
                  <p className="text-xs text-gray-200 font-medium truncate">{s.name}</p>
                  {s.department && <p className="text-[10px] text-gray-600">{s.department}</p>}
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0 ml-3">
                <span className={RISK_BADGE[s.risk_level] || 'badge badge-medium'}>{s.risk_level}</span>
              </div>
            </div>
          ))}
          {systems.length > 6 && (
            <p className="text-[10px] text-gray-600 text-center pt-1">
              +{systems.length - 6} more —{' '}
              <a href="/governance/systems" className="text-blue-400 hover:underline">view all</a>
            </p>
          )}
        </div>
      )}
    </div>
  )
}
