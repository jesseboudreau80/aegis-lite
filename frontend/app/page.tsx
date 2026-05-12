'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'
import Link from 'next/link'

const FEATURES = [
  {
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
      </svg>
    ),
    title: 'Policy Engine',
    desc: 'Deterministic rule evaluation on every request. PII redaction, secrets scanning, prompt injection defense, data classification.',
    color: 'text-blue-400',
    bg: 'bg-blue-500/10 border-blue-500/20',
  },
  {
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
      </svg>
    ),
    title: 'Multi-Model Routing',
    desc: 'Route to Claude, GPT-4o, Mistral, Llama, or Gemini. Budget-aware fallbacks keep costs predictable.',
    color: 'text-violet-400',
    bg: 'bg-violet-500/10 border-violet-500/20',
  },
  {
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
      </svg>
    ),
    title: 'Structured Audit Log',
    desc: 'Immutable governance event log for every request and response. Rule traces, risk scores, policy versions.',
    color: 'text-emerald-400',
    bg: 'bg-emerald-500/10 border-emerald-500/20',
  },
  {
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 3H5a2 2 0 00-2 2v4m6-6h10a2 2 0 012 2v4M9 3v18m0 0h10a2 2 0 002-2V9M9 21H5a2 2 0 01-2-2V9m0 0h18" />
      </svg>
    ),
    title: 'Governed Agents',
    desc: 'Create and run agents with model allowlists, spend limits, and full execution tracing on every invocation.',
    color: 'text-amber-400',
    bg: 'bg-amber-500/10 border-amber-500/20',
  },
  {
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
      </svg>
    ),
    title: 'Research Integration',
    desc: 'Perplexity-powered web research with outbound data classification. Confidential content blocked at dispatch.',
    color: 'text-sky-400',
    bg: 'bg-sky-500/10 border-sky-500/20',
  },
  {
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    ),
    title: 'Cost Visibility',
    desc: 'Per-user monthly budgets with automatic enforcement. Token counts and cost-per-request in the audit trail.',
    color: 'text-rose-400',
    bg: 'bg-rose-500/10 border-rose-500/20',
  },
]

const POLICY_RULES = [
  { label: 'Secrets detected', action: 'BLOCK',   color: 'text-red-400', bg: 'bg-red-500/10' },
  { label: 'SSN in prompt',    action: 'REDACT',  color: 'text-orange-400', bg: 'bg-orange-500/10' },
  { label: 'Injection attempt',action: 'ESCALATE',color: 'text-yellow-400', bg: 'bg-yellow-500/10' },
  { label: 'PII detected',     action: 'MODIFY',  color: 'text-blue-400',   bg: 'bg-blue-500/10' },
  { label: 'Budget exceeded',  action: 'REROUTE', color: 'text-violet-400', bg: 'bg-violet-500/10' },
  { label: 'Model access ok',  action: 'ALLOW',   color: 'text-emerald-400',bg: 'bg-emerald-500/10' },
]

