'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'
import Link from 'next/link'
import axios from 'axios'

// ── Types ──────────────────────────────────────────────────────────────────────
type StatusProvider = { name: string; status: string; latency_ms?: number; models?: string[] }
type StatusData = {
  status: string
  edition: string
  demo_mode: boolean
  deployment: string
  policy: { version: string; rules_active: number; pii_patterns: number; secret_patterns: number; injection_patterns: number }
  models: { registered: number; providers: StatusProvider[] }
  workspace: { users: number }
  summary: { total_requests: number; blocked: number; escalated?: number; avg_risk_score: number; pii_redactions?: number }
  recent_events: { id: string; timestamp: string; event_type: string; decision: string; severity: string; flags: string[]; risk_score: number; actor_email?: string; model?: string }[]
  components: { name: string; status: string; version?: string; description?: string }[]
}

// ── Constants ──────────────────────────────────────────────────────────────────
const RULE_CHAIN = [
  { step: 1,  name: '_check_secrets',             action: 'BLOCK',    color: '#ef4444' },
  { step: 2,  name: '_check_model_access',         action: 'CONTROL',  color: '#8b5cf6' },
  { step: 3,  name: '_check_agent_permissions',    action: 'ENFORCE',  color: '#8b5cf6' },
  { step: 4,  name: '_check_data_classification',  action: 'CLASSIFY', color: '#3b82f6' },
  { step: 5,  name: '_check_pii',                  action: 'REDACT',   color: '#f97316' },
  { step: 6,  name: '_check_prompt_injection',     action: 'ESCALATE', color: '#fbbf24' },
  { step: 7,  name: '_check_sensitive_keywords',   action: 'WARN',     color: '#fbbf24' },
  { step: 8,  name: '_check_research_outbound',    action: 'RESTRICT', color: '#06b6d4' },
  { step: 9,  name: '_check_tool_grants',          action: 'GATE',     color: '#10b981' },
  { step: 10, name: '_apply_risk_controls',        action: 'ALLOW',    color: '#10b981' },
]

const PROVIDER_STATIC = [
  {
    name: 'Anthropic', color: '#d97706', bg: 'rgba(217,119,6,0.07)',
    models: ['Claude Opus 4.7', 'Claude Sonnet 4.6'],
    tier: 'Premium · Standard',
    desc: 'Highest-capability reasoning and analysis. Best for complex policy evaluation and multi-step governance tasks.',
  },
  {
    name: 'OpenAI', color: '#10b981', bg: 'rgba(16,185,129,0.07)',
    models: ['GPT-4o', 'GPT-4o Mini'],
    tier: 'Standard · Budget',
    desc: 'Industry-standard models with strong structured output and code generation capabilities.',
  },
  {
    name: 'OpenRouter', color: '#6366f1', bg: 'rgba(99,102,241,0.07)',
    models: ['Mistral 7B', 'Llama 3.1 8B', 'Gemini Flash'],
    tier: 'Free tier',
    desc: 'Zero-cost open-source models via OpenRouter. Ideal for development, testing, and budget-constrained workloads.',
  },
  {
    name: 'Perplexity', color: '#3b82f6', bg: 'rgba(59,130,246,0.07)',
    models: ['Sonar', 'Sonar Pro'],
    tier: 'Research',
    desc: 'Web-grounded search with citations. Governed by data classification rules for outbound research queries.',
  },
]

const FEATURES = [
  { title: 'Secrets Detection',      desc: '9 credential patterns — API keys, tokens, private keys — hard block before any token reaches the API.', color: '#ef4444' },
  { title: 'PII Redaction',          desc: 'Email, phone, SSN, credit card auto-detected and redacted in-flight. Configurable per data classification level.', color: '#f97316' },
  { title: 'Injection Defense',      desc: '21 jailbreak and prompt injection patterns with cumulative risk scoring. Escalates on threshold breach.', color: '#fbbf24' },
  { title: 'Data Classification',    desc: 'Automatic Public → Internal → Confidential → Restricted classification. Controls model access per tier.', color: '#3b82f6' },
  { title: 'Budget-Aware Routing',   desc: 'Per-user monthly spend limits with automatic free-tier fallback when budget threshold is approached.', color: '#10b981' },
  { title: 'Immutable Audit Trail',  desc: 'Every request logged with full rule trace, risk score, policy version, token counts, and cost estimate.', color: '#6366f1' },
]

const ROADMAP = [
  {
    version: 'v1.0', statusKey: 'released', label: 'Released',
    title: 'Core Governance Engine',
    items: ['10-rule deterministic policy chain', 'PII + secrets detection', 'Immutable audit log', 'Multi-model routing + fallback', 'RBAC + budget controls', 'Demo mode + public status API'],
  },
  {
    version: 'v1.1', statusKey: 'planned', label: 'Next',
    title: 'Observability Layer',
    items: ['Time-series governance metrics', 'Policy alert rules + thresholds', 'Dashboard data export (CSV, JSON)', 'Webhook notifications on escalations', 'Grafana integration guide'],
  },
  {
    version: 'v1.2', statusKey: 'planned', label: 'Planned',
    title: 'Policy Marketplace',
    items: ['Shareable policy rule bundles', 'Rule testing + dry-run harness', 'Policy version diffing', 'Compliance templates (GDPR, SOC 2 stubs)', 'Community rule registry'],
  },
  {
    version: 'v2.0', statusKey: 'future', label: 'Future',
    title: 'Plugin Ecosystem',
    items: ['Plugin SDK for custom rules', 'Third-party provider adapters', 'Custom audit backend connectors', 'Enterprise bridge API'],
  },
]

