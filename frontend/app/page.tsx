'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'
import Link from 'next/link'
import axios from 'axios'

// ── Types ──────────────────────────────────────────────────────────────────────
type StatusData = {
  status: string
  demo_mode: boolean
  policy: { version: string; rules_active: number }
  summary: { total_requests: number; blocked: number; avg_risk_score: number }
}

// ── Mock governance events ─────────────────────────────────────────────────────
const MOCK_EVENTS = [
  { id: 1,  decision: 'ALLOW',    model: 'claude-sonnet-4',   actor: 'analyst@example.com',    risk: 0.04, age: '2s',      flags: [] },
  { id: 2,  decision: 'WARN',     model: 'gpt-4o',            actor: 'dev@example.com',        risk: 0.31, age: '8s',      flags: ['pii_detected'] },
  { id: 3,  decision: 'BLOCK',    model: 'claude-sonnet-4',   actor: 'service@example.com',    risk: 0.92, age: '12s',     flags: ['secret_credential'] },
  { id: 4,  decision: 'ALLOW',    model: 'mistral-7b',        actor: 'pipeline@example.com',   risk: 0.02, age: '19s',     flags: [] },
  { id: 5,  decision: 'ESCALATE', model: 'gpt-4o',            actor: 'researcher@example.com', risk: 0.68, age: '31s',     flags: ['injection_attempt'] },
  { id: 6,  decision: 'MODIFY',   model: 'claude-opus-4',     actor: 'admin@example.com',      risk: 0.22, age: '45s',     flags: ['pii_redacted'] },
  { id: 7,  decision: 'ALLOW',    model: 'llama-3.1-8b',      actor: 'worker@example.com',     risk: 0.01, age: '1m 2s',   flags: [] },
  { id: 8,  decision: 'WARN',     model: 'claude-sonnet-4',   actor: 'user@example.com',       risk: 0.28, age: '1m 18s',  flags: ['sensitive_keyword'] },
  { id: 9,  decision: 'ALLOW',    model: 'gemini-flash',      actor: 'agent@example.com',      risk: 0.06, age: '1m 44s',  flags: [] },
  { id: 10, decision: 'BLOCK',    model: 'gpt-4o',            actor: 'external@example.com',   risk: 0.88, age: '2m 11s',  flags: ['secret_credential', 'injection_attempt'] },
]

const DECISION_STYLE: Record<string, { pill: string; dot: string }> = {
  ALLOW:    { pill: 'text-emerald-400 bg-emerald-400/10 border border-emerald-400/20', dot: 'bg-emerald-400' },
  WARN:     { pill: 'text-amber-400 bg-amber-400/10 border border-amber-400/20',       dot: 'bg-amber-400' },
  MODIFY:   { pill: 'text-blue-400 bg-blue-400/10 border border-blue-400/20',          dot: 'bg-blue-400' },
  ESCALATE: { pill: 'text-orange-400 bg-orange-400/10 border border-orange-400/20',    dot: 'bg-orange-400' },
  BLOCK:    { pill: 'text-red-400 bg-red-400/10 border border-red-400/20',             dot: 'bg-red-400' },
}

const FLAG_STYLE: Record<string, string> = {
  pii_detected:       'text-orange-400 bg-orange-400/8 border border-orange-400/15',
  secret_credential:  'text-red-400 bg-red-400/8 border border-red-400/15',
  injection_attempt:  'text-amber-400 bg-amber-400/8 border border-amber-400/15',
  pii_redacted:       'text-blue-400 bg-blue-400/8 border border-blue-400/15',
  sensitive_keyword:  'text-yellow-400 bg-yellow-400/8 border border-yellow-400/15',
}

// ── Rule chain ─────────────────────────────────────────────────────────────────
const RULE_CHAIN = [
  { step: 1,  name: '_check_secrets',            action: 'BLOCK',    color: '#ef4444' },
  { step: 2,  name: '_check_model_access',        action: 'CONTROL',  color: '#8b5cf6' },
  { step: 3,  name: '_check_agent_permissions',   action: 'ENFORCE',  color: '#8b5cf6' },
  { step: 4,  name: '_check_data_classification', action: 'CLASSIFY', color: '#3b82f6' },
  { step: 5,  name: '_check_pii',                 action: 'REDACT',   color: '#f97316' },
  { step: 6,  name: '_check_prompt_injection',    action: 'ESCALATE', color: '#f59e0b' },
  { step: 7,  name: '_check_sensitive_keywords',  action: 'WARN',     color: '#f59e0b' },
  { step: 8,  name: '_check_research_outbound',   action: 'RESTRICT', color: '#06b6d4' },
  { step: 9,  name: '_check_tool_grants',         action: 'GATE',     color: '#10b981' },
  { step: 10, name: '_apply_risk_controls',       action: 'ALLOW',    color: '#10b981' },
]

