'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'
import AppNav from '@/components/AppNav'
import LogoutButton from '@/components/LogoutButton'
import UsageDashboard from '@/components/UsageDashboard'
import AISystemOverview from '@/components/AISystemOverview'
import Link from 'next/link'
import axios from 'axios'

const QUICK_LINKS = [
  {
    href: '/chat',
    label: 'New conversation',
    desc: 'Start a governed AI chat session',
    icon: 'M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z',
    color: '#3b82f6',
  },
  {
    href: '/agents',
    label: 'Run an agent',
    desc: 'Execute a governed workflow',
    icon: 'M9 3H5a2 2 0 00-2 2v4m6-6h10a2 2 0 012 2v4M9 3v18m0 0h10a2 2 0 002-2V9M9 21H5a2 2 0 01-2-2V9m0 0h18',
    color: '#8b5cf6',
  },
  {
    href: '/research',
    label: 'Web research',
    desc: 'Policy-aware research requests',
    icon: 'M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z',
    color: '#06b6d4',
  },
]

// ── Governance health bar ──────────────────────────────────────────────────────
const HEALTH_DEFAULTS = [
  { name: 'Policy Engine',    detail: '10 rules · v1.1.0' },
  { name: 'Audit Layer',      detail: 'immutable · append-only' },
  { name: 'Classification',   detail: '4 data tiers' },
  { name: 'Budget Controls',  detail: 'per-user enforced' },
  { name: 'Provider Routing', detail: 'multi-provider · abstracted' },
]

type StatusComponent = { name: string; status: string; version?: string; description?: string }

