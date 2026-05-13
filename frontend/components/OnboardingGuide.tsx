'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'

export const ONBOARDING_KEY   = 'aegis_onboarding_v1'
export const ONBOARDING_EVENT = 'aegis-onboarding-update'

const STEPS = [
  {
    href: '/chat',
    label: 'Start a governed conversation',
    desc: 'Every prompt is evaluated through the policy engine before reaching any AI provider. PII, secrets, and injections are intercepted automatically.',
    icon: 'M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z',
  },
  {
    href: '/agents',
    label: 'Run a governed workflow',
    desc: 'Pre-configured agents run with model allowlists, per-run budget limits, and full audit logging on every execution.',
    icon: 'M9 3H5a2 2 0 00-2 2v4m6-6h10a2 2 0 012 2v4M9 3v18m0 0h10a2 2 0 002-2V9M9 21H5a2 2 0 01-2-2V9m0 0h18',
  },
  {
    href: '/research',
    label: 'Run policy-aware web research',
    desc: 'Research queries are classified before external dispatch. Confidential and restricted data is blocked from leaving the workspace.',
    icon: 'M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z',
  },
  {
    href: '/dashboard',
    label: 'Monitor governance telemetry',
    desc: 'Track AI usage, per-user costs, policy decision aggregates, and governance events across your workspace.',
    icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z',
  },
]

const SKIP_ROUTES = new Set(['/', '/login', '/training'])

export function getOnboardingHref(): string | null {
  if (typeof window === 'undefined') return null
  const raw = localStorage.getItem(ONBOARDING_KEY)
  if (!raw) return STEPS[0].href
  try {
    const d = JSON.parse(raw)
    if (d.done) return null
    return STEPS[d.step ?? 0]?.href ?? null
  } catch { return null }
}

function emitUpdate() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(ONBOARDING_EVENT))
  }
}

export default function OnboardingGuide() {
  const { user }    = useAuth()
  const pathname    = usePathname()
  const [step, setStep]       = useState<number | null>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (!user?.training_completed) return
    const raw = localStorage.getItem(ONBOARDING_KEY)
    if (!raw) {
      setStep(0)
      setVisible(true)
    } else {
      try {
        const d = JSON.parse(raw)
        if (!d.done) {
          setStep(d.step ?? 0)
          setVisible(true)
        }
      } catch { /* ignore corrupt data */ }
    }
  }, [user])

  const advanceOrComplete = useCallback(() => {
    setStep(prev => {
      if (prev === null) return null
      const next = prev + 1
      if (next >= STEPS.length) {
        localStorage.setItem(ONBOARDING_KEY, JSON.stringify({ done: true }))
        emitUpdate()
        setVisible(false)
        return null
      }
      localStorage.setItem(ONBOARDING_KEY, JSON.stringify({ step: next }))
      emitUpdate()
      return next
    })
  }, [])

  useEffect(() => {
    if (step === null || !visible) return
    if (STEPS[step]?.href === pathname) advanceOrComplete()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname])

  const dismiss = useCallback(() => {
    localStorage.setItem(ONBOARDING_KEY, JSON.stringify({ done: true }))
    emitUpdate()
    setVisible(false)
  }, [])

  // Escape key to dismiss
  useEffect(() => {
    if (!visible) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') dismiss() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [visible, dismiss])

  if (!visible || step === null) return null
  if (!user?.training_completed) return null
  if (SKIP_ROUTES.has(pathname)) return null

  const current = STEPS[step]
  if (!current) return null

  const isHere = pathname === current.href

  return (
    <>
      {/* Desktop backdrop overlay */}
      <div
        className="hidden md:block fixed inset-0 z-40"
        style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(3px)' }}
        onClick={dismiss}
        aria-hidden="true"
      />

      {/* Modal — floating bottom-right on mobile, centered on desktop */}
      <div
        role="complementary"
        aria-label="Workspace orientation"
        className="fixed z-50
          bottom-16 right-4
          md:bottom-auto md:right-auto md:top-1/2 md:left-1/2 md:-translate-x-1/2 md:-translate-y-1/2"
      >
        <div
          className="w-[272px] md:w-[520px] rounded-2xl overflow-hidden"
          style={{
            background: 'var(--surface-2)',
            border: '1px solid rgba(255,255,255,0.09)',
            boxShadow: '0 24px 64px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.05) inset',
          }}
        >
          {/* Progress bar */}
          <div className="flex h-0.5">
            {STEPS.map((_, i) => (
              <div key={i} className="flex-1 transition-all duration-500"
                style={{ background: i <= step ? '#3b82f6' : 'rgba(255,255,255,0.07)' }} />
            ))}
          </div>

          {/* Header */}
          <div className="flex items-center justify-between px-4 md:px-6 py-3 border-b border-white/[0.06]">
            <div className="flex items-center gap-2.5">
              <div className="flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
                <span className="text-[9px] md:text-[10px] font-semibold uppercase tracking-widest text-gray-500">
                  Workspace orientation
                </span>
              </div>
              <span className="text-[9px] text-gray-700 font-mono">{step + 1} / {STEPS.length}</span>
            </div>
            <button
              onClick={dismiss}
              aria-label="Dismiss orientation guide"
              className="w-6 h-6 flex items-center justify-center rounded-md text-gray-600 hover:text-gray-300 hover:bg-white/[0.06] transition-all cursor-pointer"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Content */}
          <div className="px-4 md:px-6 py-4 md:py-6">
            <div className="flex items-start gap-3 md:gap-4 mb-3 md:mb-4">
              <div
                className="w-8 h-8 md:w-11 md:h-11 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.2)' }}
              >
                <svg className="w-4 h-4 md:w-5 md:h-5 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                  <path strokeLinecap="round" strokeLinejoin="round" d={current.icon} />
                </svg>
              </div>
              <div className="pt-0.5">
                <p className="text-[12px] md:text-sm font-semibold text-white leading-snug mb-0.5">{current.label}</p>
                <p className="text-[10px] md:text-[11px] text-gray-600 font-mono">Step {step + 1} of {STEPS.length}</p>
              </div>
            </div>

            <p className="text-[11px] md:text-[13px] text-gray-400 leading-relaxed mb-4 md:mb-6 md:pl-[60px]">
              {current.desc}
            </p>

            {/* Step dots — desktop only */}
            <div className="hidden md:flex items-center gap-1.5 mb-6 md:pl-[60px]">
              {STEPS.map((_, i) => (
                <div key={i} className="rounded-full transition-all duration-300"
                  style={{
                    width: i === step ? 16 : 6,
                    height: 6,
                    background: i === step ? '#3b82f6' : i < step ? 'rgba(59,130,246,0.4)' : 'rgba(255,255,255,0.1)',
                  }}
                />
              ))}
            </div>

            <div className="flex items-center justify-between md:pl-[60px]">
              <button
                onClick={dismiss}
                className="text-[10px] md:text-[11px] text-gray-600 hover:text-gray-400 transition-colors cursor-pointer"
              >
                Skip tour
              </button>
              <Link
                href={current.href}
                className="inline-flex items-center gap-1.5 px-3 md:px-4 py-1.5 md:py-2 text-[11px] md:text-xs font-semibold text-white rounded-lg transition-all hover:opacity-90 cursor-pointer"
                style={{ background: 'linear-gradient(135deg, #3b82f6, #6366f1)' }}
              >
                {isHere ? 'You\'re here ✓' : 'Go →'}
              </Link>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