// ── Good first issues ──────────────────────────────────────────────────────────
const GOOD_FIRST_ISSUES = [
  { n: 1,  title: 'Write policy engine unit tests',       label: 'testing' },
  { n: 2,  title: 'Add IBAN detection to PII rules',      label: 'policy' },
  { n: 5,  title: 'Write Railway / Fly.io deploy guides', label: 'docs' },
  { n: 7,  title: 'Improve mobile nav responsiveness',    label: 'frontend' },
  { n: 11, title: 'Expand OpenRouter model support',      label: 'providers' },
  { n: 15, title: 'Docker Compose dev / prod profiles',   label: 'deployment' },
]

// ── Icons ──────────────────────────────────────────────────────────────────────
function GithubIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd" />
    </svg>
  )
}

function ExternalIcon({ className = 'w-3 h-3' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 12 12" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3.5 8.5l5-5M5 3.5h3.5V7" />
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
    }, 360)
    return () => clearInterval(t)
  }, [])

  return (
    <div className="rounded-xl overflow-hidden border border-white/[0.07]"
      style={{ background: '#06060f', fontFamily: 'var(--font-geist-mono)' }}>
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-white/[0.05]">
        <div className="flex gap-1.5">
          {['#ef4444','#f59e0b','#22c55e'].map(c => (
            <div key={c} className="w-2.5 h-2.5 rounded-full" style={{ background: c, opacity: 0.55 }} />
          ))}
        </div>
        <span className="text-[10px] text-gray-700 ml-1 truncate">policy_engine.evaluate_request(ctx)</span>
        <div className="ml-auto flex items-center gap-1.5 flex-shrink-0">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 pulse-dot" />
          <span className="text-[10px] text-emerald-600 font-semibold">LIVE</span>
        </div>
      </div>
      <div className="p-2.5 space-y-0.5">
        {RULE_CHAIN.map((rule, i) => {
          const isDone    = done.includes(i)
          const isActive  = active === i
          const isPending = !isDone && !isActive
          return (
            <div key={rule.step}
              className="flex items-center justify-between px-3 py-1.5 rounded-lg transition-all duration-200"
              style={{
                background: isActive ? 'rgba(255,255,255,0.045)' : 'transparent',
                opacity: isPending ? 0.22 : 1,
              }}>
              <div className="flex items-center gap-2.5">
                <div className="w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0"
                  style={{
                    background: isDone ? 'rgba(52,211,153,0.15)' : isActive ? `${rule.color}18` : 'rgba(255,255,255,0.03)',
                    border: `1px solid ${isDone ? '#34d399' : isActive ? rule.color : 'rgba(255,255,255,0.05)'}`,
                  }}>
                  <span style={{ fontSize: 8, color: isDone ? '#34d399' : isActive ? rule.color : 'rgba(255,255,255,0.2)' }}>
                    {isDone ? '✓' : rule.step}
                  </span>
                </div>
                <span className="text-[10px]"
                  style={{ color: isDone ? '#374151' : isActive ? '#d1d5db' : '#1f2937' }}>
                  {rule.name}
                </span>
              </div>
              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded"
                style={{
                  color: isDone || isActive ? rule.color : 'rgba(255,255,255,0.08)',
                  background: isDone || isActive ? `${rule.color}12` : 'transparent',
                  border: `1px solid ${isDone || isActive ? `${rule.color}25` : 'transparent'}`,
                }}>
                {rule.action}
              </span>
            </div>
          )
        })}
      </div>
      <div className="px-4 py-2 border-t border-white/[0.05] flex items-center justify-between">
        <span className="text-[9px] text-gray-700 font-mono">
          risk_score: <span className="text-gray-500">0.{String(active * 8 + 4).padStart(2, '0')}</span>
        </span>
        <span className="text-[9px] text-gray-700 font-mono">v1.1.0</span>
      </div>
    </div>
  )
}

