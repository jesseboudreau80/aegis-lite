'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'
import AppNav from '@/components/AppNav'
import LogoutButton from '@/components/LogoutButton'

const POLICY_RULES = [
  { category: 'Secrets Detection', rules: [
    'OpenAI API keys (sk-...)',
    'Anthropic API keys (sk-ant-...)',
    'Perplexity API keys (pplx-...)',
    'AWS access keys (AKIA...)',
    'GitHub PATs (ghp_...)',
    'Slack bot tokens (xoxb-...)',
    'Password literals (password=...)',
    'API credential patterns',
    'Private key headers',
  ], action: 'BLOCK', color: 'text-red-400 bg-red-900/20 border-red-700/30' },
  { category: 'PII Redaction', rules: [
    'Email addresses → [REDACTED_EMAIL]',
    'US phone numbers → [REDACTED_PHONE]',
    'US Social Security Numbers → [REDACTED_SSN]',
    'Credit card numbers → [REDACTED_CREDIT_CARD]',
  ], action: 'REDACT', color: 'text-orange-400 bg-orange-900/20 border-orange-700/30' },
  { category: 'Prompt Injection', rules: [
    '"ignore previous instructions"',
    '"forget everything you..."',
    '"bypass your safety..."',
    '"jailbreak"',
    '"DAN mode"',
    '"you are now unrestricted"',
    'Null byte injection (\\x00)',
    '21 total patterns',
  ], action: 'ESCALATE', color: 'text-yellow-400 bg-yellow-900/20 border-yellow-700/30' },
  { category: 'Data Classification', rules: [
    'Confidential keywords → restrict to approved providers',
    'Restricted keywords → block all external providers',
    'HIPAA / PHI terms → escalate',
    'M&A / legal hold terms → confidential classification',
    'Research queries with confidential data → BLOCK',
  ], action: 'CLASSIFY', color: 'text-blue-400 bg-blue-900/20 border-blue-700/30' },
  { category: 'Model Access Control', rules: [
    'Regular users: claude_opus excluded (cost control)',
    'Admin: unrestricted model access',
    'Department-level blocklists (configurable)',
    'Graceful fallback to permitted model on violation',
    'Hard block when no fallback exists',
  ], action: 'CONTROL', color: 'text-purple-400 bg-purple-900/20 border-purple-700/30' },
]

export default function PoliciesPage() {
  const { user, loading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!loading && (!user || user.role !== 'admin')) router.replace('/login')
  }, [user, loading, router])

  if (loading || !user || user.role !== 'admin') return null

  return (
    <div className="flex flex-col h-full bg-gray-950">
      <div className="flex-shrink-0 border-b border-gray-800 px-4 py-2.5 flex items-center gap-3">
        <div className="flex items-center gap-1.5">
          <div className="w-5 h-5 rounded bg-blue-600 flex items-center justify-center text-xs font-bold text-white">A</div>
          <span className="text-sm font-semibold text-white hidden sm:block">Aegis Lite</span>
        </div>
        <div className="w-px h-4 bg-gray-800 hidden sm:block" />
        <AppNav currentPage="/governance/policies" />
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-4xl mx-auto space-y-6">
          <div>
            <h1 className="text-base font-semibold text-white">Policy Engine</h1>
            <p className="text-xs text-gray-500 mt-0.5">
              Phase 1 deterministic rules — evaluated on every request before it reaches the model.
              Edit rules in <code className="text-blue-400">backend/config/policy_config.py</code>.
            </p>
          </div>

          <div className="space-y-4">
            {POLICY_RULES.map(({ category, rules, action, color }) => (
              <div key={category} className="bg-gray-900 border border-gray-800 rounded-xl p-5">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-white">{category}</h3>
                  <span className={`px-2 py-0.5 text-[10px] font-semibold rounded border ${color}`}>{action}</span>
                </div>
                <ul className="space-y-1">
                  {rules.map(rule => (
                    <li key={rule} className="flex items-center gap-2 text-xs text-gray-400">
                      <span className="w-1 h-1 rounded-full bg-gray-600 flex-shrink-0" />
                      {rule}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
            <h3 className="text-sm font-semibold text-white mb-2">Risk Thresholds</h3>
            <div className="grid grid-cols-3 gap-3 text-xs">
              {[
                { label: 'BLOCK', threshold: '≥ 0.85', color: 'text-red-400' },
                { label: 'ESCALATE', threshold: '≥ 0.60', color: 'text-orange-400' },
                { label: 'WARN', threshold: '≥ 0.25', color: 'text-yellow-400' },
              ].map(({ label, threshold, color }) => (
                <div key={label} className="bg-gray-800 rounded-lg p-3 text-center">
                  <p className={`font-bold text-sm ${color}`}>{label}</p>
                  <p className="text-gray-500 mt-0.5">Risk score {threshold}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
      <LogoutButton />
    </div>
  )
}
