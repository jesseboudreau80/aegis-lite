'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'
import AppNav from '@/components/AppNav'
import LogoutButton from '@/components/LogoutButton'

const POLICY_ENGINE_VERSION = '1.1.0'

const RULE_CHAIN = [
  { step: 1,  name: 'Secrets',        color: '#ef4444' },
  { step: 2,  name: 'Model Access',   color: '#8b5cf6' },
  { step: 3,  name: 'Agent Perms',    color: '#8b5cf6' },
  { step: 4,  name: 'Classification', color: '#3b82f6' },
  { step: 5,  name: 'PII',            color: '#f97316' },
  { step: 6,  name: 'Injection',      color: '#f59e0b' },
  { step: 7,  name: 'Keywords',       color: '#f59e0b' },
  { step: 8,  name: 'Research',       color: '#06b6d4' },
  { step: 9,  name: 'Tool Grants',    color: '#10b981' },
  { step: 10, name: 'Risk Controls',  color: '#10b981' },
]

const POLICY_RULES = [
  {
    category: 'Secrets Detection',
    badge: 'badge badge-block',
    action: 'BLOCK',
    iconPath: 'M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z',
    iconColor: '#ef4444',
    description: 'Hard stop before dispatch. Requests containing secrets never reach any provider.',
    rules: [
      'OpenAI API keys (sk-...)',
      'Anthropic API keys (sk-ant-...)',
      'Perplexity API keys (pplx-...)',
      'AWS access keys (AKIA...)',
      'GitHub personal access tokens (ghp_...)',
      'Slack bot tokens (xoxb-...)',
      'Password literal patterns (password=...)',
      'Generic credential patterns',
      'Private key headers (-----BEGIN...)',
    ],
  },
  {
    category: 'PII Redaction',
    badge: 'badge badge-escalate',
    action: 'REDACT',
    iconPath: 'M15.75 5.25a3 3 0 013 3m3 0a6 6 0 01-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1121.75 8.25z',
    iconColor: '#f97316',
    description: 'Sensitive data is redacted in-flight before the prompt reaches the inference layer.',
    rules: [
      'Email addresses → [REDACTED_EMAIL]',
      'US phone numbers → [REDACTED_PHONE]',
      'US Social Security Numbers → [REDACTED_SSN]',
      'Credit card numbers (Luhn-validated) → [REDACTED_CREDIT_CARD]',
    ],
  },
  {
    category: 'Prompt Injection Defense',
    badge: 'badge badge-warn',
    action: 'ESCALATE',
    iconPath: 'M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z',
    iconColor: '#f59e0b',
    description: '21 jailbreak and injection patterns with cumulative risk scoring. Escalated on threshold breach.',
    rules: [
      '"ignore previous instructions" variants',
      '"forget everything you know" variants',
      '"bypass your safety controls" variants',
      '"jailbreak" and "DAN mode" patterns',
      '"you are now unrestricted" variants',
      'Null byte injection (\\x00)',
      'Role-switching injection patterns',
      '21 total patterns — risk score accumulates per match',
    ],
  },
  {
    category: 'Data Classification',
    badge: 'badge badge-modify',
    action: 'CLASSIFY',
    iconPath: 'M3.75 9.776c.112-.017.227-.026.344-.026h15.812c.117 0 .232.009.344.026m-16.5 0a2.25 2.25 0 00-1.883 2.542l.857 6a2.25 2.25 0 002.227 1.932H19.05a2.25 2.25 0 002.227-1.932l.857-6a2.25 2.25 0 00-1.883-2.542m-16.5 0V6A2.25 2.25 0 016 3.75h3.879a1.5 1.5 0 011.06.44l2.122 2.12a1.5 1.5 0 001.06.44H18A2.25 2.25 0 0120.25 9v.776',
    iconColor: '#3b82f6',
    description: 'Automatic 4-tier classification controls which inference runtimes are eligible for dispatch.',
    rules: [
      'Public → all runtimes eligible',
      'Internal → standard runtimes only',
      'Confidential → restricted runtimes; premium tier excluded',
      'Restricted → no external runtimes; block and escalate',
      'HIPAA / PHI terms → escalate to compliance review',
      'M&A / legal hold terms → confidential classification',
      'Research queries with confidential content → blocked',
    ],
  },
  {
    category: 'Inference Runtime Access Control',
    badge: 'badge badge-info',
    action: 'CONTROL',
    iconPath: 'M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z',
    iconColor: '#8b5cf6',
    description: 'Role-based runtime access enforced per-request against the requesting identity\'s role.',
    rules: [
      'Standard users: premium inference runtimes excluded (cost governance)',
      'Admin: unrestricted runtime access',
      'Department-level runtime blocklists (configurable per org)',
      'Graceful downgrade to permitted runtime on access violation',
      'Hard block when no eligible runtime exists',
    ],
  },
]