// ── Governance events visualization ───────────────────────────────────────────
function GovernanceEvents() {
  return (
    <div className="card overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/[0.06]">
        <div className="flex items-center gap-2.5">
          <div className="w-2 h-2 rounded-full bg-emerald-400 pulse-dot" />
          <span className="text-xs font-semibold text-gray-200">Governance Event Stream</span>
          <span className="badge badge-info text-[9px]">DEMO</span>
        </div>
        <span className="text-[10px] text-gray-600" style={{ fontFamily: 'var(--font-geist-mono)' }}>
          policy_engine v1.1.0 · 10 rules active
        </span>
      </div>

      {/* Column headers */}
      <div
        className="hidden md:grid px-5 py-2 border-b border-white/[0.04]"
        style={{ gridTemplateColumns: '88px 1fr 1fr 56px 52px 1fr' }}>
        {['DECISION','MODEL','ACTOR','RISK','AGE','FLAGS'].map(h => (
          <span key={h} className="text-[9px] font-semibold uppercase tracking-widest text-gray-700">{h}</span>
        ))}
      </div>

      {/* Events */}
      <div>
        {MOCK_EVENTS.map((event) => {
          const ds = DECISION_STYLE[event.decision] ?? DECISION_STYLE.ALLOW
          return (
            <div key={event.id}
              className="border-b border-white/[0.035] last:border-0 hover:bg-white/[0.018] transition-colors">
              {/* Desktop row */}
              <div
                className="hidden md:grid items-center px-5 py-2.5"
                style={{ gridTemplateColumns: '88px 1fr 1fr 56px 52px 1fr' }}>
                <span className={`text-[9px] font-bold px-2 py-0.5 rounded inline-block w-fit ${ds.pill}`}>
                  {event.decision}
                </span>
                <span className="text-[11px] text-gray-400 truncate" style={{ fontFamily: 'var(--font-geist-mono)' }}>
                  {event.model}
                </span>
                <span className="text-[11px] text-gray-500 truncate">{event.actor}</span>
                <span className={`text-[11px] font-mono font-semibold ${event.risk >= 0.7 ? 'text-red-400' : event.risk >= 0.3 ? 'text-amber-400' : 'text-emerald-400'}`}>
                  {event.risk.toFixed(2)}
                </span>
                <span className="text-[10px] text-gray-600">{event.age}</span>
                <div className="flex gap-1 flex-wrap">
                  {event.flags.map(flag => (
                    <span key={flag} className={`text-[9px] px-1.5 py-0.5 rounded ${FLAG_STYLE[flag] ?? ''}`}>
                      {flag.replace(/_/g, ' ')}
                    </span>
                  ))}
                </div>
              </div>
              {/* Mobile row */}
              <div className="md:hidden flex items-center gap-3 px-4 py-3">
                <span className={`text-[9px] font-bold px-2 py-0.5 rounded flex-shrink-0 ${ds.pill}`}>
                  {event.decision}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] text-gray-400 truncate" style={{ fontFamily: 'var(--font-geist-mono)' }}>{event.model}</p>
                  <p className="text-[10px] text-gray-600 truncate">{event.actor}</p>
                </div>
                <span className={`text-[11px] font-mono font-bold flex-shrink-0 ${event.risk >= 0.7 ? 'text-red-400' : event.risk >= 0.3 ? 'text-amber-400' : 'text-emerald-400'}`}>
                  {event.risk.toFixed(2)}
                </span>
              </div>
            </div>
          )
        })}
      </div>

      {/* Footer */}
      <div className="px-5 py-3 border-t border-white/[0.05] flex items-center justify-between">
        <span className="text-[10px] text-gray-700">
          Showing demo events ·{' '}
          <a href="https://aegis-lite.jesseboudreau.com/api/status/demo-events"
            target="_blank" rel="noopener noreferrer"
            className="text-gray-500 hover:text-gray-300 transition-colors">
            view raw API →
          </a>
        </span>
        <Link href="/login"
          className="text-[10px] text-blue-400 hover:text-blue-300 transition-colors">
          Explore live workspace →
        </Link>
      </div>
    </div>
  )
}

