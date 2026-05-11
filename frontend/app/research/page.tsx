'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'
import AppNav from '@/components/AppNav'
import LogoutButton from '@/components/LogoutButton'
import { api } from '@/lib/api'

const RESEARCH_TYPES = [
  { id: 'quick',    label: 'Quick',    desc: 'Fast web-grounded Q&A with citations' },
  { id: 'deep',     label: 'Deep',     desc: 'Multi-source synthesis (Sonar Pro)' },
]

export default function ResearchPage() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const [query, setQuery]   = useState('')
  const [type, setType]     = useState('quick')
  const [running, setRunning] = useState(false)
  const [result, setResult] = useState<{
    content: string; model_used: string; cost_usd: number; citations: unknown[]
  } | null>(null)
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
      setResult(res.data as { content: string; model_used: string; cost_usd: number; citations: unknown[] })
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
        || 'Research failed. Check PERPLEXITY_API_KEY is configured.'
      setError(msg)
    } finally {
      setRunning(false)
    }
  }

  if (loading || !user) return null

  return (
    <div className="flex flex-col h-full bg-gray-950">
      <div className="flex-shrink-0 border-b border-gray-800 px-4 py-2.5 flex items-center gap-3">
        <div className="flex items-center gap-1.5">
          <div className="w-5 h-5 rounded bg-blue-600 flex items-center justify-center text-xs font-bold text-white">A</div>
          <span className="text-sm font-semibold text-white hidden sm:block">Aegis Lite</span>
        </div>
        <div className="w-px h-4 bg-gray-800 hidden sm:block" />
        <AppNav currentPage="/research" />
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-3xl mx-auto space-y-6">
          <div>
            <h1 className="text-base font-semibold text-white">AI Research</h1>
            <p className="text-xs text-gray-500 mt-0.5">Web-grounded research via Perplexity with governance enforcement</p>
          </div>

          <form onSubmit={handleSearch} className="space-y-3">
            <div className="flex gap-2">
              {RESEARCH_TYPES.map(t => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setType(t.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs transition-colors ${
                    type === t.id ? 'bg-blue-600 text-white' : 'bg-gray-900 border border-gray-700 text-gray-400 hover:text-gray-200'
                  }`}
                >
                  {t.label}
                  <span className="text-[9px] ml-1 opacity-60">{t.desc}</span>
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
                className="flex-1 px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-blue-600"
              />
              <button
                type="submit"
                disabled={running || !query.trim()}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-sm font-medium rounded-lg transition-colors flex-shrink-0"
              >
                {running ? 'Researching…' : 'Research'}
              </button>
            </div>

            <p className="text-[10px] text-yellow-600">
              Research queries are classified before dispatch. Confidential and restricted content is blocked from external providers.
            </p>
          </form>

          {error && (
            <div className="p-4 bg-red-900/20 border border-red-700/30 rounded-xl">
              <p className="text-sm text-red-400">{error}</p>
            </div>
          )}

          {result && (
            <div className="space-y-4">
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-sm font-semibold text-white">Research Results</h2>
                  <div className="flex items-center gap-2 text-[10px] text-gray-500">
                    <span>{result.model_used}</span>
                    <span>·</span>
                    <span>${result.cost_usd.toFixed(6)}</span>
                  </div>
                </div>
                <div className="text-sm text-gray-300 prose-chat whitespace-pre-wrap leading-relaxed">
                  {result.content}
                </div>
              </div>

              {(result.citations as unknown[]).length > 0 && (
                <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
                  <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
                    Sources ({(result.citations as unknown[]).length})
                  </h3>
                  <div className="space-y-2">
                    {(result.citations as Array<{ url?: string; title?: string; snippet?: string }>).map((c, i) => (
                      <div key={i} className="flex items-start gap-2">
                        <span className="text-[10px] text-gray-600 mt-0.5">[{i + 1}]</span>
                        <div>
                          {c.url ? (
                            <a href={c.url} target="_blank" rel="noopener noreferrer"
                               className="text-xs text-blue-400 hover:underline">
                              {c.title || c.url}
                            </a>
                          ) : (
                            <p className="text-xs text-gray-400">{c.title || 'Source'}</p>
                          )}
                          {c.snippet && <p className="text-[10px] text-gray-600 mt-0.5">{c.snippet}</p>}
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
