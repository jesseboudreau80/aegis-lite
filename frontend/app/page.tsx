'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'
import Link from 'next/link'
import axios from 'axios'

// ── Types ──────────────────────────────────────────────────────────────────────
type StatusData = {
  status: string
  edition: string
  demo_mode: boolean
  policy: { version: string; rules_active: number; pii_patterns: number; secret_patterns: number; injection_patterns: number }
  models: { registered: number; providers: { name: string; status: string; latency_ms?: number }[] }
  workspace: { users: number }
  summary: { total_requests: number; blocked: number; escalated?: number; modified?: number; avg_risk_score: number; pii_redactions?: number }
  recent_events: { id: string; timestamp: string; event_type: string; decision: string; severity: string; flags: string[]; risk_score: number }[]
  components: { name: string; status: string; version?: string; description?: string }[]
}

// ── Rule chain ─────────────────────────────────────────────────────────────────
const RULE_CHAIN = [
  { step: 1,  name: '_check_secrets',            action: 'BLOCK',    color: '#ef4444' },
  { step: 2,  name: '_check_model_access',        action: 'CONTROL',  color: '#8b5cf6' },
  { step: 3,  name: '_check_agent_permissions',   action: 'ENFORCE',  color: '#8b5cf6' },
  { step: 4,  name: '_check_data_classification', action: 'CLASSIFY', color: '#3b82f6' },
  { step: 5,  name: '_check_pii',                 action: 'REDACT',   color: '#f97316' },
  { step: 6,  name: '_check_prompt_injection',    action: 'ESCALATE', color: '#fbbf24' },
  { step: 7,  name: '_check_sensitive_keywords',  action: 'WARN',     color: '#fbbf24' },
  { step: 8,  name: '_check_research_outbound',   action: 'RESTRICT', color: '#06b6d4' },
  { step: 9,  name: '_check_tool_grants',         action: 'GATE',     color: '#10b981' },
  { step: 10, name: '_apply_risk_controls',       action: 'ALLOW',    color: '#10b981' },
]

const FEATURES = [
  { title: 'Secrets Detection',      desc: '9 credential patterns — hard block before dispatch.',        color: '#ef4444' },
  { title: 'PII Redaction',          desc: 'Email, phone, SSN, credit card — auto-redacted in-flight.', color: '#f97316' },
  { title: 'Injection Defense',      desc: '21 jailbreak patterns with cumulative risk scoring.',        color: '#fbbf24' },
  { title: 'Data Classification',    desc: 'Public → Internal → Confidential → Restricted auto-detect.',color: '#3b82f6' },
  { title: 'Budget-Aware Routing',   desc: 'Free-tier fallback when monthly spend limits approach.',     color: '#10b981' },
  { title: 'Immutable Audit Trail',  desc: 'Rule trace + policy version logged on every decision.',      color: '#6366f1' },
]

const DECISION_STYLE: Record<string, { bg: string; text: string; dot: string }> = {
  allow:    { bg: 'rgba(16,185,129,0.1)',  text: '#34d399', dot: '#10b981' },
  warn:     { bg: 'rgba(245,158,11,0.1)',  text: '#fbbf24', dot: '#f59e0b' },
  modify:   { bg: 'rgba(59,130,246,0.1)',  text: '#60a5fa', dot: '#3b82f6' },
  escalate: { bg: 'rgba(249,115,22,0.1)',  text: '#fb923c', dot: '#f97316' },
  block:    { bg: 'rgba(239,68,68,0.1)',   text: '#f87171', dot: '#ef4444' },
}

