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

// ── Policy activity feed — real governance data ────────────────────────────────
interface ActivityEvent {
  id: string
  time: string
  type: 'pass' | 'warn' | 'info' | 'audit'
  message: string
  isNew?: boolean
}

interface RealEvent {
  id: string; request_id: string; timestamp: string; actor: string
  decision: string; runtime: string; cost_usd: number; token_count: number
  event_type: string; severity: string
}

function eventTimeStr(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-US', {
    hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit',
  })
}

function realToActivity(e: RealEvent): ActivityEvent {
  const rid = e.request_id ?? e.id.slice(0, 8)
  const dec = e.decision
  const tok = e.token_count
  const cost = e.cost_usd.toFixed(tok > 0 ? 6 : 0)

  let type: ActivityEvent['type'] = 'pass'
  let message = `req-${rid} · ${dec}`

  if (dec === 'allow') {
    type = 'pass'
    message = `req-${rid} · policy: allow · ${e.runtime} · ${tok} tok · $${cost}`
  } else if (dec === 'warn') {
    type = 'warn'
    message = `req-${rid} · policy notice: warn · ${e.runtime} · v1.1.0`
  } else if (dec === 'modify') {
    type = 'info'
    message = `req-${rid} · prompt modified · PII redaction applied · ${e.runtime}`
  } else if (dec === 'escalate') {
    type = 'warn'
    message = `req-${rid} · governance escalation · ${e.runtime}`
  } else if (dec === 'block') {
    type = 'warn'
    message = `req-${rid} · request BLOCKED · policy v1.1.0`
  }

  return { id: e.id, time: eventTimeStr(e.timestamp), type, message }
}

import { api as apiClient, STORAGE_KEY_JWT } from '@/lib/api'

function PolicyActivityFeed({ userRole }: { userRole: 'admin' | 'user' }) {
  const [events, setEvents]       = useState<ActivityEvent[]>([])
  const [loading, setLoading]     = useState(true)
  const [streamMode, setStreamMode] = useState<'sse' | 'poll' | 'idle'>('idle')
  const lastTimestamp             = useRef<string | null>(null)
  const esRef                     = useRef<EventSource | null>(null)

  // ── Initial seed from real activity endpoint ────────────────────────────────
  useEffect(() => {
    apiClient.getGovernanceActivity({ limit: 20 })
      .then(r => {
        const realEvents: RealEvent[] = r.data.events ?? []
        if (realEvents.length > 0) {
          lastTimestamp.current = realEvents[0].timestamp
          setEvents(realEvents.map(realToActivity))
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  // ── SSE stream subscription ─────────────────────────────────────────────────
  useEffect(() => {
    if (typeof window === 'undefined') return
    const jwt = localStorage.getItem(STORAGE_KEY_JWT)
    if (!jwt) { setStreamMode('poll'); return }

    const es = new EventSource(`/api/governance/stream?token=${encodeURIComponent(jwt)}`)
    esRef.current = es
    setStreamMode('sse')

    es.onmessage = (ev) => {
      try {
        const data = JSON.parse(ev.data)
        if (data.error) { es.close(); setStreamMode('poll'); return }
        const activity = realToActivity(data as RealEvent)
        lastTimestamp.current = data.timestamp
        setEvents(prev => [
          { ...activity, isNew: true },
          ...prev.map(e => ({ ...e, isNew: false })).slice(0, 19),
        ])
      } catch { /* ignore malformed events */ }
    }

    es.onerror = () => {
      es.close()
      esRef.current = null
      setStreamMode('poll')
    }

    return () => { es.close(); esRef.current = null }
  }, [])

  // ── Polling fallback (when SSE unavailable) ─────────────────────────────────
  useEffect(() => {
    if (streamMode !== 'poll') return
    const poll = async () => {
      try {
        const params: { limit: number; since?: string } = { limit: 10 }
        if (lastTimestamp.current) params.since = lastTimestamp.current
        const r = await apiClient.getGovernanceActivity(params)
        const newEvents: RealEvent[] = r.data.events ?? []
        if (newEvents.length > 0) {
          lastTimestamp.current = newEvents[0].timestamp
          setEvents(prev => [
            ...newEvents.map(e => ({ ...realToActivity(e), isNew: true })),
            ...prev.map(e => ({ ...e, isNew: false })).slice(0, 18 - newEvents.length),
          ])
        }
      } catch { /* polling errors are silent */ }
    }
    const interval = setInterval(poll, 15000)
    return () => clearInterval(interval)
  }, [streamMode])

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
          <span className="badge badge-info text-[9px]">Live</span>
        </div>
        <div className="flex items-center gap-1.5 text-[9px] text-gray-700 font-mono">
          {streamMode === 'sse' && (
            <><div className="w-1 h-1 rounded-full bg-emerald-700" />
            <span>streaming</span></>
          )}
          {streamMode === 'poll' && (
            <><div className="w-1 h-1 rounded-full bg-blue-700" />
            <span>polling · 15s</span></>
          )}
          {streamMode === 'idle' && <span>loading</span>}
        </div>
      </div>

      <div className="divide-y divide-white/[0.03]" style={{ maxHeight: 280, overflowY: 'hidden' }}>
        {loading ? (
          <div className="px-5 py-8 space-y-1.5">
            {[90, 70, 80].map((w, i) => (
              <div key={i} className="skeleton h-4" style={{ width: `${w}%` }} />
            ))}
          </div>
        ) : events.length === 0 ? (
          <div className="px-5 py-8 text-center">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center mx-auto mb-3 border border-white/[0.06]"
              style={{ background: 'rgba(255,255,255,0.03)' }}>
              <svg className="w-4 h-4 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75z" />
              </svg>
            </div>
            <p className="text-xs text-gray-500 font-medium mb-1">No governance activity yet</p>
            <p className="text-[10px] text-gray-600 leading-relaxed max-w-[200px] mx-auto">
              Send a governed request from Chat, Agents, or Research to generate real telemetry.
            </p>
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
          real data · policy engine v1.1.0
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
          <PolicyActivityFeed userRole={user.role as 'admin' | 'user'} />

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
