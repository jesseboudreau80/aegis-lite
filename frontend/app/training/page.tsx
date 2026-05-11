'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'
import { api } from '@/lib/api'

const STEPS = [
  {
    title: 'AI Governance Principles',
    content: 'Aegis Lite enforces a deterministic policy engine on every AI request. All prompts are scanned for PII, secrets, prompt injection, and data classification violations before reaching the model. Results are logged to an immutable audit trail.',
  },
  {
    title: 'Data Classification',
    content: 'Content is automatically classified as Public, Internal, Confidential, or Restricted. Higher classifications restrict which AI providers can receive the data. Never send restricted or confidential data to external web-search providers.',
  },
  {
    title: 'Model Budget Controls',
    content: 'Each user has a monthly AI spend limit. When the limit is approached, requests are automatically routed to lower-cost models. Admins can view and adjust limits from the Dashboard.',
  },
  {
    title: 'Responsible Use',
    content: 'Do not use AI to generate harmful content, circumvent security controls, or process regulated data (HIPAA, PII) without appropriate governance. All AI usage is audited. Policy violations are escalated to administrators.',
  },
]

export default function TrainingPage() {
  const { user, refreshUser } = useAuth()
  const router = useRouter()
  const [step, setStep] = useState(0)
  const [completing, setCompleting] = useState(false)

  const isLast = step === STEPS.length - 1

  const handleComplete = async () => {
    setCompleting(true)
    try {
      await api.completeTraining()
      await refreshUser()
      router.replace('/dashboard')
    } catch {
      setCompleting(false)
    }
  }

  if (user?.training_completed) {
    router.replace('/dashboard')
    return null
  }

  const current = STEPS[step]

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center px-4">
      <div className="w-full max-w-lg">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-blue-600 mb-3">
            <span className="text-white font-bold text-lg">A</span>
          </div>
          <h1 className="text-xl font-semibold text-white">AI Governance Training</h1>
          <p className="text-xs text-gray-500 mt-1">Required before accessing the workspace</p>
        </div>

        {/* Progress */}
        <div className="flex gap-1.5 mb-6">
          {STEPS.map((_, i) => (
            <div key={i} className={`h-1 flex-1 rounded-full transition-colors ${i <= step ? 'bg-blue-500' : 'bg-gray-800'}`} />
          ))}
        </div>

        {/* Step card */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 mb-4">
          <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-2">Step {step + 1} of {STEPS.length}</p>
          <h2 className="text-base font-semibold text-white mb-3">{current.title}</h2>
          <p className="text-sm text-gray-400 leading-relaxed">{current.content}</p>
        </div>

        <div className="flex gap-3">
          {step > 0 && (
            <button
              onClick={() => setStep(s => s - 1)}
              className="px-4 py-2 text-xs text-gray-400 hover:text-gray-200 border border-gray-700 hover:border-gray-600 rounded-lg transition-colors"
            >
              Back
            </button>
          )}
          <button
            onClick={isLast ? handleComplete : () => setStep(s => s + 1)}
            disabled={completing}
            className="flex-1 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
          >
            {completing ? 'Completing…' : isLast ? 'Complete training' : 'Next'}
          </button>
        </div>
      </div>
    </div>
  )
}