function PolicyEngineViz() {
  const [active, setActive] = useState(0)
  useEffect(() => {
    const t = setInterval(() => setActive(i => (i + 1) % POLICY_RULES.length), 1200)
    return () => clearInterval(t)
  }, [])

  return (
    <div className="relative rounded-2xl overflow-hidden border border-white/[0.06] bg-[#111118]">
      {/* Header bar */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-white/[0.05]">
        <div className="flex gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-red-500/60" />
          <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/60" />
          <div className="w-2.5 h-2.5 rounded-full bg-green-500/60" />
        </div>
        <span className="text-[10px] text-gray-600 ml-1 font-mono">policy_engine.evaluate_request()</span>
        <div className="ml-auto flex items-center gap-1.5">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 pulse-dot" />
          <span className="text-[10px] text-emerald-500">LIVE</span>
        </div>
      </div>

      {/* Rule evaluations */}
      <div className="p-4 space-y-1.5 font-mono text-xs">
        {POLICY_RULES.map((rule, i) => (
          <div
            key={rule.label}
            className={`flex items-center justify-between px-3 py-2 rounded-lg transition-all duration-300 ${
              i === active ? 'bg-white/[0.05] border border-white/[0.08]' : 'opacity-40'
            }`}
          >
            <div className="flex items-center gap-2">
              <div className={`w-1 h-1 rounded-full ${i < active ? 'bg-emerald-500' : i === active ? 'bg-blue-400' : 'bg-gray-700'}`} />
              <span className="text-gray-400">{rule.label}</span>
            </div>
            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded ${rule.color} ${rule.bg}`}>
              {rule.action}
            </span>
          </div>
        ))}
      </div>

      {/* Bottom status */}
      <div className="px-4 py-3 border-t border-white/[0.05] flex items-center justify-between">
        <span className="text-[10px] text-gray-600 font-mono">risk_score: 0.{String(active * 14).padStart(2, '0')}</span>
        <span className="text-[10px] text-gray-600 font-mono">policy_version: 1.1.0</span>
      </div>
    </div>
  )
}

const STATS = [
  { value: '10', label: 'Rule checks per request' },
  { value: '9',  label: 'Secret patterns detected' },
  { value: '4',  label: 'PII types auto-redacted' },
  { value: '21', label: 'Injection patterns blocked' },
]

export default function LandingPage() {
  const { user, loading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!loading && user) router.replace('/dashboard')
  }, [user, loading, router])

  if (loading) return null

  return (
    <div className="min-h-screen text-gray-100" style={{ background: 'var(--surface-1)' }}>

      {/* Nav */}
      <header className="sticky top-0 z-50 border-b border-white/[0.05] px-6 py-3.5 flex items-center justify-between"
        style={{ background: 'rgba(10,10,15,0.85)', backdropFilter: 'blur(16px)' }}>
        <div className="flex items-center gap-2.5">
          <div className="logo-mark">A</div>
          <span className="text-sm font-semibold text-white">Aegis Lite</span>
          <span className="badge badge-info ml-0.5">OSS</span>
        </div>
        <div className="flex items-center gap-3">
          <a
            href="https://github.com/jesseboudreau80/aegis-lite"
            target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-200 transition-colors"
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
              <path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd" />
            </svg>
            GitHub
          </a>
          <Link
            href="/login"
            className="px-3.5 py-1.5 text-xs font-medium text-white rounded-lg transition-colors"
            style={{ background: 'linear-gradient(135deg, #3b82f6, #6366f1)' }}
          >
            Sign in
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="max-w-5xl mx-auto px-6 pt-24 pb-20">
        <div className="text-center mb-16">
          <div className="fade-up inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs mb-8 border"
            style={{ background: 'rgba(59,130,246,0.08)', borderColor: 'rgba(59,130,246,0.2)', color: '#60a5fa' }}>
            <div className="w-1.5 h-1.5 rounded-full bg-blue-400 pulse-dot" />
            Open-source AI governance — Apache 2.0
          </div>

          <h1 className="fade-up-delay-1 text-5xl sm:text-6xl font-bold mb-6 leading-[1.06] tracking-tight">
            <span className="gradient-text">Govern every AI request</span>
            <br />
            <span className="text-gray-300 text-4xl sm:text-5xl font-semibold">before it reaches the model</span>
          </h1>

          <p className="fade-up-delay-2 text-gray-400 text-lg sm:text-xl mb-10 max-w-2xl mx-auto leading-relaxed">
            Aegis Lite is a production-grade AI governance workspace.
            Deterministic policy enforcement, structured audit logging, and
            explainable model routing — all open source, all self-hostable.
          </p>

          <div className="fade-up-delay-3 flex items-center justify-center gap-3 flex-wrap">
            <Link href="/login"
              className="px-6 py-2.5 text-sm font-semibold text-white rounded-xl transition-all hover:scale-[1.02] active:scale-[0.98]"
              style={{ background: 'linear-gradient(135deg, #3b82f6, #6366f1)', boxShadow: '0 4px 24px rgba(99,102,241,0.3)' }}>
              Get started free
            </Link>
            <a href="https://github.com/jesseboudreau80/aegis-lite" target="_blank" rel="noopener noreferrer"
              className="px-6 py-2.5 text-sm font-medium text-gray-300 rounded-xl border transition-all hover:text-white hover:border-white/20"
              style={{ borderColor: 'rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.04)' }}>
              View on GitHub →
            </a>
          </div>

          {/* Trust indicators */}
          <div className="fade-up-delay-4 flex items-center justify-center gap-6 mt-10 flex-wrap">
            {[
              { dot: true, text: 'Policy enforced on every request' },
              { dot: true, text: 'SQLite default, PostgreSQL-ready' },
              { dot: true, text: 'Apache 2.0 license' },
            ].map(({ dot, text }) => (
              <div key={text} className="flex items-center gap-1.5">
                {dot && <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />}
                <span className="text-xs text-gray-500">{text}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Policy engine viz + stats */}
        <div className="grid lg:grid-cols-2 gap-8 items-center mb-24">
          <div className="fade-up-delay-2 order-2 lg:order-1">
            <PolicyEngineViz />
          </div>
          <div className="order-1 lg:order-2 space-y-6">
            <div>
              <p className="text-xs text-blue-400 font-semibold uppercase tracking-wider mb-2">Phase 1 — Deterministic</p>
              <h2 className="text-2xl font-bold text-white mb-3">
                Rules that run before the model — every time
              </h2>
              <p className="text-gray-400 text-sm leading-relaxed">
                The policy engine evaluates 10 ordered rule checks on every request. No LLM calls inside the engine.
                Results are deterministic, reproducible, and fully traceable in the audit log.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {STATS.map(({ value, label }) => (
                <div key={label} className="card p-4">
                  <p className="stat-number mb-1 gradient-text-blue">{value}</p>
                  <p className="text-[11px] text-gray-500 leading-tight">{label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Features grid */}
      <section className="max-w-5xl mx-auto px-6 pb-24">
        <div className="text-center mb-12">
          <h2 className="text-2xl font-bold text-white mb-3">Everything you need to govern AI at runtime</h2>
          <p className="text-gray-500 text-sm">Production-grade from day one. No vendor lock-in.</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {FEATURES.map(({ icon, title, desc, color, bg }, i) => (
            <div key={title}
              className={`card card-hover p-5 fade-up-delay-${(i % 6) + 1}`}>
              <div className={`inline-flex p-2.5 rounded-lg border mb-4 ${bg} ${color}`}>
                {icon}
              </div>
              <h3 className="text-sm font-semibold text-white mb-2">{title}</h3>
              <p className="text-xs text-gray-500 leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-3xl mx-auto px-6 pb-24 text-center">
        <div className="card p-10" style={{ background: 'linear-gradient(135deg, rgba(59,130,246,0.05), rgba(99,102,241,0.05))' }}>
          <h2 className="text-2xl font-bold text-white mb-3">Ready to add governance to your AI stack?</h2>
          <p className="text-gray-400 text-sm mb-6">
            Docker Compose. One command. No configuration needed to start.
          </p>
          <div className="font-mono text-xs text-gray-300 bg-black/40 rounded-lg px-4 py-3 mb-6 text-left border border-white/[0.05]">
            <span className="text-gray-600 select-none">$ </span>
            <span className="text-emerald-400">docker</span>
            <span className="text-gray-300"> compose up</span>
          </div>
          <div className="flex items-center justify-center gap-3 flex-wrap">
            <Link href="/login"
              className="px-5 py-2 text-sm font-semibold text-white rounded-lg transition-colors"
              style={{ background: 'linear-gradient(135deg, #3b82f6, #6366f1)' }}>
              Launch workspace
            </Link>
            <a href="https://github.com/jesseboudreau80/aegis-lite/blob/main/docs/SETUP.md"
              target="_blank" rel="noopener noreferrer"
              className="px-5 py-2 text-sm text-gray-400 hover:text-gray-200 transition-colors">
              Read setup guide →
            </a>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/[0.05] px-6 py-8">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="logo-mark" style={{ width: 18, height: 18, fontSize: 9 }}>A</div>
            <span className="text-xs text-gray-600">Aegis Lite — Apache 2.0</span>
          </div>
          <div className="flex items-center gap-5 text-xs text-gray-600">
            <a href="https://github.com/jesseboudreau80/aegis-lite" className="hover:text-gray-400 transition-colors" target="_blank" rel="noopener noreferrer">GitHub</a>
            <a href="https://github.com/jesseboudreau80/aegis-lite/blob/main/docs/SETUP.md" className="hover:text-gray-400 transition-colors" target="_blank" rel="noopener noreferrer">Docs</a>
            <a href="https://github.com/jesseboudreau80/aegis-lite/blob/main/CONTRIBUTING.md" className="hover:text-gray-400 transition-colors" target="_blank" rel="noopener noreferrer">Contributing</a>
            <a href="https://github.com/jesseboudreau80/aegis-lite/blob/main/SECURITY.md" className="hover:text-gray-400 transition-colors" target="_blank" rel="noopener noreferrer">Security</a>
          </div>
        </div>
      </footer>
    </div>
  )
}