function GovernanceHealthBar({ components }: { components: StatusComponent[] }) {
  const items = components.length > 0 ? components : HEALTH_DEFAULTS.map(d => ({ name: d.name, status: 'operational' }))

  return (
    <div className="card px-5 py-3.5">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 pulse-dot" />
        <span className="stat-label">Governance systems</span>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {items.slice(0, 5).map((c, i) => {
          const def = HEALTH_DEFAULTS[i]
          return (
            <div key={c.name} className="flex flex-col gap-0.5">
              <div className="flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                  style={{ background: c.status === 'operational' ? '#10b981' : c.status === 'degraded' ? '#f59e0b' : '#ef4444' }} />
                <span className="text-[11px] text-gray-300 font-medium truncate">{c.name}</span>
              </div>
              <span className="text-[9px] font-mono text-gray-700 pl-3">
                {def?.detail ?? c.status}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Policy activity feed ───────────────────────────────────────────────────────
interface ActivityEvent {
  id: string
  time: string
  type: 'pass' | 'warn' | 'info' | 'audit'
  message: string
  isNew?: boolean
}

const SYNTHETIC_POOL: Omit<ActivityEvent, 'id' | 'time'>[] = [
  { type: 'pass',  message: 'Prompt classified: Internal' },
  { type: 'pass',  message: 'Secrets scan: no credentials detected' },
  { type: 'pass',  message: 'PII check: passed — no redactions required' },
  { type: 'pass',  message: 'Prompt injection scan: cleared' },
  { type: 'info',  message: 'Policy engine v1.1.0 evaluated — 10 rules applied' },
  { type: 'pass',  message: 'Data classification: Public — all providers eligible' },
  { type: 'pass',  message: 'Rate limit check passed' },
  { type: 'info',  message: 'Budget-aware routing: free-tier model selected' },
  { type: 'info',  message: 'Request routed to governed inference layer' },
  { type: 'warn',  message: 'PII detected: email address redacted before dispatch' },
  { type: 'info',  message: 'Provider routing: OpenRouter runtime selected' },
  { type: 'audit', message: 'Token usage logged' },
  { type: 'pass',  message: 'Policy decision: allow · risk 0.03' },
  { type: 'warn',  message: 'Sensitive keyword flagged — governance notice logged' },
  { type: 'info',  message: 'Budget controls active — workspace policy enforced' },
  { type: 'audit', message: 'Audit event recorded — request logged' },
  { type: 'pass',  message: 'External research classification: approved for dispatch' },
  { type: 'warn',  message: 'Classification: Internal — OpenRouter free tier selected' },
  { type: 'pass',  message: 'Agent execution: policy-checked before run' },
  { type: 'info',  message: 'Governance mode: deterministic-phase1' },
]

type DemoAPIEvent = {
  id: string; timestamp: string; decision: string;
  actor_email?: string; risk_score?: number; flags?: string[]; model?: string
}

function nowStr() {
  return new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

function apiEventToActivity(e: DemoAPIEvent): ActivityEvent {
  const dec = e.decision
  let type: ActivityEvent['type'] = 'pass'
  let message = `Policy decision: ${dec}`

  if (dec === 'warn')     { type = 'warn';  message = `Policy notice: warn · risk ${(e.risk_score ?? 0).toFixed(2)}` }
  if (dec === 'escalate') { type = 'warn';  message = `Governance escalation · risk ${(e.risk_score ?? 0).toFixed(2)}` }
  if (dec === 'modify')   { type = 'info';  message = `Prompt modified: PII redaction applied` }
  if (dec === 'block')    { type = 'warn';  message = `Request blocked · risk ${(e.risk_score ?? 0).toFixed(2)} · ${(e.flags ?? []).join(', ')}` }
  if (dec === 'allow')    { type = 'pass';  message = `Policy decision: allow · risk ${(e.risk_score ?? 0).toFixed(2)}` }

  return {
    id: e.id,
    time: nowStr(),
    type,
    message,
  }
}

function PolicyActivityFeed() {
  const [events, setEvents]   = useState<ActivityEvent[]>([])
  const [seeded, setSeeded]   = useState(false)
  const feedRef = useRef<HTMLDivElement>(null)

  // Seed from real demo-events endpoint
  useEffect(() => {
    axios.get('/api/status/demo-events?count=12')
      .then(r => {
        const apiEvents: ActivityEvent[] = (r.data.events as DemoAPIEvent[])
          .slice(0, 8)
          .map(apiEventToActivity)
        const extra = SYNTHETIC_POOL.slice(0, 4).map((s, i) => ({
          ...s, id: `seed-${i}`, time: nowStr(),
        }))
        setEvents([...apiEvents, ...extra].slice(0, 12))
        setSeeded(true)
      })
      .catch(() => {
        // Fallback: purely synthetic
        const initial = SYNTHETIC_POOL.slice(0, 10).map((s, i) => ({
          ...s, id: `init-${i}`, time: nowStr(),
        }))
        setEvents(initial)
        setSeeded(true)
      })
  }, [])

  // Add synthetic events at intervals
  useEffect(() => {
    if (!seeded) return
    const tick = () => {
      const template = SYNTHETIC_POOL[Math.floor(Math.random() * SYNTHETIC_POOL.length)]
      setEvents(prev => [
        { ...template, id: `live-${Date.now()}`, time: nowStr(), isNew: true },
        ...prev.map(e => ({ ...e, isNew: false })).slice(0, 14),
      ])
    }
    // First tick in 8-14s, then every 8-14s
    const delay = 8000 + Math.random() * 6000
    const t = setTimeout(() => {
      tick()
      const interval = setInterval(tick, 8000 + Math.random() * 6000)
      return () => clearInterval(interval)
    }, delay)
    return () => clearTimeout(t)
  }, [seeded])

  const DOT: Record<string, string> = {
    pass:  'bg-emerald-500',
    warn:  'bg-amber-500',
    info:  'bg-blue-500',
    audit: 'bg-gray-500',
  }

  return (
    <div className="card overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/[0.06]">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-emerald-500 pulse-dot" />
          <span className="text-xs font-semibold text-gray-200">Policy Activity</span>
        </div>
        <span className="text-[9px] text-gray-700 font-mono uppercase tracking-wider">governance engine</span>
      </div>

      <div ref={feedRef} className="divide-y divide-white/[0.03]"
        style={{ maxHeight: 280, overflowY: 'hidden' }}>
        {events.length === 0 ? (
          <div className="px-5 py-8 text-center">
            <div className="space-y-1.5">
              {[1, 2, 3].map(i => (
                <div key={i} className="skeleton h-4" style={{ width: `${60 + i * 10}%`, margin: '0 auto' }} />
              ))}
            </div>
          </div>
        ) : (
          events.map((e) => (
            <div key={e.id}
              className="flex items-center gap-3 px-5 py-2"
              style={{ animation: e.isNew ? 'fadeUp 0.3s ease both' : 'none' }}>
              <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${DOT[e.type] ?? DOT.info}`} />
              <span className="text-[9px] font-mono text-gray-700 flex-shrink-0 w-14 tabular-nums">{e.time}</span>
              <span className="text-[11px] text-gray-400 flex-1 truncate">{e.message}</span>
            </div>
          ))
        )}
      </div>

      <div className="px-5 py-2.5 border-t border-white/[0.04] flex items-center justify-between">
        <span className="text-[9px] font-mono text-gray-800">
          demo mode · simulated governance stream
        </span>
        {events.length > 0 && (
          <span className="text-[9px] text-gray-700">{events.length} events</span>
        )}
      </div>
    </div>
  )
}

// ── Main ────────────────────────────────────────────────────────────────────────
export default function DashboardPage() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const [statusComponents, setStatusComponents] = useState<StatusComponent[]>([])

  useEffect(() => {
    if (loading) return
    if (!user) { router.replace('/login'); return }
    if (!user.training_completed) { router.replace('/training'); return }
  }, [user, loading, router])

  useEffect(() => {
    axios.get('/api/status')
      .then(r => setStatusComponents(r.data.components ?? []))
      .catch(() => {})
  }, [])

  if (loading || !user) return null

  return (
    <div className="flex flex-col h-full" style={{ background: 'var(--surface-1)' }}>

      <header className="page-header">
        <div className="logo-mark">A</div>
        <span className="text-sm font-semibold text-white hidden sm:block">Aegis Lite</span>
        <div className="divider hidden sm:block" style={{ height: 16 }} />
        <AppNav currentPage="/dashboard" />
        <div className="ml-auto flex items-center gap-3">
          {user.role === 'admin' && <span className="badge badge-info">Admin</span>}
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0"
              style={{ background: 'linear-gradient(135deg, #3b82f6, #6366f1)' }}>
              {user.name[0].toUpperCase()}
            </div>
            <span className="text-xs text-gray-400 hidden sm:block">{user.name}</span>
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-5">
        <div className="max-w-4xl mx-auto space-y-4">

          <div className="flex items-start justify-between gap-4 pt-1">
            <div>
              <h1 className="text-base font-semibold text-white">Governance Workspace</h1>
              <p className="text-xs text-gray-500 mt-0.5">
                Monitored AI usage · policy decisions · cost telemetry
              </p>
            </div>
            <div className="hidden sm:block text-right">
              <p className="stat-label">Signed in as</p>
              <p className="text-xs text-gray-400 font-medium mt-0.5">{user.email}</p>
            </div>
          </div>

          {/* Governance health */}
          <GovernanceHealthBar components={statusComponents} />

          {/* Quick links */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {QUICK_LINKS.map(({ href, label, desc, icon, color }) => (
              <Link key={href} href={href}
                className="card card-hover p-4 flex items-center gap-3 group">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 transition-all group-hover:scale-105"
                  style={{ background: `${color}15`, border: `1px solid ${color}25` }}>
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke={color} strokeWidth={1.75}>
                    <path strokeLinecap="round" strokeLinejoin="round" d={icon} />
                  </svg>
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-white truncate group-hover:text-blue-200 transition-colors">{label}</p>
                  <p className="text-[10px] text-gray-500 truncate">{desc}</p>
                </div>
              </Link>
            ))}
          </div>

          {/* Admin: AI registry */}
          {user.role === 'admin' && <AISystemOverview />}

          {/* Usage */}
          <UsageDashboard isAdmin={user.role === 'admin'} />

          {/* Policy activity feed */}
          <PolicyActivityFeed />

          {/* Governance nav for admins */}
          {user.role === 'admin' && (
            <div className="card p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center"
                  style={{ background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.2)' }}>
                  <svg className="w-4 h-4 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                </div>
                <div>
                  <p className="text-xs font-semibold text-white">Governance Dashboard</p>
                  <p className="text-[10px] text-gray-500">Policy events, risk scores, audit explorer</p>
                </div>
              </div>
              <Link href="/governance"
                className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors">
                Open →
              </Link>
            </div>
          )}
        </div>
      </div>
      <LogoutButton />
    </div>
  )
}
