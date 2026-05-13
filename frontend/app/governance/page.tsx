'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'
import AppNav from '@/components/AppNav'
import LogoutButton from '@/components/LogoutButton'
import { api } from '@/lib/api'
import { GovernanceSummary } from '@/lib/types'
import Link from 'next/link'

const DECISION_CONFIG: Record<string, { label: string; badge: string; dot: string }> = {
  block:    { label: 'Blocked',   badge: 'badge badge-block',    dot: 'bg-red-500' },
  escalate: { label: 'Escalated', badge: 'badge badge-escalate', dot: 'bg-orange-500' },
  warn:     { label: 'Warned',    badge: 'badge badge-warn',     dot: 'bg-yellow-500' },
  modify:   { label: 'Modified',  badge: 'badge badge-modify',   dot: 'bg-blue-500' },
  allow:    { label: 'Allowed',   badge: 'badge badge-allow',    dot: 'bg-emerald-500' },
}

const SEVERITY_CONFIG: Record<string, { badge: string }> = {
  info:     { badge: 'badge badge-info' },
  warning:  { badge: 'badge badge-warn' },
  critical: { badge: 'badge badge-block' },
}

function MetricCard({
  label, value, sub, color, icon,
}: {
  label: string; value: string | number; sub?: string; color: string; icon: string
}) {
  return (
    <div className="card p-5 card-hover">
      <div className="flex items-start justify-between mb-3">
        <p className="stat-label">{label}</p>
        <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{ background: `${color}15` }}>
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke={color} strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d={icon} />
          </svg>
        </div>
      </div>
      <p className="stat-number">{value}</p>
      {sub && <p className="text-[10px] text-gray-600 mt-1">{sub}</p>}
    </div>
  )
}

function RiskBar({ value, max }: { value: number; max: number }) {
  const pct = max > 0 ? (value / max) * 100 : 0
  return (
    <div className="flex-1 progress-track" style={{ height: 3 }}>
      <div className="progress-fill" style={{
        width: `${pct}%`,
        background: 'linear-gradient(90deg, #3b82f6, #6366f1)',
      }} />
    </div>
  )
}

function Skeleton({ w, h }: { w?: string; h?: string }) {
  return <div className={`skeleton ${w ?? 'w-full'} ${h ?? 'h-4'}`} />
}

type GovEvent = {
  id: string; timestamp: string; event_type: string;
  actor_email: string | null; severity: string; payload: Record<string, unknown>
}