// ── Early Access Modal ─────────────────────────────────────────────────────────
function EarlyAccessModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const overlayRef = useRef<HTMLDivElement>(null)
  const [email, setEmail]       = useState('')
  const [company, setCompany]   = useState('')
  const [status, setStatus]     = useState<'idle' | 'loading' | 'done' | 'error'>('idle')
  const [errMsg, setErrMsg]     = useState('')

  // Close on Escape
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [open, onClose])

  // Reset on re-open
  useEffect(() => {
    if (open) { setStatus('idle'); setErrMsg(''); setEmail(''); setCompany('') }
  }, [open])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setStatus('loading'); setErrMsg('')
    try {
      await axios.post('/api/early-access', { email: email.trim(), company: company.trim() })
      setStatus('done')
    } catch {
      setErrMsg('Something went wrong. Please try again.')
      setStatus('error')
    }
  }

  if (!open) return null

  return (
    <div ref={overlayRef} onClick={onClose}
      className="fixed inset-0 z-[60] flex items-center justify-center px-4"
      style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)' }}>
      <div onClick={e => e.stopPropagation()}
        className="w-full max-w-sm rounded-2xl border border-white/[0.09] p-7 relative"
        style={{ background: 'var(--surface-2)' }}>

        {/* Close */}
        <button onClick={onClose} aria-label="Close"
          className="absolute top-4 right-4 w-7 h-7 flex items-center justify-center rounded-lg text-gray-600 hover:text-gray-300 hover:bg-white/[0.07] transition-all">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {status === 'done' ? (
          <div className="text-center py-4">
            <div className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4 border"
              style={{ background: 'rgba(16,185,129,0.08)', borderColor: 'rgba(16,185,129,0.25)' }}>
              <svg className="w-5 h-5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <p className="text-sm font-semibold text-white mb-1">You&apos;re on the list.</p>
            <p className="text-xs text-gray-500 mb-5">
              We&apos;ll reach out when enterprise features land in Aegis Lite.
            </p>
            <button onClick={onClose}
              className="px-5 py-2 text-xs font-semibold text-white rounded-xl hover:opacity-90 transition-all"
              style={{ background: 'linear-gradient(135deg, #3b82f6, #6366f1)' }}>
              Done
            </button>
          </div>
        ) : (
          <>
            <div className="mb-5">
              <div className="logo-mark mx-auto mb-3" style={{ width: 28, height: 28, fontSize: 12 }}>A</div>
              <h2 className="text-base font-semibold text-white text-center">Join Early Access</h2>
              <p className="text-xs text-gray-500 text-center mt-1 leading-relaxed">
                Be the first to know when enterprise features —
                SOC 2 controls, multi-tenant isolation, approval workflows —
                come to Aegis Lite.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label className="block text-[11px] text-gray-500 mb-1.5">Work email</label>
                <input type="email" required value={email} onChange={e => setEmail(e.target.value)}
                  placeholder="you@company.com" className="input-base" />
              </div>
              <div>
                <label className="block text-[11px] text-gray-500 mb-1.5">
                  Company <span className="text-gray-700">(optional)</span>
                </label>
                <input type="text" value={company} onChange={e => setCompany(e.target.value)}
                  placeholder="Acme Corp" className="input-base" />
              </div>

              {errMsg && (
                <p className="text-[11px] text-red-400 px-1">{errMsg}</p>
              )}

              <button type="submit" disabled={status === 'loading'}
                className="w-full py-2.5 text-sm font-semibold text-white rounded-xl transition-all disabled:opacity-60 hover:opacity-90 cursor-pointer"
                style={{ background: 'linear-gradient(135deg, #3b82f6, #6366f1)' }}>
                {status === 'loading' ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Submitting…
                  </span>
                ) : 'Request early access →'}
              </button>
            </form>

            <p className="text-[10px] text-gray-700 text-center mt-4">
              No spam. Unsubscribe any time. View{' '}
              <Link href="/privacy"
                className="underline hover:text-gray-500 transition-colors">
                privacy policy
              </Link>.
            </p>
          </>
        )}
      </div>
    </div>
  )
}

