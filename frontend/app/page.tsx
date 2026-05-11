'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'
import Link from 'next/link'

const FEATURES = [
  { icon: '🔐', title: 'Policy Engine', desc: 'Deterministic PII detection, secrets scanning, and prompt injection defense.' },
  { icon: '🔀', title: 'Multi-Model Routing', desc: 'Route to Claude, GPT-4o, Mistral, Llama, or Gemini with budget-aware fallbacks.' },
  { icon: '📋', title: 'Structured Audit Log', desc: 'Immutable governance event log for every AI request and response.' },
  { icon: '🤖', title: 'Agent Framework', desc: 'Create and run governed custom agents with model allowlists and spend limits.' },
  { icon: '🔬', title: 'Research Integration', desc: 'Web-grounded research via Perplexity with outbound classification enforcement.' },
  { icon: '📊', title: 'Usage & Cost Tracking', desc: 'Per-user token counts, cost-per-request, and monthly budget controls.' },
]

export default function LandingPage() {
  const { user, loading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!loading && user) router.replace('/dashboard')
  }, [user, loading, router])

  if (loading) return null

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      {/* Nav */}
      <header className="border-b border-gray-800 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded bg-blue-600 flex items-center justify-center text-xs font-bold">A</div>
          <span className="text-sm font-semibold text-white">Aegis Lite</span>
          <span className="px-1.5 py-0.5 bg-blue-900/40 border border-blue-700/40 text-blue-400 text-[10px] rounded">OSS</span>
        </div>
        <Link
          href="/login"
          className="px-3 py-1.5 text-xs bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors"
        >
          Sign in
        </Link>
      </header>

      {/* Hero */}
      <section className="max-w-4xl mx-auto px-6 pt-20 pb-16 text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1 bg-blue-900/30 border border-blue-700/30 rounded-full text-blue-400 text-xs mb-6">
          Open-source AI governance platform
        </div>
        <h1 className="text-4xl font-bold text-white mb-4">
          Control, secure, and observe<br />your AI stack
        </h1>
        <p className="text-gray-400 text-lg mb-8 max-w-2xl mx-auto">
          Aegis Lite gives teams a production-grade workspace to route, govern, and audit every AI request —
          with a deterministic policy engine at the core.
        </p>
        <div className="flex items-center justify-center gap-3">
          <Link
            href="/login"
            className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg transition-colors"
          >
            Get started
          </Link>
          <a
            href="https://github.com/jesseboudreau80/aegis-lite"
            target="_blank"
            rel="noopener noreferrer"
            className="px-5 py-2.5 bg-gray-800 hover:bg-gray-700 text-gray-200 text-sm font-medium rounded-lg transition-colors"
          >
            GitHub
          </a>
        </div>
      </section>

      {/* Features */}
      <section className="max-w-5xl mx-auto px-6 pb-20">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {FEATURES.map(({ icon, title, desc }) => (
            <div key={title} className="bg-gray-900 border border-gray-800 rounded-xl p-5">
              <div className="text-2xl mb-3">{icon}</div>
              <h3 className="text-sm font-semibold text-white mb-1.5">{title}</h3>
              <p className="text-xs text-gray-400 leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-800 px-6 py-6 text-center">
        <p className="text-xs text-gray-600">
          Aegis Lite — Apache 2.0 License —{' '}
          <a href="https://github.com/jesseboudreau80/aegis-lite" className="text-gray-500 hover:text-gray-400" target="_blank" rel="noopener noreferrer">
            GitHub
          </a>
        </p>
      </footer>
    </div>
  )
}