const GOOD_FIRST_ISSUES = [
  { n: 1,  title: 'Write unit tests for the policy engine',    label: 'testing'      },
  { n: 2,  title: 'Add IBAN detection to PII rule set',        label: 'policy'       },
  { n: 5,  title: 'Write Railway deployment guide',            label: 'docs'         },
  { n: 7,  title: 'Improve mobile responsiveness of nav',      label: 'frontend'     },
  { n: 8,  title: 'Write AGENT_SYSTEM.md documentation',       label: 'docs'         },
  { n: 11, title: 'Expand OpenRouter free model support',      label: 'providers'    },
  { n: 15, title: 'Docker Compose profiles for dev/prod',      label: 'deployment'   },
]

// ── Animated policy engine visualizer ─────────────────────────────────────────
function PolicyTrace() {
  const [active, setActive] = useState(0)
  const [done, setDone] = useState<number[]>([])

  useEffect(() => {
    const t = setInterval(() => {
      setActive(s => {
        const next = (s + 1) % RULE_CHAIN.length
        if (next === 0) setDone([])
        else setDone(prev => [...prev, s])
        return next
      })
    }, 340)
    return () => clearInterval(t)
  }, [])

  return (
    <div className="rounded-2xl overflow-hidden border border-white/[0.06]"
      style={{ background: '#0c0c14', fontFamily: 'var(--font-geist-mono)' }}>
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-white/[0.05]">
        <div className="flex gap-1.5">
          {['#ef4444', '#f59e0b', '#22c55e'].map(c => (
            <div key={c} className="w-2.5 h-2.5 rounded-full" style={{ background: c, opacity: 0.6 }} />
          ))}
        </div>
        <span className="text-[10px] text-gray-600 ml-1 truncate">policy_engine.evaluate_request(ctx)</span>
        <div className="ml-auto flex items-center gap-1.5 flex-shrink-0">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 pulse-dot" />
          <span className="text-[10px] text-emerald-500">LIVE</span>
        </div>
      </div>

      <div className="p-3 space-y-1">
        {RULE_CHAIN.map((rule, i) => {
          const isDone    = done.includes(i)
          const isActive  = active === i
          const isPending = !isDone && !isActive
          return (
            <div key={rule.step}
              className="flex items-center justify-between px-3 py-1.5 rounded-lg transition-all duration-200"
              style={{ background: isActive ? 'rgba(255,255,255,0.05)' : 'transparent', opacity: isPending ? 0.32 : 1 }}>
              <div className="flex items-center gap-2.5">
                <div className="w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0"
                  style={{
                    background: isDone ? 'rgba(16,185,129,0.2)' : isActive ? `${rule.color}20` : 'rgba(255,255,255,0.04)',
                    border: `1px solid ${isDone ? '#10b981' : isActive ? rule.color : 'rgba(255,255,255,0.08)'}`,
                  }}>
                  <span style={{ color: isDone ? '#10b981' : isActive ? rule.color : 'rgba(255,255,255,0.3)', fontSize: 8 }}>
                    {isDone ? '✓' : rule.step}
                  </span>
                </div>
                <span className="text-[10px]"
                  style={{ color: isDone ? '#4b5563' : isActive ? '#e5e7eb' : '#374151' }}>
                  {rule.name}
                </span>
              </div>
              <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded transition-all duration-200"
                style={{
                  color: isDone || isActive ? rule.color : 'rgba(255,255,255,0.15)',
                  background: isDone || isActive ? `${rule.color}15` : 'transparent',
                  border: `1px solid ${isDone || isActive ? `${rule.color}30` : 'transparent'}`,
                }}>
                {rule.action}
              </span>
            </div>
          )
        })}
      </div>

      <div className="px-4 py-2.5 border-t border-white/[0.05] flex justify-between">
        <span className="text-[9px] text-gray-600">
          risk_score: <span className="text-gray-400">0.{String(active * 8).padStart(2, '0')}</span>
        </span>
        <span className="text-[9px] text-gray-600">
          policy_version: <span className="text-gray-400">1.1.0</span>
        </span>
      </div>
    </div>
  )
}