export default function PoliciesPage() {
  const { user, loading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!loading && (!user || user.role !== 'admin')) router.replace('/login')
  }, [user, loading, router])

  if (loading || !user || user.role !== 'admin') return null

  return (
    <div className="flex flex-col h-full" style={{ background: 'var(--surface-1)' }}>
      <header className="page-header">
        <div className="logo-mark">A</div>
        <span className="text-sm font-semibold text-white hidden sm:block">Aegis Lite</span>
        <div className="divider hidden sm:block" style={{ height: 16 }} />
        <AppNav currentPage="/governance/policies" />
      </header>

      <div className="flex-1 overflow-y-auto p-5">
        <div className="max-w-4xl mx-auto space-y-5">

          {/* Header */}
          <div className="flex items-start justify-between gap-4 pt-1">
            <div>
              <h1 className="text-base font-semibold text-white">Policy Engine Rules</h1>
              <p className="text-xs text-gray-500 mt-0.5">
                Phase 1 deterministic rule chain · v{POLICY_ENGINE_VERSION} · 10 rules · zero LLM calls inside the engine
              </p>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 pulse-dot" />
              <span className="text-[10px] text-gray-500">Engine active</span>
            </div>
          </div>

          {/* Rule chain flow */}
          <div className="card p-5">
            <p className="stat-label mb-4">Evaluation order — applied sequentially on every request</p>
            <div className="flex items-start gap-1 flex-wrap gap-y-4">
              {RULE_CHAIN.map((rule, i) => (
                <div key={rule.step} className="flex items-center gap-1">
                  <div className="flex flex-col items-center gap-1">
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center text-[9px] font-bold flex-shrink-0"
                      style={{ background: `${rule.color}14`, border: `1px solid ${rule.color}28`, color: rule.color }}>
                      {rule.step}
                    </div>
                    <span className="text-[8px] font-mono text-center leading-tight"
                      style={{ color: rule.color, maxWidth: 44 }}>
                      {rule.name}
                    </span>
                  </div>
                  {i < RULE_CHAIN.length - 1 && (
                    <svg className="w-3 h-3 text-gray-800 flex-shrink-0 -mt-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5l7 7-7 7" />
                    </svg>
                  )}
                </div>
              ))}
            </div>
            <div className="mt-4 pt-3 border-t border-white/[0.04]">
              <p className="text-[9px] text-gray-700 font-mono">
                {'PolicyDecision { decision, risk_score, flags, rule_trace, policy_version }'}
                {' → '}
                <span className="text-emerald-700">allow</span>
                {' · '}
                <span className="text-blue-700">modify</span>
                {' · '}
                <span className="text-amber-700">warn</span>
                {' · '}
                <span className="text-orange-700">escalate</span>
                {' · '}
                <span className="text-red-700">block</span>
              </p>
            </div>
          </div>

          {/* Rule detail cards */}
          <div className="space-y-3">
            {POLICY_RULES.map(({ category, badge, action, iconPath, iconColor, description, rules }) => (
              <div key={category} className="card p-5">
                <div className="flex items-start justify-between gap-4 mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                      style={{ background: `${iconColor}12`, border: `1px solid ${iconColor}25` }}>
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke={iconColor} strokeWidth={1.75}>
                        <path strokeLinecap="round" strokeLinejoin="round" d={iconPath} />
                      </svg>
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-white">{category}</h3>
                      <p className="text-[11px] text-gray-500 mt-0.5">{description}</p>
                    </div>
                  </div>
                  <span className={`${badge} flex-shrink-0`}>{action}</span>
                </div>
                <ul className="space-y-1 pl-11">
                  {rules.map(rule => (
                    <li key={rule} className="flex items-start gap-2 text-[11px] text-gray-500">
                      <span className="text-gray-700 mt-0.5 flex-shrink-0">›</span>
                      <span className="font-mono">{rule}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          {/* Risk thresholds */}
          <div className="card p-5">
            <h3 className="text-xs font-semibold text-gray-300 mb-2">Risk Score Thresholds</h3>
            <p className="text-[11px] text-gray-600 mb-4 leading-relaxed">
              Each rule that fires adds a delta to a cumulative risk score (0.0–1.0).
              Thresholds determine the governance decision. Force-block flags override thresholds immediately.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {[
                { label: 'BLOCK',    threshold: '≥ 0.85', color: '#ef4444', desc: 'Hard stop — request never dispatched to any runtime' },
                { label: 'ESCALATE', threshold: '≥ 0.60', color: '#f97316', desc: 'Dispatch + human review notification queued' },
                { label: 'WARN',     threshold: '≥ 0.25', color: '#f59e0b', desc: 'Dispatch + governance log flag — no interruption' },
              ].map(({ label, threshold, color, desc }) => (
                <div key={label} className="rounded-xl p-3.5"
                  style={{ background: `${color}07`, border: `1px solid ${color}20` }}>
                  <p className="text-sm font-bold mb-0.5" style={{ color }}>{label}</p>
                  <p className="text-[9px] font-mono text-gray-600 mb-2">Risk score {threshold}</p>
                  <p className="text-[10px] text-gray-600 leading-relaxed">{desc}</p>
                </div>
              ))}
            </div>
            <div className="mt-4 pt-3 border-t border-white/[0.04]">
              <p className="text-[10px] text-gray-700">
                Edit rule configuration in{' '}
                <code className="text-blue-500 font-mono">backend/config/policy_config.py</code>
                {' '}· Policy version is logged on every governance decision for audit traceability.
              </p>
            </div>
          </div>

        </div>
      </div>
      <LogoutButton />
    </div>
  )
}
