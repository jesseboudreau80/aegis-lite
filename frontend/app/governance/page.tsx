'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'
import AppNav from '@/components/AppNav'
import LogoutButton from '@/components/LogoutButton'
import { api } from '@/lib/api'
import { GovernanceSummary } from '@/lib/types'

const DECISION_STYLES: Record<string, string> = {
  block:    'text-red-400 bg-red-900/20',
  escalate: 'text-orange-400 bg-orange-900/20',
  warn:     'text-yellow-400 bg-yellow-900/20',
  modify:   'text-blue-400 bg-blue-900/20',
  allow:    'text-green-400 bg-green-900/20',
}

export default function GovernancePage() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const [summary, setSummary] = useState<GovernanceSummary | null>(null)
  const [events, setEvents] = useState<unknown[]>([])
  const [loadingData, setLoadingData] = useState(true)

  useEffect(() => {
    if (!loading && !user) router.replace('/login')
    if (!loading && user && user.role !== 'admin') router.replace('/dashboard')
  }, [user, loading, router])

  useEffect(() => {
    if (!user || user.role !== 'admin') return
    Promise.all([api.getGovernanceSummary(30), api.getGovernanceEvents({ limit: 10, days: 7 })])
      .then(([s, e]) => {
        setSummary(s.data as GovernanceSummary)
        const eventsData = (e.data as { events: unknown[] }).events || []
        setEvents(eventsData)
      })
      .catch(() => {})
      .finally(() => setLoadingData(false))
  }, [user])

  if (loading || !user || user.role !== 'admin') return null

  return (
    <div className="flex flex-col h-full bg-gray-950">
      <div className="flex-shrink-0 border-b border-gray-800 px-4 py-2.5 flex items-center gap-3">
        <div className="flex items-center gap-1.5">
          <div className="w-5 h-5 rounded bg-blue-600 flex items-center justify-center text-xs font-bold text-white">A</div>
          <span className="text-sm font-semibold text-white hidden sm:block">Aegis Lite</span>
        </div>
        <div className="w-px h-4 bg-gray-800 hidden sm:block" />
        <AppNav currentPage="/governance" />
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-5xl mx-auto space-y-6">
          <div>
            <h1 className="text-base font-semibold text-white">Governance Dashboard</h1>
            <p className="text-xs text-gray-500 mt-0.5">Policy decisions, risk flags, audit events — last 30 days</p>
          </div>

          {/* Summary cards */}
          {summary && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { label: 'Flagged Events', value: summary.total_flagged_events, color: 'text-white' },
                { label: 'Blocked',        value: summary.blocked,              color: 'text-red-400' },
                { label: 'Escalated',      value: summary.escalated,            color: 'text-orange-400' },
                { label: 'Avg Risk Score', value: summary.avg_risk_score.toFixed(3), color: 'text-yellow-400' },
              ].map(({ label, value, color }) => (
                <div key={label} className="bg-gray-900 border border-gray-800 rounded-xl p-4">
                  <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">{label}</p>
                  <p className={`text-xl font-bold ${color}`}>{value}</p>
                </div>
              ))}
            </div>
          )}

          {/* Top flags */}
          {summary && summary.top_flags.length > 0 && (
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Top Policy Flags</h3>
              <div className="flex flex-wrap gap-2">
                {summary.top_flags.slice(0, 8).map(({ flag, count }) => (
                  <span key={flag} className="flex items-center gap-1.5 px-2 py-1 bg-gray-800 rounded-lg text-xs">
                    <span className="text-gray-300">{flag}</span>
                    <span className="text-gray-500">{count}</span>
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Recent events */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-800 flex items-center justify-between">
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Recent Events</h3>
              <button
                onClick={() => router.push('/governance/audit')}
                className="text-xs text-blue-400 hover:text-blue-300"
              >
                View audit log →
              </button>
            </div>
            {loadingData ? (
              <div className="p-5 text-xs text-gray-500">Loading…</div>
            ) : events.length === 0 ? (
              <div className="p-5 text-xs text-gray-500">No events in the last 7 days.</div>
            ) : (
              <div className="divide-y divide-gray-800">
                {(events as Array<{
                  id: string; timestamp: string; event_type: string;
                  actor_email: string | null; severity: string; payload: Record<string, unknown>
                }>).map(e => {
                  const decision = (e.payload?.decision as string) || 'allow'
                  return (
                    <div key={e.id} className="px-5 py-3 flex items-center justify-between gap-4">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className={`px-1.5 py-0.5 text-[10px] rounded font-medium ${DECISION_STYLES[decision] || DECISION_STYLES.allow}`}>
                            {decision}
                          </span>
                          <span className="text-xs text-gray-400 truncate">{e.event_type}</span>
                        </div>
                        <p className="text-[10px] text-gray-600">{e.actor_email}</p>
                      </div>
                      <span className="text-[10px] text-gray-600 flex-shrink-0">
                        {new Date(e.timestamp).toLocaleString()}
                      </span>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>
      <LogoutButton />
    </div>
  )
}