// ── Status panel ───────────────────────────────────────────────────────────────
function StatusPanel({ data, loading }: { data: StatusData | null; loading: boolean }) {
  if (loading) {
    return (
      <div className="rounded-2xl border border-white/[0.06] p-5" style={{ background: '#111118' }}>
        <div className="flex items-center gap-2 mb-4">
          <div className="w-2 h-2 rounded-full bg-gray-700" />
          <span className="text-xs text-gray-500">Loading status…</span>
        </div>
        <div className="space-y-2">
          {[80, 60, 70, 50].map((w, i) => (
            <div key={i} className="skeleton h-6" style={{ width: `${w}%` }} />
          ))}
        </div>
      </div>
    )
  }

  if (!data) return null

  const s = data.summary
  return (
    <div className="rounded-2xl border border-white/[0.06] overflow-hidden" style={{ background: '#111118' }}>
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.05]">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-emerald-500 pulse-dot" />
          <span className="text-xs font-semibold text-gray-300">System Status</span>
          {data.demo_mode && (
            <span className="text-[9px] px-1.5 py-0.5 rounded border"
              style={{ color: '#60a5fa', background: 'rgba(59,130,246,0.1)', borderColor: 'rgba(59,130,246,0.2)' }}>
              DEMO
            </span>
          )}
        </div>
        <span className="text-[10px] text-emerald-500 font-medium">All operational</span>
      </div>

      <div className="grid grid-cols-2 gap-px" style={{ background: 'rgba(255,255,255,0.04)' }}>
        {[
          { label: 'Requests / 24h',  value: s.total_requests?.toLocaleString() ?? '—', color: '#3b82f6' },
          { label: 'Blocked',         value: s.blocked?.toString() ?? '—',               color: '#ef4444' },
          { label: 'Avg risk score',  value: s.avg_risk_score?.toFixed(3) ?? '—',        color: '#fbbf24' },
          { label: 'PII redactions',  value: s.pii_redactions?.toString() ?? '—',        color: '#f97316' },
        ].map(({ label, value, color }) => (
          <div key={label} className="px-4 py-3" style={{ background: '#111118' }}>
            <p className="text-[10px] text-gray-600 uppercase tracking-wider mb-1">{label}</p>
            <p className="text-xl font-bold" style={{ color }}>{value}</p>
          </div>
        ))}
      </div>

      <div className="px-4 py-3 border-t border-white/[0.05] space-y-1.5">
        {(data.components ?? []).slice(0, 4).map(c => (
          <div key={c.name} className="flex items-center justify-between">
            <span className="text-[10px] text-gray-500">{c.name}</span>
            <div className="flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              <span className="text-[10px] text-emerald-500">operational</span>
            </div>
          </div>
        ))}
      </div>

      {(data.recent_events?.length ?? 0) > 0 && (
        <div className="border-t border-white/[0.05]">
          <div className="px-4 py-2 border-b border-white/[0.04]">
            <span className="text-[9px] text-gray-600 uppercase tracking-wider">Recent events</span>
          </div>
          {data.recent_events.slice(0, 4).map(e => {
            const style = DECISION_STYLE[e.decision] ?? DECISION_STYLE.allow
            return (
              <div key={e.id} className="px-4 py-2 flex items-center gap-2.5 border-b border-white/[0.03] last:border-0">
                <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: style.dot }} />
                <span className="text-[9px] px-1.5 py-0.5 rounded font-semibold"
                  style={{ background: style.bg, color: style.text }}>
                  {e.decision}
                </span>
                <span className="text-[10px] text-gray-500 flex-1 truncate">{e.event_type}</span>
                <span className="text-[9px] text-gray-700 tabular-nums flex-shrink-0">
                  {new Date(e.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── Architecture diagram ───────────────────────────────────────────────────────
function ArchDiagram() {
  return (
    <div className="rounded-2xl border border-white/[0.06] overflow-hidden h-full" style={{ background: '#111118' }}>
      <div className="p-5 flex flex-col gap-2.5 h-full">
        {/* Frontend */}
        <div className="rounded-xl border p-3"
          style={{ background: 'rgba(59,130,246,0.06)', borderColor: 'rgba(59,130,246,0.15)' }}>
          <p className="text-[9px] text-blue-400 uppercase tracking-wider font-semibold mb-2">Next.js 15 Frontend</p>
          <div className="flex gap-1.5 flex-wrap">
            {['Chat', 'Agents', 'Research', 'Governance', 'Audit', 'Dashboard'].map(p => (
              <span key={p} className="text-[9px] px-1.5 py-0.5 rounded"
                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)', color: '#6b7280' }}>
                {p}
              </span>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2 px-3">
          <div className="flex-1 border-t border-dashed border-white/[0.08]" />
          <span className="text-[8px] text-gray-700">JWT auth · /api proxy</span>
          <div className="flex-1 border-t border-dashed border-white/[0.08]" />
        </div>

        {/* Policy + Router */}
        <div className="grid grid-cols-2 gap-2">
          {[
            { label: 'Policy Engine', color: '#8b5cf6', items: ['10 ordered rules', 'Risk scoring', 'Rule trace log'] },
            { label: 'AI Router',     color: '#10b981', items: ['Budget-aware routing', 'Provider fallback', 'Model override'] },
          ].map(({ label, color, items }) => (
            <div key={label} className="rounded-xl border p-2.5"
              style={{ background: `${color}08`, borderColor: `${color}20` }}>
              <p className="text-[8px] font-semibold uppercase tracking-wider mb-1.5" style={{ color }}>{label}</p>
              {items.map(t => (
                <p key={t} className="text-[8px] text-gray-600 flex items-center gap-1">
                  <span style={{ color: '#10b981' }}>›</span> {t}
                </p>
              ))}
            </div>
          ))}
        </div>

        <div className="flex items-center gap-2 px-3">
          <div className="flex-1 border-t border-dashed border-white/[0.08]" />
          <span className="text-[8px] text-gray-700">provider dispatch</span>
          <div className="flex-1 border-t border-dashed border-white/[0.08]" />
        </div>

        {/* Providers */}
        <div className="grid grid-cols-4 gap-1.5">
          {[
            { name: 'Anthropic', color: '#f97316' },
            { name: 'OpenAI',    color: '#10b981' },
            { name: 'OpenRtr.',  color: '#6366f1' },
            { name: 'Perplexity',color: '#3b82f6' },
          ].map(({ name, color }) => (
            <div key={name} className="rounded-lg p-2 text-center"
              style={{ background: `${color}10`, border: `1px solid ${color}25` }}>
              <p className="text-[8px] font-semibold" style={{ color }}>{name}</p>
            </div>
          ))}
        </div>

        <div className="flex items-center gap-2 px-3">
          <div className="flex-1 border-t border-dashed border-white/[0.08]" />
          <span className="text-[8px] text-gray-700">audit + governance log</span>
          <div className="flex-1 border-t border-dashed border-white/[0.08]" />
        </div>

        {/* Storage */}
        <div className="rounded-xl border p-2.5"
          style={{ background: 'rgba(251,191,36,0.05)', borderColor: 'rgba(251,191,36,0.12)' }}>
          <p className="text-[8px] text-yellow-500 uppercase tracking-wider font-semibold mb-1">Storage</p>
          <div className="flex gap-4">
            <span className="text-[8px] text-gray-600">AuditLog · GovernanceEvent · Users · Agents</span>
          </div>
          <p className="text-[8px] text-gray-700 mt-0.5">SQLite (default) · PostgreSQL (production)</p>
        </div>
      </div>
    </div>
  )
}

// ── Main ────────────────────────────────────────────────────────────────────────
export default function LandingPage() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const [status, setStatus] = useState<StatusData | null>(null)
  const [statusLoading, setStatusLoading] = useState(true)

  useEffect(() => {
    if (!loading && user) router.replace('/dashboard')
  }, [user, loading, router])

  useEffect(() => {
    axios.get('/api/status')
      .then(r => setStatus(r.data))
      .catch(() => {})
      .finally(() => setStatusLoading(false))
  }, [])

  if (loading) return null

  return (
    <div className="min-h-screen text-gray-100" style={{ background: 'var(--surface-1)' }}>

      {/* Nav */}
      <header className="sticky top-0 z-50 border-b border-white/[0.05] px-6 py-3.5 flex items-center justify-between"
        style={{ background: 'rgba(10,10,15,0.9)', backdropFilter: 'blur(16px)' }}>
        <div className="flex items-center gap-2.5">
          <div className="logo-mark">A</div>
          <span className="text-sm font-semibold text-white">Aegis Lite</span>
          <span className="badge badge-info ml-0.5">OSS</span>
        </div>
        <div className="flex items-center gap-4">
          <nav className="hidden md:flex items-center gap-5 text-xs text-gray-500">
            {[
              { label: 'Docs',    href: 'https://github.com/jesseboudreau80/aegis-lite/blob/main/docs/SETUP.md' },
              { label: 'Roadmap',href: 'https://github.com/jesseboudreau80/aegis-lite/blob/main/docs/ROADMAP.md' },
              { label: 'Issues', href: 'https://github.com/jesseboudreau80/aegis-lite/issues' },
            ].map(({ label, href }) => (
              <a key={label} href={href} target="_blank" rel="noopener noreferrer"
                className="hover:text-gray-200 transition-colors">{label}</a>
            ))}
          </nav>
          <div className="h-4 w-px hidden md:block" style={{ background: 'rgba(255,255,255,0.08)' }} />
          <a href="https://github.com/jesseboudreau80/aegis-lite" target="_blank" rel="noopener noreferrer"
            className="hidden sm:flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-200 transition-colors">
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
              <path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd" />
            </svg>
            GitHub
          </a>
          <Link href="/login"
            className="px-3.5 py-1.5 text-xs font-semibold text-white rounded-lg transition-all hover:opacity-90"
            style={{ background: 'linear-gradient(135deg, #3b82f6, #6366f1)' }}>
            Open workspace
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="max-w-6xl mx-auto px-6 pt-20 pb-16">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          <div>
            <div className="fade-up inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs mb-7 border"
              style={{ background: 'rgba(59,130,246,0.08)', borderColor: 'rgba(59,130,246,0.2)', color: '#60a5fa' }}>
              <div className="w-1.5 h-1.5 rounded-full bg-blue-400 pulse-dot" />
              Open-source · Apache 2.0 · Self-hostable
            </div>

            <h1 className="fade-up-delay-1 text-5xl sm:text-6xl font-bold leading-[1.06] tracking-tight mb-5">
              <span className="gradient-text">AI governance</span>
              <br />
              <span className="text-gray-300 text-4xl sm:text-5xl">that runs</span>
              <br />
              <span className="text-gray-300 text-4xl sm:text-5xl">before the model</span>
            </h1>

            <p className="fade-up-delay-2 text-gray-400 text-lg leading-relaxed mb-8 max-w-xl">
              A deterministic policy engine evaluates every AI request through 10 ordered rule checks —
              PII redaction, secrets scanning, injection defense — before a single token reaches the API.
            </p>

            <div className="fade-up-delay-3 flex items-center gap-3 flex-wrap">
              <Link href="/login"
                className="px-6 py-2.5 text-sm font-semibold text-white rounded-xl transition-all hover:scale-[1.02]"
                style={{ background: 'linear-gradient(135deg, #3b82f6, #6366f1)', boxShadow: '0 4px 24px rgba(99,102,241,0.25)' }}>
                Launch workspace →
              </Link>
              <a href="https://github.com/jesseboudreau80/aegis-lite" target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-gray-300 rounded-xl border transition-all hover:text-white hover:border-white/20"
                style={{ borderColor: 'rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.04)' }}>
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd" />
                </svg>
                View source
              </a>
            </div>

            <div className="fade-up-delay-4 flex items-center gap-4 mt-8 flex-wrap">
              {[
                { t: 'FastAPI' }, { t: 'Next.js 15' }, { t: 'Docker' }, { t: 'SQLite → PostgreSQL' },
              ].map(({ t }) => (
                <span key={t} className="text-[11px] text-gray-600">{t}</span>
              ))}
            </div>
          </div>
          <div className="fade-up-delay-2">
            <PolicyTrace />
          </div>
        </div>
      </section>

      {/* Status + Architecture */}
      <section className="max-w-6xl mx-auto px-6 pb-20">
        <div className="grid lg:grid-cols-5 gap-6 items-start">
          <div className="lg:col-span-2">
            <p className="stat-label mb-3">Live system status</p>
            <StatusPanel data={status} loading={statusLoading} />
          </div>
          <div className="lg:col-span-3">
            <p className="stat-label mb-3">Request flow</p>
            <ArchDiagram />
          </div>
        </div>
      </section>

      {/* Feature grid */}
      <section className="max-w-6xl mx-auto px-6 pb-20">
        <div className="text-center mb-10">
          <h2 className="text-2xl font-bold text-white mb-2">Governance at every layer</h2>
          <p className="text-gray-500 text-sm">10 deterministic rules. 0 LLM calls inside the engine. Every decision traceable.</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {FEATURES.map(({ title, desc, color }, i) => (
            <div key={title} className={`card card-hover p-5 fade-up-delay-${(i % 6) + 1}`}>
              <div className="w-2 h-2 rounded-full mb-4" style={{ background: color }} />
              <h3 className="text-sm font-semibold text-white mb-1.5">{title}</h3>
              <p className="text-[11px] text-gray-500 leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Contributor CTA */}
      <section className="max-w-6xl mx-auto px-6 pb-20">
        <div className="grid lg:grid-cols-2 gap-5">
          {/* Good first issues */}
          <div className="card p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-semibold text-white">Good first issues</h3>
                <p className="text-[11px] text-gray-500 mt-0.5">Well-scoped work for new contributors</p>
              </div>
              <a href="https://github.com/jesseboudreau80/aegis-lite/labels/good-first-issue"
                target="_blank" rel="noopener noreferrer"
                className="text-[10px] text-blue-400 hover:text-blue-300">View all →</a>
            </div>
            <div className="space-y-1.5">
              {GOOD_FIRST_ISSUES.map(({ n, title, label }) => (
                <a key={n}
                  href={`https://github.com/jesseboudreau80/aegis-lite/issues/${n}`}
                  target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-2.5 p-2 rounded-xl hover:bg-white/[0.03] group transition-colors">
                  <span className="text-[10px] font-mono text-gray-600 w-5 flex-shrink-0">#{n}</span>
                  <span className="text-[11px] text-gray-400 group-hover:text-gray-200 flex-1 truncate transition-colors">{title}</span>
                  <span className="text-[9px] px-1.5 py-0.5 rounded border flex-shrink-0"
                    style={{ color: '#60a5fa', background: 'rgba(59,130,246,0.1)', borderColor: 'rgba(59,130,246,0.2)' }}>
                    {label}
                  </span>
                </a>
              ))}
            </div>
          </div>

          {/* Contribute CTA */}
          <div className="card p-6 flex flex-col justify-between"
            style={{ background: 'linear-gradient(135deg, rgba(59,130,246,0.06), rgba(99,102,241,0.06))' }}>
            <div>
              <h3 className="text-sm font-semibold text-white mb-2">Built for the community</h3>
              <p className="text-[11px] text-gray-500 leading-relaxed mb-5">
                AI governance infrastructure is a shared problem. The policy engine, audit log, and
                routing layer work better when more people build on them. New detection rules,
                provider integrations, and dashboard improvements are all welcome.
              </p>
              <div className="space-y-2 mb-5">
                {[
                  '🔐  Add policy rules — new PII patterns, injection variants',
                  '📊  Improve governance dashboard visualizations',
                  '🚀  Write deployment guides for Railway, Fly.io, VPS',
                  '🧪  Write the policy engine test suite (issue #1)',
                ].map(t => (
                  <p key={t} className="text-[11px] text-gray-500">{t}</p>
                ))}
              </div>
            </div>
            <div className="flex gap-2.5 flex-wrap">
              <a href="https://github.com/jesseboudreau80/aegis-lite"
                target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white rounded-lg hover:opacity-90"
                style={{ background: 'linear-gradient(135deg, #3b82f6, #6366f1)' }}>
                ⭐ Star on GitHub
              </a>
              <a href="https://github.com/jesseboudreau80/aegis-lite/blob/main/CONTRIBUTING.md"
                target="_blank" rel="noopener noreferrer"
                className="flex items-center px-4 py-2 text-xs text-gray-400 hover:text-gray-200 border border-white/[0.08] rounded-lg hover:border-white/[0.14] transition-all">
                CONTRIBUTING.md →
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Quickstart */}
      <section className="max-w-4xl mx-auto px-6 pb-24">
        <div className="card p-8 text-center">
          <h2 className="text-xl font-bold text-white mb-2">Up in 60 seconds</h2>
          <p className="text-gray-500 text-sm mb-6">Docker Compose. SQLite by default. No configuration needed to start.</p>
          <div className="font-mono text-sm rounded-xl p-4 mb-6 text-left border space-y-1"
            style={{ background: 'rgba(0,0,0,0.5)', borderColor: 'rgba(255,255,255,0.05)' }}>
            {[
              ['git', ' clone https://github.com/jesseboudreau80/aegis-lite'],
              ['cp',  ' .env.example .env'],
              ['docker', ' compose up'],
            ].map(([cmd, rest]) => (
              <div key={cmd + rest}>
                <span className="text-gray-600 select-none">$ </span>
                <span className="text-emerald-400">{cmd}</span>
                <span className="text-gray-300">{rest}</span>
              </div>
            ))}
          </div>
          <div className="flex items-center justify-center gap-3 flex-wrap">
            <Link href="/login"
              className="px-5 py-2.5 text-sm font-semibold text-white rounded-xl hover:opacity-90"
              style={{ background: 'linear-gradient(135deg, #3b82f6, #6366f1)' }}>
              Try the workspace
            </Link>
            <a href="https://github.com/jesseboudreau80/aegis-lite/blob/main/docs/SETUP.md"
              target="_blank" rel="noopener noreferrer"
              className="px-5 py-2.5 text-sm text-gray-400 hover:text-gray-200 transition-colors">
              Setup guide →
            </a>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/[0.05] px-6 py-8">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="logo-mark" style={{ width: 18, height: 18, fontSize: 9 }}>A</div>
            <span className="text-xs text-gray-600">Aegis Lite — Apache 2.0</span>
          </div>
          <div className="flex items-center gap-5 text-xs text-gray-600 flex-wrap justify-center">
            {['GitHub', 'Docs', 'Roadmap', 'Contributing', 'Security', 'Issues'].map(l => (
              <a key={l}
                href={`https://github.com/jesseboudreau80/aegis-lite${l === 'GitHub' ? '' : l === 'Issues' ? '/issues' : `/blob/main/${l === 'Docs' ? 'docs/SETUP.md' : l === 'Roadmap' ? 'docs/ROADMAP.md' : l.toUpperCase() + '.md'}`}`}
                className="hover:text-gray-400 transition-colors" target="_blank" rel="noopener noreferrer">{l}</a>
            ))}
          </div>
        </div>
      </footer>
    </div>
  )
}