const GOOD_FIRST_ISSUES = [
  { n: 1,  title: 'Write policy engine unit tests',        label: 'testing',    color: '#f97316' },
  { n: 2,  title: 'Add IBAN detection to PII rule set',    label: 'policy',     color: '#8b5cf6' },
  { n: 5,  title: 'Write Railway + Fly.io deploy guides',  label: 'docs',       color: '#6b7280' },
  { n: 7,  title: 'Improve mobile nav responsiveness',     label: 'frontend',   color: '#3b82f6' },
  { n: 8,  title: 'Write AGENT_SYSTEM.md',                 label: 'docs',       color: '#6b7280' },
  { n: 11, title: 'Expand OpenRouter free model support',  label: 'providers',  color: '#6366f1' },
  { n: 15, title: 'Docker Compose dev/prod profiles',      label: 'deployment', color: '#10b981' },
]

const DECISION_STYLE: Record<string, { bg: string; text: string; dot: string }> = {
  allow:    { bg: 'rgba(16,185,129,0.1)',  text: '#34d399', dot: '#10b981' },
  warn:     { bg: 'rgba(245,158,11,0.1)',  text: '#fbbf24', dot: '#f59e0b' },
  modify:   { bg: 'rgba(59,130,246,0.1)',  text: '#60a5fa', dot: '#3b82f6' },
  escalate: { bg: 'rgba(249,115,22,0.1)',  text: '#fb923c', dot: '#f97316' },
  block:    { bg: 'rgba(239,68,68,0.1)',   text: '#f87171', dot: '#ef4444' },
}

// ── Icons ──────────────────────────────────────────────────────────────────────
function GitHubIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 24 24">
      <path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd" />
    </svg>
  )
}

// ── Animated policy engine trace ───────────────────────────────────────────────
function PolicyTrace() {
  const [active, setActive] = useState(0)
  const [done, setDone]     = useState<number[]>([])

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
    <div className="rounded-2xl overflow-hidden border border-white/[0.07]"
      style={{ background: '#080810', fontFamily: 'var(--font-geist-mono)' }}>
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-white/[0.05]">
        <div className="flex gap-1.5">
          {['#ef4444', '#f59e0b', '#22c55e'].map(c => (
            <div key={c} className="w-2.5 h-2.5 rounded-full" style={{ background: c, opacity: 0.6 }} />
          ))}
        </div>
        <span className="text-[10px] text-gray-600 ml-1 truncate">policy_engine.evaluate_request(ctx)</span>
        <div className="ml-auto flex items-center gap-1.5 flex-shrink-0">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 pulse-dot" />
          <span className="text-[10px] text-emerald-500 font-mono">LIVE</span>
        </div>
      </div>
      <div className="p-3 space-y-0.5">
        {RULE_CHAIN.map((rule, i) => {
          const isDone    = done.includes(i)
          const isActive  = active === i
          const isPending = !isDone && !isActive
          return (
            <div key={rule.step}
              className="flex items-center justify-between px-3 py-1.5 rounded-lg transition-all duration-200"
              style={{ background: isActive ? 'rgba(255,255,255,0.05)' : 'transparent', opacity: isPending ? 0.28 : 1 }}>
              <div className="flex items-center gap-2.5">
                <div className="w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0"
                  style={{
                    background: isDone ? 'rgba(16,185,129,0.18)' : isActive ? `${rule.color}18` : 'rgba(255,255,255,0.03)',
                    border: `1px solid ${isDone ? '#10b981' : isActive ? rule.color : 'rgba(255,255,255,0.06)'}`,
                  }}>
                  <span style={{ color: isDone ? '#10b981' : isActive ? rule.color : 'rgba(255,255,255,0.25)', fontSize: 8 }}>
                    {isDone ? '✓' : rule.step}
                  </span>
                </div>
                <span className="text-[10px]"
                  style={{ color: isDone ? '#374151' : isActive ? '#e5e7eb' : '#1f2937' }}>
                  {rule.name}
                </span>
              </div>
              <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded"
                style={{
                  color:   isDone || isActive ? rule.color : 'rgba(255,255,255,0.1)',
                  background: isDone || isActive ? `${rule.color}12` : 'transparent',
                  border: `1px solid ${isDone || isActive ? `${rule.color}28` : 'transparent'}`,
                }}>
                {rule.action}
              </span>
            </div>
          )
        })}
      </div>
      <div className="px-4 py-2.5 border-t border-white/[0.05] flex justify-between items-center">
        <span className="text-[9px] text-gray-700 font-mono">
          risk_score: <span className="text-gray-500">0.{String(active * 8).padStart(2, '0')}</span>
        </span>
        <span className="text-[9px] text-gray-700 font-mono">
          policy_version: <span className="text-gray-500">1.1.0</span>
        </span>
      </div>
    </div>
  )
}

