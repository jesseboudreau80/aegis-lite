'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'
import { api } from '@/lib/api'

const STEPS = [
  {
    icon: 'M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z',
    color: '#3b82f6',
    title: 'AI Governance Principles',
    content: 'Aegis Lite enforces a deterministic policy engine on every AI request. Prompts are scanned for PII, secrets, prompt injection, and data classification violations before reaching the model. Every decision is logged to an immutable audit trail with the rule trace and policy version active at evaluation time.',
  },
  {
    icon: 'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z',
    color: '#10b981',
    title: 'Data Classification',
    content: 'Every request is automatically classified as Public, Internal, Confidential, or Restricted. Higher classifications restrict which inference runtimes are eligible for dispatch. Never include confidential or restricted content in research queries — external web-search providers operate outside the governance boundary. The policy engine will block or escalate if it detects a classification mismatch.',
  },
  {
    icon: 'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
    color: '#8b5cf6',
    title: 'Budget Controls',
    content: 'Each user has a monthly AI spend limit. When budget is approached, requests are automatically routed to lower-cost or free-tier models. Premium models like Claude Opus are restricted to admin users. Admins can view and adjust per-user limits from the Dashboard.',
  },
  {
    icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01',
    color: '#f59e0b',
    title: 'Responsible Use',
    content: 'Do not use AI to generate harmful content, circumvent security controls, or process regulated data (HIPAA, legal hold, PII) without appropriate governance in place. All AI usage is audited in full. Policy violations are escalated to administrators. If you encounter a policy error, contact your workspace admin.',
  },
]

export default function TrainingPage() {
  const { user, refreshUser } = useAuth()
  const router = useRouter()
  const [step, setStep]             = useState(0)
  const [completing, setCompleting] = useState(false)
  const [error, setError]           = useState('')

  // Move render-phase redirect into an effect to avoid React anti-pattern.
  useEffect(() => {
    if (user?.training_completed) router.replace('/dashboard')
  }, [user, router])

  const isLast = step === STEPS.length - 1

  const handleComplete = async () => {
    setCompleting(true)
    setError('')
    try {
      await api.completeTraining()
      await refreshUser()
      router.replace('/dashboard')
    } catch {
      setError('Something went wrong. Please try again.')
      setCompleting(false)
    }
  }

  // While completing or already done, don't render the form.
  if (user?.training_completed) return null

  const current = STEPS[step]

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12" style={{ background: 'var(--surface-1)' }}>
      <div className="w-full max-w-md">

        {/* Brand */}
        <div className="text-center mb-10">
          <div className="logo-mark mx-auto mb-3" style={{ width: 36, height: 36, fontSize: 16 }}>A</div>
          <h1 className="text-xl font-semibold text-white">AI Governance Training</h1>
          <p className="text-xs text-gray-500 mt-1">Required before accessing the AI workspace</p>
        </div>

        {/* Step progress */}
        <div className="flex gap-2 mb-6">
          {STEPS.map((_, i) => (
            <div key={i} className="flex-1 rounded-full transition-all duration-500"
              style={{
                height: 3,
                background: i < step ? '#6366f1' : i === step ? '#3b82f6' : 'rgba(255,255,255,0.06)',
              }} />
          ))}
        </div>

        {/* Step card */}
        <div className="card p-6 mb-4">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: `${current.color}15`, border: `1px solid ${current.color}25` }}>
              <svg className="w-4.5 h-4.5" fill="none" viewBox="0 0 24 24" stroke={current.color} strokeWidth={1.75}>
                <path strokeLinecap="round" strokeLinejoin="round" d={current.icon} />
              </svg>
            </div>
            <div>
              <p className="stat-label">Step {step + 1} of {STEPS.length}</p>
              <h2 className="text-sm font-semibold text-white mt-0.5">{current.title}</h2>
            </div>
          </div>
          <p className="text-sm text-gray-400 leading-relaxed">{current.content}</p>
        </div>

        {error && (
          <div className="mb-3 px-3 py-2 rounded-lg border text-xs text-red-400"
            style={{ background: 'rgba(239,68,68,0.06)', borderColor: 'rgba(239,68,68,0.2)' }}>
            {error}
          </div>
        )}

        <div className="flex gap-3">
          {step > 0 && (
            <button onClick={() => setStep(s => s - 1)}
              disabled={completing}
              className="px-4 py-2 text-xs text-gray-400 hover:text-gray-200 border border-white/[0.08] hover:border-white/[0.14] rounded-xl transition-all disabled:opacity-40">
              ← Back
            </button>
          )}
          <button onClick={isLast ? handleComplete : () => setStep(s => s + 1)}
            disabled={completing}
            className="flex-1 py-2.5 text-sm font-semibold text-white rounded-xl transition-all disabled:opacity-60 hover:opacity-90 cursor-pointer disabled:cursor-default"
            style={{ background: 'linear-gradient(135deg, #3b82f6, #6366f1)' }}>
            {completing ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Completing…
              </span>
            ) : isLast ? 'Complete training & enter workspace' : 'Continue →'}
          </button>
        </div>

        <p className="text-center text-[10px] text-gray-700 mt-5">
          All AI usage is governed by the Aegis Lite policy engine and logged to the audit trail.
        </p>
      </div>
    </div>
  )
}
