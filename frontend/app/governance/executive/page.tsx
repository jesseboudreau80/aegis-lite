'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/context/AuthContext'
import AppNav from '@/components/AppNav'
import LogoutButton from '@/components/LogoutButton'
import { api } from '@/lib/api'
import { ExecutiveSummary } from '@/lib/types'

function KPICard({ label, value, sub, color, icon }: {
  label: string; value: string | number; sub?: string; color: string; icon: string
}) {
  return (
    <div className="card p-5">
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

function Bar({ pct, color }: { pct: number; color?: string }) {
  return (
    <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.05)' }}>
      <div className="h-full rounded-full transition-all"
        style={{ width: `${Math.min(100, pct)}%`, background: color || 'linear-gradient(90deg, #3b82f6, #6366f1)' }} />
    </div>
  )
}

const WINDOWS = [7, 30, 90]

const DECISION_COLORS: Record<string, string> = {
  block:    '#ef4444',
  escalate: '#f97316',
  warn:     '#fbbf24',
  modify:   '#3b82f6',
  allow:    '#10b981',
}

export default function ExecutivePage() {
  const { user, loading } = useAuth()
  const router = useRouter()

  const [data, setData]               = useState<ExecutiveSummary | null>(null)
  const [loadingData, setLoadingData] = useState(true)
  const [days, setDays]               = useState(30)

  useEffect(() => {
    if (!loading && (!user || user.role !== 'admin')) router.replace('/login')
  }, [user, loading, router])

  useEffect(() => {
    if (!user || user.role !== 'admin') return
    setLoadingData(true)
    api.getExecutiveSummary(days)
      .then(r => setData(r.data as ExecutiveSummary))
      .catch(() => {})
      .finally(() => setLoadingData(false))
  }, [user, days])

  if (loading || !user || user.role !== 'admin') return null

  const maxDept = data
    ? Math.max(...data.department_utilization.map(d => d.request_count), 1)
    : 1

  return (
    <div className="flex flex-col h-full" style={{ background: 'var(--surface-1)' }}>

      <header className="page-header">
        <div className="logo-mark">A</div>
        <span className="text-sm font-semibold hidden sm:block" style={{ color: '#e8c44a', letterSpacing: '0.01em' }}>Aegis Lite</span>
        <div className="divider hidden sm:block" style={{ height: 16 }} />
        <AppNav currentPage="/governance/executive" />
      </header>

      <div className="flex-1 overflow-y-auto p-5">
        <div className="max-w-5xl mx-auto space-y-5">

          {/* Page title + window selector */}
          <div className="flex items-start justify-between gap-4 pt-1">
            <div>
              <h1 className="text-base font-semibold text-white">Executive Overview</h1>
              <p className="text-xs text-gray-500 mt-0.5">
                AI adoption, spend, risk, and knowledge — organisation-wide
              </p>
            </div>
            <div className="flex items-center gap-1 flex-shrink-0">
              {WINDOWS.map(w => (
                <button key={w}
                  onClick={() => setDays(w)}
                  className={`px-2.5 py-1 text-xs rounded-lg cursor-pointer transition-colors ${
                    days === w ? 'text-white font-medium' : 'text-gray-500 hover:text-gray-300'
                  }`}
                  style={days === w ? { background: 'rgba(255,255,255,0.08)' } : {}}>
                  {w}d
                </button>
              ))}
            </div>
          </div>

          {/* KPI row */}
          {loadingData ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[0, 1, 2, 3].map(i => (
                <div key={i} className="card p-5 space-y-3">
                  <div className="skeleton w-20 h-2.5" />
                  <div className="skeleton w-12 h-7" />
                </div>
              ))}
            </div>
          ) : data && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 fade-up">
              <KPICard
                label="AI Adoption"
                value={`${data.kpis.adoption_pct}%`}
                sub={`${data.kpis.active_users} of ${data.kpis.total_users} users`}
                color="#6366f1"
                icon="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
              />
              <KPICard
                label="Total Spend"
                value={`$${data.kpis.total_spend_usd.toFixed(2)}`}
                sub={`${data.kpis.total_requests.toLocaleString()} requests`}
                color="#fbbf24"
                icon="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
              <KPICard
                label="Critical Events"
                value={data.kpis.critical_events}
                sub="policy blocks"
                color="#ef4444"
                icon="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"
              />
              <KPICard
                label="Active Users"
                value={data.kpis.active_users}
                sub={`of ${data.kpis.total_users} total`}
                color="#10b981"
                icon="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
              />
            </div>
          )}

          {/* Two-column: departments + policy breakdown */}
          {data && (
            <div className="grid md:grid-cols-5 gap-4">

              {/* Department utilization */}
              <div className="md:col-span-3 card p-5">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xs font-semibold text-gray-300">Department Utilization</h3>
                  <span className="text-[10px] text-gray-600">{days} days</span>
                </div>
                {data.department_utilization.length === 0 ? (
                  <div className="py-6 text-center">
                    <p className="text-xs text-gray-600">No department data.</p>
                    <p className="text-[10px] text-gray-700 mt-1">Set department on users to see breakdown.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {data.department_utilization.map(d => (
                      <div key={d.department}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[11px] text-gray-400 truncate pr-3">{d.department}</span>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <span className="text-[10px] text-gray-600">{d.request_count} req</span>
                            <span className="text-[10px] text-gray-500 tabular-nums">${d.total_cost.toFixed(2)}</span>
                          </div>
                        </div>
                        <Bar pct={(d.request_count / maxDept) * 100} />
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Policy breakdown */}
              <div className="md:col-span-2 card p-5">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xs font-semibold text-gray-300">Policy Decisions</h3>
                  <Link href="/governance/audit"
                    className="text-[11px] text-blue-400 hover:text-blue-300 transition-colors">
                    Full log →
                  </Link>
                </div>
                {Object.keys(data.policy_breakdown).length === 0 ? (
                  <p className="text-xs text-gray-600 py-4 text-center">No policy events.</p>
                ) : (
                  <div className="space-y-2.5">
                    {Object.entries(data.policy_breakdown)
                      .sort(([, a], [, b]) => b - a)
                      .map(([decision, count]) => (
                        <div key={decision} className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full flex-shrink-0"
                            style={{ background: DECISION_COLORS[decision] || '#6b7280' }} />
                          <span className="text-[11px] text-gray-400 flex-1 capitalize">{decision}</span>
                          <span className="text-[11px] text-gray-500 tabular-nums font-mono">{count}</span>
                        </div>
                      ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Top contributors + knowledge */}
          {data && (
            <div className="grid md:grid-cols-2 gap-4">

              {/* Top contributors */}
              <div className="card overflow-hidden">
                <div className="px-5 py-3.5 border-b border-white/[0.05]">
                  <h3 className="text-xs font-semibold text-gray-300">Top Contributors</h3>
                </div>
                {data.top_contributors.length === 0 ? (
                  <div className="px-5 py-8 text-center">
                    <p className="text-xs text-gray-600">No usage data in this window.</p>
                  </div>
                ) : (
                  <div className="divide-y divide-white/[0.04]">
                    {data.top_contributors.map((c, i) => (
                      <div key={c.email} className="px-5 py-3 flex items-center gap-3">
                        <span className="text-[10px] text-gray-600 w-4 flex-shrink-0 tabular-nums">{i + 1}</span>
                        <div className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 text-[9px] font-bold"
                          style={{ background: 'rgba(99,102,241,0.15)', color: '#818cf8' }}>
                          {c.name?.charAt(0)?.toUpperCase() || c.email.charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[11px] text-gray-300 truncate">{c.name || c.email}</p>
                          <p className="text-[10px] text-gray-600">{c.request_count} requests</p>
                        </div>
                        <span className="text-[11px] text-gray-500 tabular-nums font-mono flex-shrink-0">
                          ${c.total_cost.toFixed(2)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Top knowledge */}
              <div className="card overflow-hidden">
                <div className="px-5 py-3.5 border-b border-white/[0.05] flex items-center justify-between">
                  <h3 className="text-xs font-semibold text-gray-300">Most Reused Knowledge</h3>
                  <Link href="/knowledge"
                    className="text-[11px] text-blue-400 hover:text-blue-300 transition-colors">
                    Library →
                  </Link>
                </div>
                {data.top_knowledge_assets.length === 0 ? (
                  <div className="px-5 py-8 text-center">
                    <p className="text-xs text-gray-600">No published knowledge assets yet.</p>
                    <Link href="/knowledge"
                      className="mt-1 block text-[11px] text-emerald-400 hover:text-emerald-300">
                      Save your first output →
                    </Link>
                  </div>
                ) : (
                  <div className="divide-y divide-white/[0.04]">
                    {data.top_knowledge_assets.map((a, i) => (
                      <div key={a.id} className="px-5 py-3 flex items-center gap-3">
                        <span className="text-[10px] text-gray-600 w-4 flex-shrink-0 tabular-nums">{i + 1}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-[11px] text-gray-300 truncate">{a.title}</p>
                          <p className="text-[10px] text-gray-600 capitalize">{a.type.replace('_', ' ')}</p>
                        </div>
                        <span className={`text-[9px] px-1.5 py-0.5 rounded font-semibold flex-shrink-0 ${
                          a.status === 'published' ? 'text-emerald-400' : 'text-gray-500'
                        }`}
                          style={{ background: a.status === 'published' ? 'rgba(16,185,129,0.1)' : 'rgba(255,255,255,0.05)' }}>
                          {a.reuse_count} reuse{a.reuse_count !== 1 ? 's' : ''}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Quick links to other governance pages */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { href: '/governance',         label: 'Risk Dashboard',   desc: 'Policy events + flags',         icon: 'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z', color: '#6366f1' },
              { href: '/governance/audit',   label: 'Audit Explorer',   desc: 'Browse all policy decisions',   icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4', color: '#3b82f6' },
              { href: '/knowledge',          label: 'Knowledge Library', desc: 'Published org knowledge',       icon: 'M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253', color: '#10b981' },
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