// ── Live metrics ticker ────────────────────────────────────────────────────────
function MetricsTicker({ data }: { data: StatusData | null }) {
  const s = data?.summary
  const p = data?.policy

  const items = [
    { label: 'REQUESTS / 24H',        value: s?.total_requests?.toLocaleString() ?? '—',   color: '#60a5fa' },
    { label: 'BLOCKED',               value: s?.blocked?.toString() ?? '—',                 color: '#f87171' },
    { label: 'AVG RISK SCORE',        value: s?.avg_risk_score?.toFixed(3) ?? '—',          color: '#fbbf24' },
    { label: 'PII REDACTIONS',        value: s?.pii_redactions?.toString() ?? '—',          color: '#fb923c' },
    { label: 'POLICY RULES ACTIVE',   value: (p?.rules_active ?? 10).toString(),            color: '#a78bfa' },
    { label: 'SECRET PATTERNS',       value: (p?.secret_patterns ?? 9).toString(),          color: '#ef4444' },
    { label: 'INJECTION PATTERNS',    value: (p?.injection_patterns ?? 21).toString(),      color: '#fbbf24' },
    { label: 'PII PATTERNS',          value: (p?.pii_patterns ?? 4).toString(),             color: '#f97316' },
    { label: 'AI PROVIDERS',          value: (data?.models?.providers?.length ?? 4).toString(), color: '#34d399' },
    { label: 'MODELS REGISTERED',     value: (data?.models?.registered ?? 11).toString(),  color: '#10b981' },
    { label: 'GOVERNANCE MODE',       value: 'DETERMINISTIC',                               color: '#818cf8' },
    { label: 'EDITION',               value: 'LITE — OSS',                                  color: '#6b7280' },
  ]

  const doubled = [...items, ...items]

  return (
    <div className="border-b border-white/[0.05] overflow-hidden"
      style={{ background: 'rgba(0,0,0,0.25)' }}>
      <div className="ticker-track">
        {doubled.map(({ label, value, color }, i) => (
          <div key={i} className="flex items-center gap-2 px-6 py-2.5 flex-shrink-0">
            <span className="text-[9px] font-semibold tracking-widest text-gray-600">{label}</span>
            <span className="text-[11px] font-bold font-mono" style={{ color }}>{value}</span>
            <div className="w-px h-3 mx-2 bg-white/[0.06] flex-shrink-0" />
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Live governance status panel ───────────────────────────────────────────────
function LiveStatusPanel({ data, loading }: { data: StatusData | null; loading: boolean }) {
  if (loading) {
    return (
      <div className="card p-5 h-full">
        <div className="flex items-center gap-2 mb-4">
          <div className="skeleton w-2 h-2 rounded-full" />
          <div className="skeleton h-3 w-24" />
        </div>
        <div className="space-y-2">
          {[90, 70, 80, 60].map((w, i) => (
            <div key={i} className="skeleton h-5" style={{ width: `${w}%` }} />
          ))}
        </div>
      </div>
    )
  }

  if (!data) return null

  const s = data.summary
  const stats = [
    { label: 'Requests / 24h',  value: s?.total_requests?.toLocaleString() ?? '—', color: '#3b82f6' },
    { label: 'Blocked',          value: s?.blocked?.toString() ?? '—',               color: '#ef4444' },
    { label: 'Avg risk score',   value: s?.avg_risk_score?.toFixed(3) ?? '—',        color: '#fbbf24' },
    { label: 'PII redactions',   value: s?.pii_redactions?.toString() ?? '—',        color: '#f97316' },
  ]

  return (
    <div className="card overflow-hidden h-full flex flex-col">
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/[0.05]">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-emerald-500 pulse-dot" />
          <span className="text-xs font-semibold text-gray-200">Live Governance Status</span>
          {data.demo_mode && (
            <span className="badge badge-info text-[9px]">DEMO</span>
          )}
        </div>
        <span className="text-[10px] text-emerald-500 font-medium">All operational</span>
      </div>

      <div className="grid grid-cols-2 gap-px flex-shrink-0" style={{ background: 'rgba(255,255,255,0.04)' }}>
        {stats.map(({ label, value, color }) => (
          <div key={label} className="px-5 py-4" style={{ background: 'var(--surface-2)' }}>
            <p className="stat-label mb-1.5">{label}</p>
            <p className="text-2xl font-bold tracking-tight" style={{ color }}>{value}</p>
          </div>
        ))}
      </div>

      <div className="px-5 py-3 border-t border-white/[0.05] space-y-2 flex-shrink-0">
        <p className="section-label mb-2">Components</p>
        {(data.components ?? []).slice(0, 5).map(c => (
          <div key={c.name} className="flex items-center justify-between">
            <span className="text-[10px] text-gray-500">{c.name}</span>
            <div className="flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              <span className="text-[10px] text-emerald-600">operational</span>
            </div>
          </div>
        ))}
      </div>

      {(data.recent_events?.length ?? 0) > 0 && (
        <div className="border-t border-white/[0.05] flex-1">
          <p className="section-label px-5 pt-3 pb-2">Recent events</p>
          {data.recent_events.slice(0, 5).map(e => {
            const style = DECISION_STYLE[e.decision] ?? DECISION_STYLE.allow
            return (
              <div key={e.id} className="px-5 py-2 flex items-center gap-2.5 border-b border-white/[0.03] last:border-0">
                <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: style.dot }} />
                <span className="text-[9px] px-1.5 py-0.5 rounded font-semibold flex-shrink-0"
                  style={{ background: style.bg, color: style.text }}>
                  {e.decision.toUpperCase()}
                </span>
                <span className="text-[10px] text-gray-600 flex-1 truncate">
                  {e.actor_email ?? 'user@example.com'}
                </span>
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

// ── Main ────────────────────────────────────────────────────────────────────────
export default function LandingPage() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const [status, setStatus]       = useState<StatusData | null>(null)
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

      {/* ── Nav ────────────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 border-b border-white/[0.05]"
        style={{ background: 'rgba(10,10,15,0.88)', backdropFilter: 'blur(20px)' }}>
        <div className="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="logo-mark">A</div>
            <span className="text-sm font-semibold text-white">Aegis Lite</span>
            <span className="badge badge-info">OSS</span>
            <div className="hidden md:block w-px h-4 bg-white/[0.07] mx-1" />
            <a href="https://aegis.jesseboudreau.com" target="_blank" rel="noopener noreferrer"
              className="ecosystem-badge hidden md:inline-flex">
              <div className="w-1.5 h-1.5 rounded-full bg-indigo-500/60" />
              <span>Part of Aegis AI</span>
              <svg className="w-3 h-3 opacity-40" fill="none" viewBox="0 0 12 12" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3.5 8.5l5-5M5 3.5h3.5V7" />
              </svg>
            </a>
          </div>

          <div className="flex items-center gap-5">
            <nav className="hidden md:flex items-center gap-5 text-xs text-gray-500">
              {[
                { label: 'Docs',     href: 'https://github.com/jesseboudreau80/aegis-lite/blob/main/docs/SETUP.md' },
                { label: 'Roadmap',  href: 'https://github.com/jesseboudreau80/aegis-lite/blob/main/docs/ROADMAP.md' },
                { label: 'Issues',   href: 'https://github.com/jesseboudreau80/aegis-lite/issues' },
              ].map(({ label, href }) => (
                <a key={label} href={href} target="_blank" rel="noopener noreferrer"
                  className="hover:text-gray-200 transition-colors">{label}</a>
              ))}
            </nav>
            <div className="hidden md:block w-px h-4 bg-white/[0.07]" />
            <a href="https://github.com/jesseboudreau80/aegis-lite" target="_blank" rel="noopener noreferrer"
              className="hidden sm:flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-200 transition-colors">
              <GitHubIcon />
              GitHub
            </a>
            <Link href="/login"
              className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white rounded-lg transition-all hover:opacity-90 hover:scale-[1.02]"
              style={{ background: 'linear-gradient(135deg, #3b82f6, #6366f1)' }}>
              Try workspace →
            </Link>
          </div>
        </div>
      </header>

      {/* ── Live metrics ticker ─────────────────────────────────────────────── */}
      <MetricsTicker data={status} />

      {/* ── Hero ───────────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden grid-bg" style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
        {/* Ambient glow */}
        <div className="glow-orb w-[700px] h-[400px] top-[-120px] left-1/2 -translate-x-1/2"
          style={{ background: 'rgba(99,102,241,0.12)' }} />
        <div className="glow-orb w-[300px] h-[300px] top-32 right-[10%]"
          style={{ background: 'rgba(59,130,246,0.07)' }} />

        <div className="relative z-10 max-w-7xl mx-auto px-6 pt-20 pb-24">
          <div className="grid lg:grid-cols-[1fr_420px] gap-16 items-center">

            {/* Left — text */}
            <div>
              {/* Ecosystem anchor */}
              <a href="https://aegis.jesseboudreau.com" target="_blank" rel="noopener noreferrer"
                className="fade-up inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs mb-5 border transition-colors hover:border-indigo-500/30"
                style={{ background: 'rgba(99,102,241,0.07)', borderColor: 'rgba(99,102,241,0.2)', color: '#818cf8' }}>
                <div className="w-1.5 h-1.5 rounded-full bg-indigo-400 pulse-dot" />
                Open-source developer edition of Aegis AI
                <svg className="w-3 h-3 opacity-60" fill="none" viewBox="0 0 12 12" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3.5 8.5l5-5M5 3.5h3.5V7" />
                </svg>
              </a>

              <h1 className="fade-up-delay-1 font-bold leading-[1.04] tracking-tight mb-5">
                <span className="gradient-blue block" style={{ fontSize: 'clamp(3rem, 5.5vw, 4.5rem)' }}>
                  AI governance
                </span>
                <span className="text-gray-200 block" style={{ fontSize: 'clamp(2.5rem, 4.5vw, 3.8rem)' }}>
                  that runs before
                </span>
                <span className="text-gray-200 block" style={{ fontSize: 'clamp(2.5rem, 4.5vw, 3.8rem)' }}>
                  the model does.
                </span>
              </h1>

              <p className="fade-up-delay-2 text-gray-400 text-lg leading-relaxed mb-8 max-w-lg">
                A deterministic policy engine evaluates every AI request through
                10 ordered rule checks — secrets, PII, injection, classification —
                before a single token reaches any provider. Fully auditable. Self-hostable.
              </p>

              <div className="fade-up-delay-3 flex items-center gap-3 flex-wrap mb-10">
                <a href="https://github.com/jesseboudreau80/aegis-lite"
                  target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-2 px-6 py-2.5 text-sm font-semibold text-white rounded-xl transition-all hover:scale-[1.02] hover:opacity-90"
                  style={{ background: 'linear-gradient(135deg, #3b82f6, #6366f1)', boxShadow: '0 4px 24px rgba(99,102,241,0.28)' }}>
                  <GitHubIcon />
                  Star on GitHub
                </a>
                <Link href="/login"
                  className="flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-gray-300 rounded-xl border transition-all hover:text-white hover:border-white/20"
                  style={{ borderColor: 'rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.04)' }}>
                  Try the demo →
                </Link>
              </div>

              {/* Trust badges */}
              <div className="fade-up-delay-4 flex flex-wrap items-center gap-x-5 gap-y-2">
                {[
                  { label: 'Apache 2.0', dot: '#10b981' },
                  { label: 'FastAPI + Next.js 15', dot: '#3b82f6' },
                  { label: 'Docker ready', dot: '#6366f1' },
                  { label: 'SQLite → PostgreSQL', dot: '#f97316' },
                ].map(({ label, dot }) => (
                  <div key={label} className="flex items-center gap-1.5">
                    <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: dot }} />
                    <span className="text-[11px] text-gray-600">{label}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Right — PolicyTrace */}
            <div className="fade-up-delay-2 hidden lg:block">
              <PolicyTrace />
            </div>
          </div>
        </div>
      </section>

      {/* ── Live engine + status ────────────────────────────────────────────── */}
      <section className="py-20" style={{ background: 'var(--surface-1)' }}>
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-12">
            <p className="section-label mb-3">Live system</p>
            <h2 className="text-3xl font-bold text-white mb-3">
              The governance engine, running now.
            </h2>
            <p className="text-gray-500 text-sm max-w-xl mx-auto">
              Every metric below is pulled live from the demo deployment at
              {' '}<span className="text-gray-400 font-mono text-xs">aegis-lite.jesseboudreau.com</span>.
              No mocked data — a real policy engine, real audit log, real routing decisions.
            </p>
          </div>
          <div className="grid lg:grid-cols-[1fr_380px] gap-6 items-start">
            <LiveStatusPanel data={status} loading={statusLoading} />
            <div>
              <p className="section-label mb-3">Policy chain</p>
              <PolicyTrace />
              <div className="mt-4 p-4 rounded-xl border space-y-2"
                style={{ background: 'rgba(99,102,241,0.04)', borderColor: 'rgba(99,102,241,0.12)' }}>
                {[
                  { label: 'Engine type', value: 'Deterministic — zero LLM calls' },
                  { label: 'Policy version', value: status?.policy?.version ?? '1.1.0' },
                  { label: 'Rules active', value: (status?.policy?.rules_active ?? 10).toString() },
                  { label: 'Governance mode', value: 'Phase 1 — stateless' },
                ].map(({ label, value }) => (
                  <div key={label} className="flex items-center justify-between">
                    <span className="text-[10px] text-gray-600">{label}</span>
                    <span className="text-[10px] font-mono text-gray-400">{value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="section-sep" />

      {/* ── AI Provider ecosystem ───────────────────────────────────────────── */}
      <section className="py-20" style={{ background: 'var(--surface-1)' }}>
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-10">
            <div>
              <p className="section-label mb-2">AI providers</p>
              <h2 className="text-2xl font-bold text-white">4 providers. Every request governed.</h2>
              <p className="text-gray-500 text-sm mt-2 max-w-lg">
                Budget-aware routing selects the right provider based on cost thresholds, data
                classification level, and role permissions — all policy-enforced before dispatch.
              </p>
            </div>
            <a href="https://github.com/jesseboudreau80/aegis-lite/issues/11"
              target="_blank" rel="noopener noreferrer"
              className="text-xs text-blue-400 hover:text-blue-300 flex-shrink-0">
              Add a provider →
            </a>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {PROVIDER_STATIC.map(provider => {
              const live = status?.models?.providers?.find(p => p.name === provider.name)
              return (
                <div key={provider.name} className="provider-card p-5 flex flex-col gap-3">
                  <div className="flex items-start justify-between">
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center font-bold text-sm"
                      style={{ background: provider.bg, color: provider.color, border: `1px solid ${provider.color}30` }}>
                      {provider.name[0]}
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                      {live?.latency_ms && (
                        <span className="text-[9px] text-gray-600 font-mono">{live.latency_ms}ms</span>
                      )}
                    </div>
                  </div>

                  <div>
                    <h3 className="text-sm font-semibold text-white">{provider.name}</h3>
                    <p className="text-[10px] mt-0.5" style={{ color: provider.color }}>{provider.tier}</p>
                  </div>

                  <p className="text-[11px] text-gray-500 leading-relaxed flex-1">{provider.desc}</p>

                  <div className="flex flex-wrap gap-1 pt-1">
                    {provider.models.map(m => (
                      <span key={m} className="text-[9px] px-1.5 py-0.5 rounded"
                        style={{ background: `${provider.color}10`, color: provider.color, border: `1px solid ${provider.color}20` }}>
                        {m}
                      </span>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      <div className="section-sep" />

      {/* ── Feature grid ────────────────────────────────────────────────────── */}
      <section className="py-20" style={{ background: 'var(--surface-1)' }}>
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-12">
            <p className="section-label mb-3">What it does</p>
            <h2 className="text-3xl font-bold text-white mb-3">Governance at every layer</h2>
            <p className="text-gray-500 text-sm max-w-md mx-auto">
              10 deterministic rules. 0 LLM calls inside the engine.
              Every decision traceable to a specific rule and risk score.
            </p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {FEATURES.map(({ title, desc, color }, i) => (
              <div key={title}
                className={`feature-card p-5 fade-up-delay-${(i % 4) + 1}`}
                style={{ ['--accent' as string]: color }}>
                <style>{`.feature-card:nth-child(${i + 1})::before { background: ${color}; }`}</style>
                <div className="w-7 h-7 rounded-lg flex items-center justify-center mb-4"
                  style={{ background: `${color}15`, border: `1px solid ${color}30` }}>
                  <div className="w-2 h-2 rounded-full" style={{ background: color }} />
                </div>
                <h3 className="text-sm font-semibold text-white mb-1.5">{title}</h3>
                <p className="text-[11px] text-gray-500 leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="section-sep" />

      {/* ── Architecture ─────────────────────────────────────────────────────── */}
      <section className="py-20" style={{ background: 'var(--surface-1)' }}>
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div>
              <p className="section-label mb-3">Architecture</p>
              <h2 className="text-3xl font-bold text-white mb-4">
                Every request flows through the engine.
              </h2>
              <p className="text-gray-400 leading-relaxed mb-6">
                The policy engine is stateless and synchronous — it runs
                before the AI router dispatches to any provider.
                No LLM calls inside the engine. No async side effects.
                A deterministic chain of rules that produces a
                {' '}<span className="text-gray-200 font-mono text-sm">PolicyDecision</span> object
                with a full rule trace on every request.
              </p>
              <div className="space-y-3">
                {[
                  { label: 'allow',    desc: 'Pass through to provider as-is.',                        color: '#10b981' },
                  { label: 'modify',   desc: 'Dispatch with PII-redacted prompt.',                      color: '#3b82f6' },
                  { label: 'warn',     desc: 'Dispatch + flag in governance log for review.',           color: '#f59e0b' },
                  { label: 'escalate', desc: 'Dispatch + notify — human review triggered.',             color: '#f97316' },
                  { label: 'block',    desc: 'HTTP 403. GovernanceEvent logged. Request never leaves.', color: '#ef4444' },
                ].map(({ label, desc, color }) => (
                  <div key={label} className="flex items-start gap-3">
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded font-mono mt-0.5 flex-shrink-0"
                      style={{ background: `${color}12`, color, border: `1px solid ${color}25` }}>
                      {label}
                    </span>
                    <span className="text-[12px] text-gray-500">{desc}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="card p-5 flex flex-col gap-3" style={{ fontFamily: 'var(--font-geist-mono)' }}>
              {/* Frontend */}
              <div className="rounded-xl border p-3.5"
                style={{ background: 'rgba(59,130,246,0.05)', borderColor: 'rgba(59,130,246,0.14)' }}>
                <p className="text-[9px] text-blue-400 uppercase tracking-wider font-semibold mb-2">Next.js 15 Frontend</p>
                <div className="flex gap-1.5 flex-wrap">
                  {['Chat', 'Agents', 'Research', 'Governance', 'Audit', 'Dashboard'].map(p => (
                    <span key={p} className="text-[9px] px-2 py-0.5 rounded"
                      style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)', color: '#6b7280' }}>
                      {p}
                    </span>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-2 px-2">
                <div className="flex-1 border-t border-dashed border-white/[0.07]" />
                <span className="text-[8px] text-gray-700">JWT auth · /api proxy</span>
                <div className="flex-1 border-t border-dashed border-white/[0.07]" />
              </div>

              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: 'Policy Engine', color: '#8b5cf6', items: ['10 ordered rules', 'Risk scoring 0–1.0', 'Rule trace log'] },
                  { label: 'AI Router',     color: '#10b981', items: ['Budget-aware routing', 'Provider fallback', 'Cost tracking'] },
                ].map(({ label, color, items }) => (
                  <div key={label} className="rounded-xl border p-3"
                    style={{ background: `${color}07`, borderColor: `${color}20` }}>
                    <p className="text-[8px] font-semibold uppercase tracking-wider mb-2" style={{ color }}>{label}</p>
                    {items.map(t => (
                      <p key={t} className="text-[8px] text-gray-600 flex items-center gap-1">
                        <span style={{ color: '#10b981' }}>›</span> {t}
                      </p>
                    ))}
                  </div>
                ))}
              </div>

              <div className="flex items-center gap-2 px-2">
                <div className="flex-1 border-t border-dashed border-white/[0.07]" />
                <span className="text-[8px] text-gray-700">provider dispatch</span>
                <div className="flex-1 border-t border-dashed border-white/[0.07]" />
              </div>

              <div className="grid grid-cols-4 gap-1.5">
                {[
                  { name: 'Anthropic', color: '#d97706' },
                  { name: 'OpenAI',    color: '#10b981' },
                  { name: 'OpenRtr.',  color: '#6366f1' },
                  { name: 'Perplexity',color: '#3b82f6' },
                ].map(({ name, color }) => (
                  <div key={name} className="rounded-lg p-2 text-center"
                    style={{ background: `${color}0d`, border: `1px solid ${color}22` }}>
                    <p className="text-[8px] font-semibold" style={{ color }}>{name}</p>
                  </div>
                ))}
              </div>

              <div className="flex items-center gap-2 px-2">
                <div className="flex-1 border-t border-dashed border-white/[0.07]" />
                <span className="text-[8px] text-gray-700">audit + governance log</span>
                <div className="flex-1 border-t border-dashed border-white/[0.07]" />
              </div>

              <div className="rounded-xl border p-3"
                style={{ background: 'rgba(251,191,36,0.04)', borderColor: 'rgba(251,191,36,0.12)' }}>
                <p className="text-[8px] text-yellow-500 uppercase tracking-wider font-semibold mb-1.5">Persistence</p>
                <p className="text-[8px] text-gray-600">AuditLog · GovernanceEvent · Users · Agents</p>
                <p className="text-[8px] text-gray-700 mt-0.5">SQLite (dev) · PostgreSQL (prod)</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="section-sep" />

      {/* ── Roadmap ──────────────────────────────────────────────────────────── */}
      <section className="py-20" style={{ background: 'var(--surface-1)' }}>
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-10">
            <div>
              <p className="section-label mb-2">Roadmap</p>
              <h2 className="text-2xl font-bold text-white">Built in public.</h2>
              <p className="text-gray-500 text-sm mt-2">
                Every milestone tracked openly. Contribute to any phase.
              </p>
            </div>
            <a href="https://github.com/jesseboudreau80/aegis-lite/blob/main/docs/ROADMAP.md"
              target="_blank" rel="noopener noreferrer"
              className="text-xs text-blue-400 hover:text-blue-300 flex-shrink-0">
              Full roadmap →
            </a>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {ROADMAP.map(({ version, statusKey, label, title, items }) => (
              <div key={version}
                className={`card p-5 flex flex-col gap-3 ${
                  statusKey === 'released' ? 'roadmap-released' :
                  statusKey === 'planned'  ? 'roadmap-planned'  : 'roadmap-future'
                }`}>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold font-mono"
                    style={{ color: statusKey === 'released' ? '#10b981' : statusKey === 'planned' ? '#60a5fa' : '#6b7280' }}>
                    {version}
                  </span>
                  <span className="text-[9px] px-2 py-0.5 rounded-full font-semibold"
                    style={{
                      background: statusKey === 'released' ? 'rgba(16,185,129,0.12)' : statusKey === 'planned' ? 'rgba(59,130,246,0.1)' : 'rgba(255,255,255,0.05)',
                      color: statusKey === 'released' ? '#34d399' : statusKey === 'planned' ? '#60a5fa' : '#6b7280',
                      border: `1px solid ${statusKey === 'released' ? 'rgba(16,185,129,0.25)' : statusKey === 'planned' ? 'rgba(59,130,246,0.2)' : 'rgba(255,255,255,0.08)'}`,
                    }}>
                    {label}
                  </span>
                </div>
                <h3 className="text-sm font-semibold text-white">{title}</h3>
                <ul className="space-y-1.5 flex-1">
                  {items.map(item => (
                    <li key={item} className="flex items-start gap-1.5">
                      <span className="text-[10px] mt-0.5 flex-shrink-0"
                        style={{ color: statusKey === 'released' ? '#10b981' : '#374151' }}>
                        {statusKey === 'released' ? '✓' : '·'}
                      </span>
                      <span className="text-[10px] text-gray-500">{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="section-sep" />

      {/* ── Contribute ───────────────────────────────────────────────────────── */}
      <section className="py-20" style={{ background: 'var(--surface-1)' }}>
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-10">
            <p className="section-label mb-3">Open source</p>
            <h2 className="text-2xl font-bold text-white mb-2">AI governance is a shared problem.</h2>
            <p className="text-gray-500 text-sm max-w-lg mx-auto">
              Enterprise governance patterns shouldn&apos;t be locked behind paywalls.
              Aegis Lite exists to give every team access to the same governance infrastructure.
            </p>
          </div>

          <div className="grid lg:grid-cols-2 gap-5">
            {/* Good first issues */}
            <div className="card p-5">
              <div className="flex items-center justify-between mb-5">
                <div>
                  <h3 className="text-sm font-semibold text-white">Good first issues</h3>
                  <p className="text-[11px] text-gray-500 mt-0.5">Well-scoped entry points for new contributors</p>
                </div>
                <a href="https://github.com/jesseboudreau80/aegis-lite/labels/good-first-issue"
                  target="_blank" rel="noopener noreferrer"
                  className="text-[10px] text-blue-400 hover:text-blue-300">View all →</a>
              </div>
              <div className="space-y-1">
                {GOOD_FIRST_ISSUES.map(({ n, title, label, color }) => (
                  <a key={n}
                    href={`https://github.com/jesseboudreau80/aegis-lite/issues/${n}`}
                    target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-white/[0.03] group transition-colors">
                    <span className="text-[10px] font-mono text-gray-700 w-5 flex-shrink-0">#{n}</span>
                    <span className="text-[11px] text-gray-400 group-hover:text-gray-200 flex-1 truncate transition-colors">{title}</span>
                    <span className="text-[9px] px-1.5 py-0.5 rounded flex-shrink-0"
                      style={{ color, background: `${color}12`, border: `1px solid ${color}25` }}>
                      {label}
                    </span>
                  </a>
                ))}
              </div>
            </div>

            {/* Contribute CTA */}
            <div className="card p-6 flex flex-col"
              style={{ background: 'linear-gradient(135deg, rgba(59,130,246,0.05), rgba(99,102,241,0.05))' }}>
              <h3 className="text-sm font-semibold text-white mb-2">Start contributing</h3>
              <p className="text-[11px] text-gray-500 leading-relaxed mb-6">
                The policy engine, audit log, and routing layer are better with
                more implementations. New detection rules, provider integrations,
                deployment guides, and dashboard improvements are all high-value.
              </p>

              <div className="grid grid-cols-2 gap-2 mb-6">
                {[
                  { area: 'Policy rules',      desc: 'PII patterns, injection variants', href: 'https://github.com/jesseboudreau80/aegis-lite/blob/main/backend/config/policy_config.py' },
                  { area: 'Tests',             desc: 'Backend test suite (issue #1)',     href: 'https://github.com/jesseboudreau80/aegis-lite/issues/1' },
                  { area: 'Providers',         desc: 'New AI provider adapters',          href: 'https://github.com/jesseboudreau80/aegis-lite/issues/11' },
                  { area: 'Deploy guides',     desc: 'Railway, Fly.io, Render',           href: 'https://github.com/jesseboudreau80/aegis-lite/issues/5' },
                ].map(({ area, desc, href }) => (
                  <a key={area} href={href} target="_blank" rel="noopener noreferrer"
                    className="p-3 rounded-xl border border-white/[0.05] hover:border-white/[0.1] transition-colors group">
                    <p className="text-[11px] font-semibold text-gray-300 group-hover:text-white transition-colors">{area}</p>
                    <p className="text-[10px] text-gray-600 mt-0.5">{desc}</p>
                  </a>
                ))}
              </div>

              <div className="flex gap-2.5 flex-wrap mt-auto">
                <a href="https://github.com/jesseboudreau80/aegis-lite"
                  target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white rounded-lg hover:opacity-90"
                  style={{ background: 'linear-gradient(135deg, #3b82f6, #6366f1)' }}>
                  <GitHubIcon className="w-3.5 h-3.5" />
                  Star on GitHub
                </a>
                <a href="https://github.com/jesseboudreau80/aegis-lite/blob/main/CONTRIBUTING.md"
                  target="_blank" rel="noopener noreferrer"
                  className="flex items-center px-4 py-2 text-xs text-gray-400 hover:text-gray-200 border border-white/[0.08] rounded-lg hover:border-white/[0.14] transition-all">
                  CONTRIBUTING.md →
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="section-sep" />

      {/* ── Quickstart ───────────────────────────────────────────────────────── */}
      <section className="py-20" style={{ background: 'var(--surface-1)' }}>
        <div className="max-w-3xl mx-auto px-6">
          <div className="text-center mb-8">
            <p className="section-label mb-3">Self-host</p>
            <h2 className="text-2xl font-bold text-white mb-2">Running in 60 seconds.</h2>
            <p className="text-gray-500 text-sm">
              Docker Compose. SQLite by default. No API keys required to start — demo mode covers everything.
            </p>
          </div>

          <div className="terminal mb-8">
            <div className="terminal-bar">
              {['#ef4444', '#fbbf24', '#22c55e'].map(c => (
                <div key={c} className="terminal-dot" style={{ background: c, opacity: 0.7 }} />
              ))}
              <span className="text-[10px] text-gray-700 ml-2 font-mono">bash</span>
            </div>
            <div className="terminal-body">
              {[
                ['git',    ' clone https://github.com/jesseboudreau80/aegis-lite'],
                ['cd',     ' aegis-lite'],
                ['cp',     ' .env.example .env          # set SECRET_KEY'],
                ['docker', ' compose up'],
              ].map(([cmd, rest]) => (
                <div key={cmd + rest}>
                  <span className="text-gray-700 select-none">$ </span>
                  <span className="text-emerald-400">{cmd}</span>
                  <span className="text-gray-400">{rest}</span>
                </div>
              ))}
              <div className="mt-3 text-gray-700">
                # Opens at <span className="text-blue-400">http://localhost:3000</span>
              </div>
              <div className="text-gray-700">
                # Governance workspace ready. No API keys needed.
              </div>
            </div>
          </div>

          <div className="flex items-center justify-center gap-4 flex-wrap">
            <Link href="/login"
              className="px-6 py-2.5 text-sm font-semibold text-white rounded-xl hover:opacity-90 transition-all"
              style={{ background: 'linear-gradient(135deg, #3b82f6, #6366f1)' }}>
              Try the demo workspace →
            </Link>
            <a href="https://github.com/jesseboudreau80/aegis-lite/blob/main/docs/SETUP.md"
              target="_blank" rel="noopener noreferrer"
              className="text-sm text-gray-500 hover:text-gray-300 transition-colors">
              Setup guide →
            </a>
          </div>
        </div>
      </section>

      {/* ── Footer ───────────────────────────────────────────────────────────── */}
      <footer className="border-t border-white/[0.05]" style={{ background: 'rgba(6,6,12,0.8)' }}>
        <div className="max-w-7xl mx-auto px-6 py-10">
          <div className="grid sm:grid-cols-3 gap-8 mb-8">

            {/* Brand */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <div className="logo-mark">A</div>
                <span className="text-sm font-semibold text-white">Aegis Lite</span>
                <span className="badge badge-info">OSS</span>
              </div>
              <p className="text-[11px] text-gray-600 leading-relaxed mb-4 max-w-[200px]">
                Open-source AI governance workspace.
                Policy enforcement, audit logging,
                and model routing for every team.
              </p>
              <div className="flex items-center gap-2 text-[10px] text-gray-700">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
                Apache License 2.0
              </div>
            </div>

            {/* Project links */}
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-600 mb-3">Project</p>
              <div className="space-y-2">
                {[
                  { label: 'GitHub',          href: 'https://github.com/jesseboudreau80/aegis-lite' },
                  { label: 'Documentation',   href: 'https://github.com/jesseboudreau80/aegis-lite/blob/main/docs/SETUP.md' },
                  { label: 'Roadmap',         href: 'https://github.com/jesseboudreau80/aegis-lite/blob/main/docs/ROADMAP.md' },
                  { label: 'Contributing',    href: 'https://github.com/jesseboudreau80/aegis-lite/blob/main/CONTRIBUTING.md' },
                  { label: 'Security Policy', href: 'https://github.com/jesseboudreau80/aegis-lite/blob/main/SECURITY.md' },
                  { label: 'Open Issues',     href: 'https://github.com/jesseboudreau80/aegis-lite/issues' },
                ].map(({ label, href }) => (
                  <a key={label} href={href} target="_blank" rel="noopener noreferrer"
                    className="block text-[11px] text-gray-600 hover:text-gray-300 transition-colors">
                    {label}
                  </a>
                ))}
              </div>
            </div>

            {/* Ecosystem */}
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-600 mb-3">Ecosystem</p>
              <div className="space-y-2">
                {[
                  { label: 'Aegis AI — Enterprise',    href: 'https://aegis.jesseboudreau.com', note: 'Full platform' },
                  { label: 'jesseboudreau.com',        href: 'https://jesseboudreau.com',       note: 'Portfolio' },
                  { label: 'GitHub Profile',           href: 'https://github.com/jesseboudreau80', note: '' },
                ].map(({ label, href, note }) => (
                  <a key={label} href={href} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-2 text-[11px] text-gray-600 hover:text-gray-300 transition-colors group">
                    <span>{label}</span>
                    {note && <span className="text-[9px] text-gray-700 group-hover:text-gray-600 transition-colors">{note}</span>}
                    <svg className="w-3 h-3 opacity-30 group-hover:opacity-60 transition-opacity" fill="none" viewBox="0 0 12 12" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3.5 8.5l5-5M5 3.5h3.5V7" />
                    </svg>
                  </a>
                ))}
              </div>
              <div className="mt-5 pt-4 border-t border-white/[0.05]">
                <p className="text-[10px] text-gray-700">
                  Aegis Lite is the open-source developer edition
                  of the{' '}
                  <a href="https://aegis.jesseboudreau.com" target="_blank" rel="noopener noreferrer"
                    className="text-indigo-600 hover:text-indigo-400 transition-colors">
                    Aegis AI
                  </a>
                  {' '}governance platform.
                </p>
              </div>
            </div>
          </div>

          <div className="border-t border-white/[0.04] pt-6 flex flex-col sm:flex-row items-center justify-between gap-3">
            <p className="text-[10px] text-gray-700">
              Built by{' '}
              <a href="https://jesseboudreau.com" target="_blank" rel="noopener noreferrer"
                className="text-gray-500 hover:text-gray-300 transition-colors">
                Jesse Boudreau
              </a>
              {' '}· Apache License 2.0
            </p>
            <div className="flex items-center gap-4">
              <a href="https://github.com/jesseboudreau80/aegis-lite" target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-[10px] text-gray-700 hover:text-gray-400 transition-colors">
                <GitHubIcon className="w-3.5 h-3.5" />
                jesseboudreau80/aegis-lite
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
