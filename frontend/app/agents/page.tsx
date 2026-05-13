'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'
import AppNav from '@/components/AppNav'
import LogoutButton from '@/components/LogoutButton'
import { api } from '@/lib/api'
import { Agent } from '@/lib/types'

// Abstracted tier label — hides raw provider model IDs.
function agentTierLabel(model: string): string {
  if (model.includes('opus'))    return 'Premium · restricted to admin'
  if (model.includes('sonnet'))  return 'Standard · governed'
  if (model.includes('gpt-4o-mini') || model.includes('gpt4o_mini')) return 'Budget · governed'
  if (model.includes('mistral') || model.includes('llama') || model.includes('gemini')) return 'Free tier · governed'
  return 'Governed inference'
}

export default function AgentsPage() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const [agents, setAgents]         = useState<Agent[]>([])
  const [loadingData, setLoadingData] = useState(true)
  const [selected, setSelected]     = useState<Agent | null>(null)
  const [message, setMessage]       = useState('')
  const [running, setRunning]       = useState(false)
  const [response, setResponse]     = useState('')
  const [runError, setRunError]     = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [creating, setCreating]     = useState(false)
  const [createError, setCreateError] = useState('')
  const [form, setForm]             = useState({ name: '', description: '', system_prompt: '', model: 'llama3' })

  useEffect(() => {
    if (!loading && !user) router.replace('/login')
    if (!loading && user && !user.training_completed) router.replace('/training')
  }, [user, loading, router])

  useEffect(() => {
    if (!user) return
    api.getAgents()
      .then(r => setAgents(r.data as Agent[]))
      .catch(() => {})
      .finally(() => setLoadingData(false))
  }, [user])

  const handleRun = async () => {
    if (!selected || !message.trim()) return
    setRunning(true)
    setResponse('')
    setRunError('')
    try {
      const res = await api.runAgent(selected.id, { message })
      const d = res.data as { response: string }
      setResponse(d.response)
      setMessage('')
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || 'Execution failed.'
      setRunError(msg)
    } finally {
      setRunning(false)
    }
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    setCreating(true)
    setCreateError('')
    try {
      await api.createAgent(form)
      const r = await api.getAgents()
      setAgents(r.data as Agent[])
      setShowCreate(false)
      setForm({ name: '', description: '', system_prompt: '', model: 'llama3' })
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
        || 'Failed to create agent. Check your inputs and try again.'
      setCreateError(msg)
    } finally {
      setCreating(false)
    }
  }

  if (loading || !user) return null

  const builtin = agents.filter(a => a.agent_type === 'builtin')
  const custom  = agents.filter(a => a.agent_type === 'user_created')

  return (
    <div className="flex flex-col h-full" style={{ background: 'var(--surface-1)' }}>

      {/* Header */}
      <div className="flex-shrink-0 border-b border-white/[0.06] px-4 py-2.5 flex items-center gap-3"
        style={{ background: 'rgba(7,7,15,0.8)', backdropFilter: 'blur(12px)' }}>
        <div className="logo-mark flex-shrink-0" style={{ width: 20, height: 20, fontSize: 10, borderRadius: 6 }}>A</div>
        <span className="text-sm font-semibold text-white hidden sm:block">Aegis Lite</span>
        <div className="divider hidden sm:block" style={{ height: 16 }} />
        <AppNav currentPage="/agents" />
        <button
          onClick={() => setShowCreate(!showCreate)}
          className="ml-auto px-3 py-1.5 text-white text-xs font-medium rounded-lg transition-all hover:opacity-90 cursor-pointer"
          style={{ background: 'linear-gradient(135deg, #3b82f6, #6366f1)' }}>
          + Agent
        </button>
      </div>

      <div className="flex flex-1 min-h-0">

        {/* ── Agent list panel ──────────────────────────────────────────── */}
        <div className={`${selected ? 'hidden md:flex' : 'flex'} flex-col w-full md:w-72 flex-shrink-0 border-r border-white/[0.06] overflow-y-auto`}
          style={{ background: 'var(--surface-2)' }}>

          {/* Create form */}
          {showCreate && (
            <form onSubmit={handleCreate} className="p-4 border-b border-white/[0.06] space-y-2.5"
              style={{ background: 'var(--surface-3)' }}>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">New Governed Agent</p>
              {[
                { key: 'name',          label: 'Name',          placeholder: 'My Agent' },
                { key: 'description',   label: 'Description',   placeholder: 'What does it do?' },
                { key: 'system_prompt', label: 'System Prompt', placeholder: 'You are a governed assistant…' },
              ].map(({ key, label, placeholder }) => (
                <div key={key}>
                  <label className="text-[10px] text-gray-600 block mb-1">{label}</label>
                  <input
                    value={form[key as keyof typeof form]}
                    onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                    placeholder={placeholder}
                    required
                    className="w-full px-2.5 py-1.5 rounded-lg text-xs text-gray-200 placeholder-gray-600 focus:outline-none focus:border-blue-500/40 transition-colors"
                    style={{ background: 'var(--surface-2)', border: '1px solid rgba(255,255,255,0.08)' }}
                  />
                </div>
              ))}
              {createError && (
                <p className="text-[10px] text-red-400 px-1">{createError}</p>
              )}
              <div className="flex gap-2 pt-1">
                <button type="submit" disabled={creating}
                  className="flex-1 py-1.5 text-white text-xs font-semibold rounded-lg disabled:opacity-50 transition-all hover:opacity-90 cursor-pointer"
                  style={{ background: 'linear-gradient(135deg, #3b82f6, #6366f1)' }}>
                  {creating ? 'Creating…' : 'Create agent'}
                </button>
                <button type="button" onClick={() => { setShowCreate(false); setCreateError('') }}
                  className="px-3 text-gray-500 hover:text-gray-300 text-xs transition-colors cursor-pointer">
                  Cancel
                </button>
              </div>
            </form>
          )}

          {/* Built-in agents */}
          {loadingData ? (
            <div className="px-4 py-6 space-y-2">
              {[80, 60, 70].map((w, i) => (
                <div key={i} className="skeleton h-10" style={{ width: `${w}%` }} />
              ))}
            </div>
          ) : (
            <>
              {builtin.length > 0 && (
                <div>
                  <p className="px-4 py-2.5 text-[9px] text-gray-600 uppercase tracking-widest font-semibold border-b border-white/[0.04]">
                    Built-in
                  </p>
                  {builtin.map(a => (
                    <button key={a.id}
                      onClick={() => { setSelected(a); setResponse(''); setRunError('') }}
                      className={`w-full text-left px-4 py-3 border-b border-white/[0.03] transition-colors cursor-pointer ${
                        selected?.id === a.id
                          ? 'border-l-2 border-l-blue-500'
                          : 'hover:bg-white/[0.03]'
                      }`}
                      style={selected?.id === a.id ? { background: 'rgba(59,130,246,0.06)' } : {}}>
                      <p className="text-xs font-medium text-gray-200">{a.name}</p>
                      <p className="text-[10px] text-gray-500 mt-0.5 truncate">{a.description}</p>
                    </button>
                  ))}
                </div>
              )}

              {custom.length > 0 && (
                <div>
                  <p className="px-4 py-2.5 text-[9px] text-gray-600 uppercase tracking-widest font-semibold border-b border-white/[0.04]">
                    Custom
                  </p>
                  {custom.map(a => (
                    <button key={a.id}
                      onClick={() => { setSelected(a); setResponse(''); setRunError('') }}
                      className={`w-full text-left px-4 py-3 border-b border-white/[0.03] transition-colors cursor-pointer ${
                        selected?.id === a.id
                          ? 'border-l-2 border-l-blue-500'
                          : 'hover:bg-white/[0.03]'
                      }`}
                      style={selected?.id === a.id ? { background: 'rgba(59,130,246,0.06)' } : {}}>
                      <p className="text-xs font-medium text-gray-200">{a.name}</p>
                      <p className="text-[10px] text-gray-500 mt-0.5 truncate">{a.description}</p>
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        {/* ── Run panel ─────────────────────────────────────────────────── */}
        <div className={`${selected ? 'flex' : 'hidden md:flex'} flex-1 flex-col min-w-0`}>
          {!selected ? (
            /* ── Empty state ──────────────────────────────────────────────── */
            <div className="flex-1 flex items-center justify-center px-8">
              <div className="text-center max-w-xs">
                <div className="w-11 h-11 rounded-2xl flex items-center justify-center mx-auto mb-4"
                  style={{ background: 'rgba(139,92,246,0.08)', border: '1px solid rgba(139,92,246,0.18)' }}>
                  <svg className="w-5 h-5 text-violet-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 3H5a2 2 0 00-2 2v4m6-6h10a2 2 0 012 2v4M9 3v18m0 0h10a2 2 0 002-2V9M9 21H5a2 2 0 01-2-2V9m0 0h18" />
                  </svg>
                </div>
                <h3 className="text-sm font-semibold text-white mb-2">Select an agent</h3>
                <p className="text-[12px] text-gray-500 leading-relaxed">
                  Inspect execution policy, model allowlists, and budget limits before running.
                  Every agent execution is policy-checked and logged to the audit trail.
                </p>
              </div>
            </div>
          ) : (
            <>
              {/* Agent detail header */}
              <div className="border-b border-white/[0.06] px-4 md:px-6 py-3 md:py-4 flex-shrink-0">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-2">
                    {/* Mobile back button */}
                    <button onClick={() => setSelected(null)}
                      className="md:hidden mt-0.5 text-gray-500 hover:text-gray-300 transition-colors cursor-pointer flex-shrink-0">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                      </svg>
                    </button>
                    <div>
                      <h2 className="text-sm font-semibold text-white">{selected.name}</h2>
                      <p className="text-[12px] text-gray-500 mt-0.5 leading-relaxed">{selected.description}</p>
                    </div>
                  </div>
                  {selected.agent_type === 'builtin' && (
                    <span className="badge badge-info flex-shrink-0">Built-in</span>
                  )}
                </div>
                <div className="flex items-center gap-3 mt-3 flex-wrap">
                  <div className="flex items-center gap-1.5 text-[10px] text-gray-600">
                    <svg className="w-3 h-3 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.955 11.955 0 002.25 12c0 3.072 1.15 5.877 3.047 7.987A11.952 11.952 0 0012 21.75a11.95 11.95 0 006.98-2.26A11.96 11.96 0 0021.75 12c0-2.044-.51-3.97-1.41-5.657A11.956 11.956 0 0012 4.964z" />
                    </svg>
                    {agentTierLabel(selected.model)}
                  </div>
                  {selected.budget_limit_usd && (
                    <div className="flex items-center gap-1.5 text-[10px] text-gray-600">
                      <svg className="w-3 h-3 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      Budget limit: ${selected.budget_limit_usd} / run
                    </div>
                  )}
                  <div className="flex items-center gap-1.5 text-[10px] text-gray-600">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
                    Audit logging active
                  </div>
                </div>
              </div>

              {/* Response area */}
              <div className="flex-1 overflow-y-auto p-6">
                {!response && !runError && !running && (
                  <div className="flex items-center justify-center h-full">
                    <p className="text-[11px] text-gray-700">
                      Send a message below to execute this governed agent.
                    </p>
                  </div>
                )}
                {running && (
                  <div className="flex items-center gap-3 px-4 py-3 rounded-xl border border-white/[0.06]"
                    style={{ background: 'var(--surface-2)' }}>
                    <svg className="w-4 h-4 text-blue-400 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    <span className="text-[11px] text-gray-500">Policy engine evaluating request…</span>
                  </div>
                )}
                {runError && (
                  <div className="px-4 py-3 rounded-xl border border-red-500/20 text-xs text-red-400"
                    style={{ background: 'rgba(239,68,68,0.06)' }}>
                    {runError}
                  </div>
                )}
                {response && !runError && (
                  <div className="rounded-xl border border-white/[0.06] p-5"
                    style={{ background: 'var(--surface-2)' }}>
                    <p className="text-[9px] text-gray-600 uppercase tracking-widest mb-3 font-semibold">Governed Response</p>
                    <div className="text-sm text-gray-200 prose-chat whitespace-pre-wrap leading-relaxed">{response}</div>
                  </div>
                )}
              </div>

              {/* Input */}
              <div className="border-t border-white/[0.06] p-4 flex-shrink-0">
                <div className="flex gap-2">
                  <textarea
                    value={message}
                    onChange={e => setMessage(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleRun() } }}
                    placeholder={`Send a request to ${selected.name}…`}
                    rows={2}
                    disabled={running}
                    className="flex-1 px-3 py-2 rounded-lg text-sm text-gray-200 placeholder-gray-600 resize-none focus:outline-none focus:border-blue-500/40 disabled:opacity-50 transition-colors"
                    style={{ background: 'var(--surface-2)', border: '1px solid rgba(255,255,255,0.08)' }}
                  />
                  <button
                    onClick={handleRun}
                    disabled={!message.trim() || running}
                    className="px-4 py-2 text-white text-sm font-semibold rounded-lg transition-all disabled:opacity-30 hover:opacity-90 cursor-pointer disabled:cursor-default"
                    style={{ background: 'linear-gradient(135deg, #3b82f6, #6366f1)' }}
                  >
                    {running ? (
                      <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                    ) : 'Run'}
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      <LogoutButton />
    </div>
  )
}