export default function GovernancePage() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const [summary, setSummary]         = useState<GovernanceSummary | null>(null)
  const [events, setEvents]           = useState<GovEvent[]>([])
  const [loadingData, setLoadingData] = useState(true)

  useEffect(() => {
    if (!loading && (!user || user.role !== 'admin')) router.replace('/login')
  }, [user, loading, router])

  useEffect(() => {
    if (!user || user.role !== 'admin') return
    Promise.all([api.getGovernanceSummary(30), api.getGovernanceEvents({ limit: 8, days: 7 })])
      .then(([s, e]) => {
        setSummary(s.data as GovernanceSummary)
        setEvents(((e.data as { events: GovEvent[] }).events) || [])
      })
      .catch(() => {})
      .finally(() => setLoadingData(false))
  }, [user])

  if (loading || !user || user.role !== 'admin') return null

  const maxFlag = summary?.top_flags[0]?.count ?? 1

  return (
    <div className="flex flex-col h-full" style={{ background: 'var(--surface-1)' }}>
      <header className="page-header">
        <div className="logo-mark">A</div>
        <span className="text-sm font-semibold text-white hidden sm:block">Aegis Lite</span>
        <div className="divider hidden sm:block" style={{ height: 16 }} />
        <AppNav currentPage="/governance" />
      </header>

      <div className="flex-1 overflow-y-auto p-5">
        <div className="max-w-5xl mx-auto space-y-5">

          {/* Header */}
          <div className="flex items-start justify-between gap-4 pt-1">
            <div>
              <h1 className="text-base font-semibold text-white">Governance Dashboard</h1>
              <p className="text-xs text-gray-500 mt-0.5">Policy decisions, risk events, audit trail — last 30 days</p>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 pulse-dot" />
              <span className="text-[10px] text-gray-500">Policy engine active</span>
            </div>
          </div>

          {/* Metric cards */}
          {loadingData ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[0, 1, 2, 3].map(i => (
                <div key={i} className="card p-5 space-y-3">
                  <Skeleton w="w-20" h="h-2.5" />
                  <Skeleton w="w-12" h="h-7" />
                </div>
              ))}
            </div>
          ) : summary && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 fade-up">
              <MetricCard
                label="Flagged Events"
                value={summary.total_flagged_events.toLocaleString()}
                sub="requests triggering rules"
                color="#6366f1"
                icon="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
              />
              <MetricCard
                label="Blocked"
                value={summary.blocked.toLocaleString()}
                sub="hard policy stops"
                color="#ef4444"
                icon="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"
              />
              <MetricCard
                label="Escalated"
                value={summary.escalated.toLocaleString()}
                sub="human review required"
                color="#f97316"
                icon="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
              <MetricCard
                label="Avg Risk Score"
                value={summary.avg_risk_score.toFixed(3)}
                sub="0.0 safe → 1.0 critical"
                color="#fbbf24"
                icon="M13 10V3L4 14h7v7l9-11h-7z"
              />
            </div>
          )}

          {/* Two-column: flags + event stream */}
          <div className="grid md:grid-cols-5 gap-4">

            {/* Top flags */}
            <div className="md:col-span-2 card p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xs font-semibold text-gray-300">Top Policy Flags</h3>
                <span className="text-[10px] text-gray-600">30 days</span>
              </div>
              {loadingData ? (
                <div className="space-y-3">
                  {[0, 1, 2, 3, 4].map(i => <Skeleton key={i} h="h-8" />)}
                </div>
              ) : summary && summary.top_flags.length > 0 ? (
                <div className="space-y-2.5">
                  {summary.top_flags.slice(0, 8).map(({ flag, count }) => (
                    <div key={flag}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[11px] text-gray-400 font-mono truncate pr-2">{flag}</span>
                        <span className="text-[11px] text-gray-500 flex-shrink-0">{count}</span>
                      </div>
                      <RiskBar value={count} max={maxFlag} />
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-gray-600 py-4 text-center">No policy flags in range.</p>
              )}
            </div>

            {/* Recent events */}
            <div className="md:col-span-3 card overflow-hidden">
              <div className="px-5 py-3.5 border-b border-white/[0.05] flex items-center justify-between">
                <h3 className="text-xs font-semibold text-gray-300">Recent Events</h3>
                <Link href="/governance/audit"
                  className="text-[11px] text-blue-400 hover:text-blue-300 transition-colors">
                  Full audit log →
                </Link>
              </div>
              {loadingData ? (
                <div className="p-5 space-y-3">
                  {[0, 1, 2, 3].map(i => <Skeleton key={i} h="h-10" />)}
                </div>
              ) : events.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <div className="w-9 h-9 rounded-xl mb-3 flex items-center justify-center border border-white/[0.06]"
                    style={{ background: 'rgba(255,255,255,0.03)' }}>
                    <svg className="w-4 h-4 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                    </svg>
                  </div>
                  <p className="text-xs text-gray-500 font-medium">No events in the last 7 days</p>
                  <p className="text-[10px] text-gray-600 mt-0.5">Policy-flagged requests will appear here.</p>
                </div>
              ) : (
                <div className="divide-y divide-white/[0.04]">
                  {events.map(e => {
                    const decision = (e.payload?.decision as string) || 'allow'
                    const cfg = DECISION_CONFIG[decision] || DECISION_CONFIG.allow
                    const sevCfg = SEVERITY_CONFIG[e.severity] || SEVERITY_CONFIG.info
                    return (
                      <div key={e.id}
                        className="px-5 py-3 flex items-center gap-3 hover:bg-white/[0.02] transition-colors">
                        <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${cfg.dot}`} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className={cfg.badge}>{cfg.label}</span>
                            <span className={sevCfg.badge}>{e.severity}</span>
                          </div>
                          <p className="text-[10px] text-gray-500 truncate">
                            {e.actor_email || 'system'} · {e.event_type.replace(/_/g, ' ')}
                          </p>
                        </div>
                        <span className="text-[10px] text-gray-600 flex-shrink-0 tabular-nums">
                          {new Date(e.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Quick links */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { href: '/governance/audit',    label: 'Audit Explorer',  desc: 'Browse all policy decisions',  icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4', color: '#6366f1' },
              { href: '/governance/policies', label: 'Policy Rules',    desc: 'View active rule set',         icon: 'M9 12l2 2 4-4m-6 8a9 9 0 110-18 9 9 0 010 18zm0-14v4m0 4h.01',                                                                                  color: '#3b82f6' },
              { href: '/governance/systems',  label: 'AI Registry',     desc: 'Registered AI systems',        icon: 'M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10', color: '#10b981' },
            ].map(({ href, label, desc, icon, color }) => (
              <Link key={href} href={href} className="card card-hover p-4 flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ background: `${color}12`, border: `1px solid ${color}25` }}>
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke={color} strokeWidth={1.75}>
                    <path strokeLinecap="round" strokeLinejoin="round" d={icon} />
                  </svg>
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-white">{label}</p>
                  <p className="text-[10px] text-gray-500">{desc}</p>
                </div>
              </Link>
            ))}
          </div>

        </div>
      </div>
      <LogoutButton />
    </div>
  )
}
