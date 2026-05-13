'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'
import AppNav from '@/components/AppNav'
import LogoutButton from '@/components/LogoutButton'
import { api } from '@/lib/api'

const RESEARCH_TYPES = [
  { id: 'quick', label: 'Quick',  desc: 'Fast web-grounded Q&A with citations' },
  { id: 'deep',  label: 'Deep',   desc: 'Multi-source synthesis (extended search)' },
]

type ResearchResult = {
  content: string
  model_used: string
  cost_usd: number
  citations: Array<{ url?: string; title?: string; snippet?: string }>
}

export default function ResearchPage() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const [query, setQuery]   = useState('')
  const [type, setType]     = useState('quick')
  const [running, setRunning] = useState(false)
  const [result, setResult] = useState<ResearchResult | null>(null)
  const [error, setError]   = useState('')

  useEffect(() => {
    if (!loading && !user) router.replace('/login')
    if (!loading && user && !user.training_completed) router.replace('/training')
  }, [user, loading, router])

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!query.trim()) return
    setRunning(true)
    setError('')
    setResult(null)
    try {
      const res = await api.runResearch({ query, research_type: type })
      setResult(res.data as ResearchResult)
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
        || 'Research failed. PERPLEXITY_API_KEY may not be configured in this deployment.'
      setError(msg)
    } finally {
      setRunning(false)
    }
  }

  if (loading || !user) return null

  return (
    <div className="flex flex-col h-full" style={{ background: 'var(--surface-1)' }}>

      {/* Header */}
      <div className="flex-shrink-0 border-b border-white/[0.06] px-4 py-2.5 flex items-center gap-3"
        style={{ background: 'rgba(7,7,15,0.8)', backdropFilter: 'blur(12px)' }}>
        <div className="logo-mark flex-shrink-0" style={{ width: 20, height: 20, fontSize: 10, borderRadius: 6 }}>A</div>
        <span className="text-sm font-semibold text-white hidden sm:block">Aegis Lite</span>
        <div className="divider hidden sm:block" style={{ height: 16 }} />
        <AppNav currentPage="/research" />
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-6 py-8 space-y-6">

          {/* Page header */}
          <div>
            <h1 className="text-sm font-semibold text-white">Governed AI Research</h1>
            <p className="text-[12px] text-gray-500 mt-0.5">
              Web-grounded research with governance and classification enforcement.
              Confidential content is blocked from external providers before dispatch.
            </p>
          </div>

          {/* Search form */}
          <form onSubmit={handleSearch} className="space-y-3">
            <div className="flex gap-2">
              {RESEARCH_TYPES.map(t => (
                <button key={t.id} type="button" onClick={() => setType(t.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs transition-all cursor-pointer ${
                    type === t.id
                      ? 'text-white font-semibold'
                      : 'text-gray-500 hover:text-gray-300 border border-white/[0.07] hover:border-white/[0.12]'
                  }`}
                  style={type === t.id
                    ? { background: 'linear-gradient(135deg, #3b82f6, #6366f1)' }
                    : { background: 'var(--surface-2)' }}>
                  {t.label}
                  <span className="text-[9px] ml-1.5 opacity-55">{t.desc}</span>
                </button>
              ))}
            </div>

            <div className="flex gap-2">
              <input
                type="text"
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="What would you like to research?"
                required
                className="flex-1 px-3 py-2 rounded-lg text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-blue-500/40 transition-colors"
                style={{ background: 'var(--surface-2)', border: '1px solid rgba(255,255,255,0.08)' }}
              />
              <button
                type="submit"
                disabled={running || !query.trim()}
                className="px-4 py-2 text-white text-sm font-semibold rounded-lg transition-all disabled:opacity-40 hover:opacity-90 flex-shrink-0 flex items-center gap-2 cursor-pointer disabled:cursor-default"
                style={{ background: 'linear-gradient(135deg, #3b82f6, #6366f1)' }}
              >
                {running && (
                  <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                )}
                {running ? 'Researching…' : 'Research'}
              </button>
            </div>

            <div className="flex items-center gap-1.5 text-[10px] text-gray-700">
              <svg className="w-3 h-3 text-amber-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
              </svg>
              Queries are classified before external dispatch. Confidential and restricted content is blocked.
            </div>
          </form>

          {/* ── Empty state (before first search) ──────────────────────── */}
          {!result && !error && !running && (
            <div className="rounded-2xl border border-white/[0.06] p-8 text-center"
              style={{ background: 'var(--surface-2)' }}>
              <div className="w-10 h-10 rounded-xl flex items-center justify-center mx-auto mb-4"
                style={{ background: 'rgba(6,182,212,0.08)', border: '1px solid rgba(6,182,212,0.18)' }}>
                <svg className="w-5 h-5 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              <p className="text-sm font-semibold text-white mb-2">Policy-aware web research</p>
              <p className="text-[12px] text-gray-500 leading-relaxed max-w-sm mx-auto">
                Research requests are filtered through governance and data classification rules
                before being dispatched to external search APIs. Your confidential data stays inside.
              </p>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="rounded-xl border border-red-500/20 p-4"
              style={{ background: 'rgba(239,68,68,0.06)' }}>
              <p className="text-sm text-red-400">{error}</p>
            </div>
          )}

          {/* Results */}
          {result && (
            <div className="space-y-4">
              {/* Demo mode notice */}
              {result.content.includes('Demo Mode') && (
                <div className="rounded-xl border border-amber-500/20 p-4 flex items-start gap-3"
                  style={{ background: 'rgba(245,158,11,0.06)' }}>
                  <svg className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                  </svg>
                  <div>
                    <p className="text-xs text-amber-400 font-semibold mb-0.5">Research provider not configured</p>
                    <p className="text-[11px] text-amber-600 leading-relaxed">
                      Add <code className="bg-amber-900/30 px-1 rounded font-mono">PERPLEXITY_API_KEY</code> to <code className="bg-amber-900/30 px-1 rounded font-mono">backend/.env</code> to enable live web-grounded research with citations.
                    </p>
                  </div>
                </div>
              )}
              <div className="rounded-xl border border-white/[0.06] p-6"
                style={{ background: 'var(--surface-2)' }}>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xs font-semibold text-white uppercase tracking-wider">Research Results</h2>
                  <div className="flex items-center gap-2 text-[10px] text-gray-600">
                    <div className="flex items-center gap-1.5">
                      <div className={`w-1 h-1 rounded-full ${result.content.includes('Demo Mode') ? 'bg-amber-600' : 'bg-emerald-600'}`} />
                      {result.content.includes('Demo Mode') ? 'Demo mode' : 'Governed inference'}
                    </div>
                    {!result.content.includes('Demo Mode') && (
                      <><span className="text-gray-700">·</span>
                      <span>${result.cost_usd.toFixed(6)}</span></>
                    )}
                  </div>
                </div>
                <div className="text-sm text-gray-300 prose-chat whitespace-pre-wrap leading-relaxed">
                  {result.content}
                </div>
              </div>

              {result.citations.length > 0 && (
                <div className="rounded-xl border border-white/[0.06] p-4"
                  style={{ background: 'var(--surface-2)' }}>
                  <h3 className="text-[9px] font-semibold text-gray-600 uppercase tracking-widest mb-3">
                    Sources ({result.citations.length})
                  </h3>
                  <div className="space-y-2.5">
                    {result.citations.map((c, i) => (
                      <div key={i} className="flex items-start gap-2">
                        <span className="text-[9px] text-gray-700 mt-0.5 font-mono flex-shrink-0">[{i + 1}]</span>
                        <div className="min-w-0">
                          {c.url ? (
                            <a href={c.url} target="_blank" rel="noopener noreferrer"
                              className="text-xs text-blue-400 hover:text-blue-300 hover:underline transition-colors truncate block">
                              {c.title || c.url}
                            </a>
                          ) : (
                            <p className="text-xs text-gray-400 truncate">{c.title || 'Source'}</p>
                          )}
                          {c.snippet && (
                            <p className="text-[10px] text-gray-600 mt-0.5 line-clamp-2">{c.snippet}</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <LogoutButton />
    </div>
  )
}