// ── Main ────────────────────────────────────────────────────────────────────────
export default function LandingPage() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const [status, setStatus]           = useState<StatusData | null>(null)
  const [earlyAccessOpen, setEarlyAccessOpen] = useState(false)

  useEffect(() => {
    if (!loading && user) router.replace('/dashboard')
  }, [user, loading, router])

  useEffect(() => {
    axios.get('/api/status').then(r => setStatus(r.data)).catch(() => {})
  }, [])

  if (loading) return null

  return (
    <div className="min-h-screen text-gray-100" style={{ background: 'var(--surface-1)' }}>

      <EarlyAccessModal open={earlyAccessOpen} onClose={() => setEarlyAccessOpen(false)} />

      {/* ── Navbar ──────────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 border-b border-white/[0.06]"
        style={{ background: 'rgba(7,7,15,0.9)', backdropFilter: 'blur(20px)' }}>
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between gap-4">

          {/* Logo */}
          <div className="flex items-center gap-2.5 flex-shrink-0">
            <div className="logo-mark">A</div>
            <span className="text-sm font-semibold text-white tracking-tight">Aegis Lite</span>
            <span className="badge badge-info hidden sm:inline-flex">OSS</span>
          </div>

          {/* Nav links */}
          <nav className="hidden md:flex items-center gap-1">
            {[
              { label: 'Docs',    href: 'https://github.com/jesseboudreau80/aegis-lite/blob/main/docs/SETUP.md' },
              { label: 'Roadmap', href: 'https://github.com/jesseboudreau80/aegis-lite/blob/main/docs/ROADMAP.md' },
              { label: 'Issues',  href: 'https://github.com/jesseboudreau80/aegis-lite/issues' },
            ].map(({ label, href }) => (
              <a key={label} href={href} target="_blank" rel="noopener noreferrer"
                className="px-3 py-1.5 text-xs text-gray-500 hover:text-gray-200 rounded-lg hover:bg-white/[0.05] transition-all">
                {label}
              </a>
            ))}
          </nav>

          {/* Right side */}
          <div className="flex items-center gap-2.5">
            <a href="https://github.com/jesseboudreau80/aegis-lite"
              target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-gray-400 hover:text-gray-200 rounded-lg hover:bg-white/[0.05] transition-all">
              <GithubIcon className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">GitHub</span>
            </a>
            <button onClick={() => setEarlyAccessOpen(true)}
              className="hidden sm:flex items-center gap-1 px-3 py-1.5 text-xs text-gray-500 hover:text-gray-200 rounded-lg border border-white/[0.07] hover:border-white/[0.12] transition-all cursor-pointer">
              Early Access
            </button>
            <Link href="/login"
              className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white rounded-lg transition-all hover:opacity-90 hover:scale-[1.02]"
              style={{ background: 'linear-gradient(135deg, #3b82f6, #6366f1)' }}>
              Try workspace →
            </Link>
          </div>
        </div>
      </header>

      {/* ── Hero ────────────────────────────────────────────────────────────── */}
      <section className="relative pt-28 pb-24 overflow-hidden">
        {/* Radial glow */}
        <div className="absolute inset-0 pointer-events-none"
          style={{ background: 'radial-gradient(ellipse 60% 40% at 50% 0%, rgba(59,130,246,0.09) 0%, transparent 65%)' }} />

        <div className="relative max-w-6xl mx-auto px-6 text-center">
          {/* Badge */}
          <div className="fade-up inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs border border-blue-500/20 bg-blue-500/[0.07] text-blue-400 mb-8">
            <div className="w-1.5 h-1.5 rounded-full bg-blue-400 pulse-dot" />
            Open Source · Apache 2.0 · Self-hostable
          </div>

          {/* Headline */}
          <h1 className="fade-up-delay-1 font-bold tracking-tight leading-[1.06] mb-6"
            style={{ fontSize: 'clamp(2.8rem, 6vw, 4.75rem)' }}>
            <span className="gradient-text-blue">Open Source</span>
            <br />
            <span className="text-gray-100">AI Governance</span>
            <br />
            <span className="text-gray-100">Workspace</span>
          </h1>

          {/* Subheadline */}
          <p className="fade-up-delay-2 text-gray-400 max-w-lg mx-auto leading-relaxed mb-10"
            style={{ fontSize: 'clamp(1rem, 2vw, 1.125rem)' }}>
            A lightweight governance and observability layer for AI builders,
            agents, and autonomous systems. Policy enforcement before every token.
          </p>

          {/* CTAs */}
          <div className="fade-up-delay-3 flex items-center justify-center gap-3 flex-wrap mb-12">
            <a href="https://github.com/jesseboudreau80/aegis-lite"
              target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-6 py-2.5 text-sm font-semibold text-white rounded-xl transition-all hover:opacity-90 hover:scale-[1.02]"
              style={{ background: 'linear-gradient(135deg, #3b82f6, #6366f1)', boxShadow: '0 4px 20px rgba(99,102,241,0.25)' }}>
              <GithubIcon />
              View on GitHub
            </a>
            <a href="https://github.com/jesseboudreau80/aegis-lite/blob/main/docs/SETUP.md"
              target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-5 py-2.5 text-sm text-gray-300 rounded-xl border border-white/[0.1] bg-white/[0.04] hover:bg-white/[0.07] hover:text-white hover:border-white/[0.16] transition-all">
              Read Docs →
            </a>
          </div>

          {/* Trust badges */}
          <div className="fade-up-delay-4 flex items-center justify-center gap-6 flex-wrap">
            {[
              { label: 'Apache 2.0',            color: 'bg-emerald-400' },
              { label: 'FastAPI backend',        color: 'bg-blue-400' },
              { label: 'Next.js 15 frontend',   color: 'bg-indigo-400' },
              { label: 'Docker ready',           color: 'bg-violet-400' },
              { label: 'SQLite → PostgreSQL',    color: 'bg-cyan-400' },
            ].map(({ label, color }) => (
              <div key={label} className="flex items-center gap-1.5">
                <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${color}`} />
                <span className="text-[11px] text-gray-600">{label}</span>
              </div>
            ))}
          </div>

          {/* Live status badge */}
          {status && (
            <div className="fade-up-delay-5 mt-8 inline-flex items-center gap-2.5 px-4 py-2 rounded-xl border border-white/[0.06] bg-white/[0.03] text-xs text-gray-500">
              <div className="flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 pulse-dot" />
                <span className="text-emerald-500 font-semibold">Operational</span>
              </div>
              <span className="text-white/[0.12]">·</span>
              <span>{(status.summary?.total_requests ?? 0).toLocaleString()} requests / 24h</span>
              <span className="text-white/[0.12]">·</span>
              <span>{status.summary?.blocked ?? 0} blocked</span>
              <span className="text-white/[0.12]">·</span>
              <span>avg risk {(status.summary?.avg_risk_score ?? 0).toFixed(3)}</span>
            </div>
          )}
        </div>
      </section>

      {/* ── Feature grid ────────────────────────────────────────────────────── */}
      <section className="py-24 border-t border-white/[0.05]">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-14">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-600 mb-3">What it does</p>
            <h2 className="text-3xl sm:text-4xl font-bold text-white tracking-tight mb-4">
              Governance at every layer
            </h2>
            <p className="text-gray-500 text-sm max-w-md mx-auto leading-relaxed">
              10 deterministic rules. Zero LLM calls inside the engine.
              Every decision fully traceable to a rule and risk score.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[
              {
                title: 'Policy Enforcement',
                desc: '10 deterministic rules evaluate every request in order — secrets, model access, data classification, PII — before a single token is dispatched.',
                accent: '#3b82f6',
                icon: (
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.955 11.955 0 002.25 12c0 3.072 1.15 5.877 3.047 7.987A11.952 11.952 0 0012 21.75a11.95 11.95 0 006.98-2.26A11.96 11.96 0 0021.75 12c0-2.044-.51-3.97-1.41-5.657A11.956 11.956 0 0012 4.964z" />
                  </svg>
                ),
              },
              {
                title: 'Prompt Inspection',
                desc: 'Secrets scanning (9 patterns), PII redaction (email, phone, SSN, CC), and 21 injection/jailbreak patterns with cumulative risk scoring.',
                accent: '#f97316',
                icon: (
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 15.75l-2.489-2.489m0 0a3.375 3.375 0 10-4.773-4.773 3.375 3.375 0 004.774 4.774zM21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                ),
              },
              {
                title: 'Audit Trails',
                desc: 'Immutable audit log on every request. Captures rule trace, risk score, policy version, token counts, and cost estimate. Built for compliance.',
                accent: '#6366f1',
                icon: (
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                  </svg>
                ),
              },
              {
                title: 'Model Routing',
                desc: 'Budget-aware routing across Anthropic, OpenAI, OpenRouter, and Perplexity. Free-tier fallback when spend limits approach. Automatic model override by policy.',
                accent: '#10b981',
                icon: (
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" />
                  </svg>
                ),
              },
              {
                title: 'Agent Observability',
                desc: 'Create and run governed agents with model allowlists, budget limits, and custom system prompts. Every agent run is policy-checked and logged.',
                accent: '#8b5cf6',
                icon: (
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 3v1.5M4.5 8.25H3m18 0h-1.5M4.5 12H3m18 0h-1.5m-15 3.75H3m18 0h-1.5M8.25 19.5V21M12 3v1.5m0 15V21m3.75-18v1.5m0 15V21m-9-1.5h10.5a2.25 2.25 0 002.25-2.25V6.75a2.25 2.25 0 00-2.25-2.25H6.75A2.25 2.25 0 004.5 6.75v10.5a2.25 2.25 0 002.25 2.25zm.75-12h9v9h-9v-9z" />
                  </svg>
                ),
              },
              {
                title: 'Runtime Monitoring',
                desc: 'Live governance metrics, risk analytics, and decision aggregates. Per-role model access controls and per-user monthly spend limits enforced at runtime.',
                accent: '#f59e0b',
                icon: (
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
                  </svg>
                ),
              },
            ].map(({ title, desc, accent, icon }, i) => (
              <div key={title}
                className={`card card-hover p-6 flex flex-col gap-4 fade-up-delay-${(i % 4) + 1}`}>
                <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ background: `${accent}15`, border: `1px solid ${accent}28`, color: accent }}>
                  {icon}
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-white mb-2">{title}</h3>
                  <p className="text-[12px] text-gray-500 leading-relaxed">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Governance visualization ─────────────────────────────────────────── */}
      <section className="py-24 border-t border-white/[0.05]" style={{ background: 'var(--surface-2)' }}>
        <div className="max-w-6xl mx-auto px-6">
          <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 mb-10">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-600 mb-3">
                Live governance
              </p>
              <h2 className="text-3xl sm:text-4xl font-bold text-white tracking-tight mb-3">
                Every decision. Every request.
              </h2>
              <p className="text-gray-500 text-sm max-w-lg leading-relaxed">
                A real governance engine running on every AI request. Each event
                carries a decision, risk score, and full rule trace — before any
                provider sees the prompt.
              </p>
            </div>
            <div className="flex items-center gap-3 flex-shrink-0">
              <Link href="/login"
                className="text-xs text-blue-400 hover:text-blue-300 transition-colors">
                Explore live workspace →
              </Link>
            </div>
          </div>

          <GovernanceEvents />

          {/* Decision legend */}
          <div className="mt-5 flex items-center gap-4 flex-wrap">
            {Object.entries(DECISION_STYLE).map(([d, s]) => (
              <div key={d} className="flex items-center gap-1.5">
                <div className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
                <span className="text-[10px] text-gray-600">{d}</span>
              </div>
            ))}
            <span className="text-[10px] text-gray-700 ml-auto">
              Demo data · policy v1.1.0
            </span>
          </div>
        </div>
      </section>

      {/* ── Built in Public ──────────────────────────────────────────────────── */}
      <section className="py-24 border-t border-white/[0.05]">
        <div className="max-w-6xl mx-auto px-6">
          <div className="grid lg:grid-cols-2 gap-16 items-center">

            {/* Left — mission */}
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-600 mb-3">
                Open source mission
              </p>
              <h2 className="text-3xl sm:text-4xl font-bold text-white tracking-tight mb-5">
                Built in Public.
                <br />
                <span className="text-gray-400">Built for Everyone.</span>
              </h2>
              <p className="text-gray-400 leading-relaxed mb-8 text-sm">
                AI governance infrastructure shouldn&apos;t be an enterprise-only feature.
                Aegis Lite brings the same policy enforcement and audit capabilities
                of the Aegis AI platform to the open-source community — Apache 2.0,
                self-hostable, and designed for extension.
              </p>

              <div className="space-y-3 mb-8">
                {[
                  { label: 'Apache 2.0 licensed',            desc: 'Use it, fork it, build on it — no licensing friction.' },
                  { label: 'Deterministic by design',        desc: 'No LLMs inside the policy engine. Auditable, testable, reproducible.' },
                  { label: 'Self-hostable in 60 seconds',    desc: 'Docker Compose. SQLite by default. PostgreSQL-ready.' },
                  { label: 'Contributor-friendly',           desc: 'Clear good-first-issues. Full CONTRIBUTING.md. Welcoming reviews.' },
                ].map(({ label, desc }) => (
                  <div key={label} className="flex items-start gap-3">
                    <div className="w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"
                      style={{ background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.3)' }}>
                      <svg className="w-2.5 h-2.5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-200">{label}</p>
                      <p className="text-[12px] text-gray-500 mt-0.5">{desc}</p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex gap-2.5 flex-wrap">
                <a href="https://github.com/jesseboudreau80/aegis-lite"
                  target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white rounded-lg transition-all hover:opacity-90"
                  style={{ background: 'linear-gradient(135deg, #3b82f6, #6366f1)' }}>
                  <GithubIcon className="w-3.5 h-3.5" />
                  Star on GitHub
                </a>
                <a href="https://github.com/jesseboudreau80/aegis-lite/blob/main/CONTRIBUTING.md"
                  target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs text-gray-400 hover:text-gray-200 rounded-lg border border-white/[0.08] hover:border-white/[0.14] transition-all">
                  CONTRIBUTING.md →
                </a>
              </div>
            </div>

            {/* Right — policy trace + good first issues */}
            <div className="space-y-4">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-700 mb-3">
                  Policy engine — live trace
                </p>
                <PolicyTrace />
              </div>

              <div className="card p-4">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs font-semibold text-gray-300">Good first issues</p>
                  <a href="https://github.com/jesseboudreau80/aegis-lite/labels/good-first-issue"
                    target="_blank" rel="noopener noreferrer"
                    className="text-[10px] text-blue-400 hover:text-blue-300 transition-colors">
                    View all →
                  </a>
                </div>
                <div className="space-y-0.5">
                  {GOOD_FIRST_ISSUES.map(({ n, title, label }) => (
                    <a key={n}
                      href={`https://github.com/jesseboudreau80/aegis-lite/issues/${n}`}
                      target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-2.5 p-2 rounded-lg hover:bg-white/[0.04] group transition-colors">
                      <span className="text-[10px] text-gray-700 w-5 flex-shrink-0 font-mono">#{n}</span>
                      <span className="text-[11px] text-gray-400 group-hover:text-gray-200 flex-1 truncate transition-colors">{title}</span>
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-white/[0.04] border border-white/[0.07] text-gray-600 flex-shrink-0">
                        {label}
                      </span>
                    </a>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Quickstart ───────────────────────────────────────────────────────── */}
      <section className="py-24 border-t border-white/[0.05]" style={{ background: 'var(--surface-2)' }}>
        <div className="max-w-2xl mx-auto px-6 text-center">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-600 mb-3">Get started</p>
          <h2 className="text-3xl font-bold text-white tracking-tight mb-3">Up in 60 seconds.</h2>
          <p className="text-gray-500 text-sm mb-10 leading-relaxed">
            Docker Compose. SQLite by default. No API keys required —
            demo mode provides simulated responses from all providers.
          </p>

          {/* Terminal */}
          <div className="text-left rounded-2xl overflow-hidden border border-white/[0.07] mb-8"
            style={{ background: '#05050d', fontFamily: 'var(--font-geist-mono)' }}>
            <div className="flex items-center gap-2 px-4 py-3 border-b border-white/[0.05]">
              {['#ef4444','#f59e0b','#22c55e'].map(c => (
                <div key={c} className="w-2.5 h-2.5 rounded-full" style={{ background: c, opacity: 0.65 }} />
              ))}
              <span className="text-[10px] text-gray-700 ml-2">bash</span>
            </div>
            <div className="px-5 py-4 space-y-1.5 text-sm">
              {[
                ['git',    ' clone https://github.com/jesseboudreau80/aegis-lite'],
                ['cd',     ' aegis-lite'],
                ['cp',     ' .env.example .env'],
                ['docker', ' compose up'],
              ].map(([cmd, rest]) => (
                <div key={cmd + rest}>
                  <span className="text-gray-700 select-none">$ </span>
                  <span className="text-emerald-400">{cmd}</span>
                  <span className="text-gray-400">{rest}</span>
                </div>
              ))}
              <div className="pt-2 text-gray-700">
                {'# '}<span className="text-blue-400">http://localhost:3000</span>
                {' — governance workspace ready.'}
              </div>
            </div>
          </div>

          <div className="flex items-center justify-center gap-3 flex-wrap">
            <Link href="/login"
              className="inline-flex items-center gap-1.5 px-5 py-2.5 text-sm font-semibold text-white rounded-xl hover:opacity-90 transition-all"
              style={{ background: 'linear-gradient(135deg, #3b82f6, #6366f1)' }}>
              Try hosted demo →
            </Link>
            <a href="https://github.com/jesseboudreau80/aegis-lite/blob/main/docs/SETUP.md"
              target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-300 transition-colors">
              Setup guide <ExternalIcon className="w-3 h-3" />
            </a>
          </div>
        </div>
      </section>

      {/* ── Footer ───────────────────────────────────────────────────────────── */}
      <footer className="border-t border-white/[0.05]" style={{ background: 'rgba(5,5,12,0.95)' }}>
        <div className="max-w-6xl mx-auto px-6 py-12">
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8 mb-10">

            {/* Brand */}
            <div className="lg:col-span-1">
              <div className="flex items-center gap-2 mb-3">
                <div className="logo-mark" style={{ width: 20, height: 20, fontSize: 10, borderRadius: 6 }}>A</div>
                <span className="text-sm font-semibold text-white">Aegis Lite</span>
              </div>
              <p className="text-[11px] text-gray-600 leading-relaxed mb-4 max-w-[180px]">
                Open-source AI governance workspace. Apache 2.0.
              </p>
              <a href="https://github.com/jesseboudreau80/aegis-lite"
                target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-[11px] text-gray-600 hover:text-gray-300 transition-colors">
                <GithubIcon className="w-3.5 h-3.5" />
                jesseboudreau80/aegis-lite
              </a>
            </div>

            {/* Project */}
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-700 mb-3">Project</p>
              <div className="space-y-2">
                {[
                  { label: 'GitHub',        href: 'https://github.com/jesseboudreau80/aegis-lite' },
                  { label: 'Documentation', href: 'https://github.com/jesseboudreau80/aegis-lite/blob/main/docs/SETUP.md' },
                  { label: 'Roadmap',       href: 'https://github.com/jesseboudreau80/aegis-lite/blob/main/docs/ROADMAP.md' },
                  { label: 'Contributing',  href: 'https://github.com/jesseboudreau80/aegis-lite/blob/main/CONTRIBUTING.md' },
                  { label: 'Issues',        href: 'https://github.com/jesseboudreau80/aegis-lite/issues' },
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
              <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-700 mb-3">Ecosystem</p>
              <div className="space-y-2">
                {[
                  { label: 'Aegis AI — Enterprise', href: 'https://aegis.jesseboudreau.com' },
                  { label: 'jesseboudreau.com',     href: 'https://jesseboudreau.com' },
                  { label: 'GitHub Profile',        href: 'https://github.com/jesseboudreau80' },
                ].map(({ label, href }) => (
                  <a key={label} href={href} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-1 text-[11px] text-gray-600 hover:text-gray-300 transition-colors group">
                    {label}
                    <ExternalIcon className="w-2.5 h-2.5 opacity-0 group-hover:opacity-50 transition-opacity" />
                  </a>
                ))}
              </div>
            </div>

            {/* License */}
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-700 mb-3">License</p>
              <p className="text-[11px] text-gray-600 leading-relaxed mb-3">
                Apache License 2.0
              </p>
              <p className="text-[11px] text-gray-700 leading-relaxed">
                Aegis Lite is the open-source developer edition of{' '}
                <a href="https://aegis.jesseboudreau.com" target="_blank" rel="noopener noreferrer"
                  className="text-indigo-600 hover:text-indigo-400 transition-colors">
                  Aegis AI
                </a>
                .
              </p>
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
            <div className="flex items-center gap-3 text-[10px] text-gray-700">
              <Link href="/about" className="hover:text-gray-400 transition-colors">About</Link>
              <Link href="/privacy" className="hover:text-gray-400 transition-colors">Privacy</Link>
              <Link href="/terms" className="hover:text-gray-400 transition-colors">Terms</Link>
              <div className="flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-600 flex-shrink-0" />
                {status ? `${status.status.charAt(0).toUpperCase()}${status.status.slice(1)} · v1.0.0` : 'Aegis Lite v1.0.0'}
              </div>
            </div>
          </div>
        </div>
      </footer>

    </div>
  )
}
