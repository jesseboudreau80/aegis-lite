'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'
import AppNav from '@/components/AppNav'
import LogoutButton from '@/components/LogoutButton'
import { api } from '@/lib/api'
import { Playbook } from '@/lib/types'

const CATEGORIES = ['All', 'compliance', 'operations', 'research', 'legal', 'marketing', 'hr', 'finance']

const CATEGORY_COLORS: Record<string, string> = {
  compliance:  '#6366f1',
  operations:  '#3b82f6',
  research:    '#10b981',
  legal:       '#f97316',
  marketing:   '#ec4899',
  hr:          '#8b5cf6',
  finance:     '#fbbf24',
}

function categoryColor(cat: string | null) {
  return cat ? (CATEGORY_COLORS[cat] ?? '#6366f1') : '#6366f1'
}

type CreateForm = {
  name: string
  description: string
  purpose: string
  instructions: string
  category: string
  visibility: 'private' | 'team' | 'org'
  approved_models: string
}

type LaunchState = { open: boolean; playbook: Playbook | null; context: string; launching: boolean }

export default function PlaybooksPage() {
  const { user, loading } = useAuth()
  const router = useRouter()

  const [playbooks, setPlaybooks]     = useState<Playbook[]>([])
  const [loadingData, setLoadingData] = useState(true)
  const [selected, setSelected]       = useState<Playbook | null>(null)
  const [activeCategory, setActiveCategory] = useState('All')
  const [showCreate, setShowCreate]   = useState(false)
  const [creating, setCreating]       = useState(false)
  const [createError, setCreateError] = useState('')
  const [form, setForm]               = useState<CreateForm>({
    name: '', description: '', purpose: '', instructions: '',
    category: 'compliance', visibility: 'org', approved_models: '',
  })
  const [launch, setLaunch] = useState<LaunchState>({ open: false, playbook: null, context: '', launching: false })
  const [launchError, setLaunchError] = useState('')

  useEffect(() => {
    if (!loading && !user) router.replace('/login')
    if (!loading && user && !user.training_completed) router.replace('/training')
  }, [user, loading, router])

  const loadPlaybooks = () => {
    if (!user) return
    setLoadingData(true)
    api.getPlaybooks({ status: 'active' })
      .then(r => setPlaybooks(r.data as Playbook[]))
      .catch(() => {})
      .finally(() => setLoadingData(false))
  }

  useEffect(() => { loadPlaybooks() }, [user]) // eslint-disable-line react-hooks/exhaustive-deps

  const filtered = activeCategory === 'All'
    ? playbooks
    : playbooks.filter(p => p.category === activeCategory)

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    setCreating(true)
    setCreateError('')
    try {
      await api.createPlaybook({
        name:            form.name,
        description:     form.description || null,
        purpose:         form.purpose || null,
        instructions:    form.instructions || null,
        category:        form.category || null,
        visibility:      form.visibility,
        approved_models: form.approved_models
          ? form.approved_models.split(',').map(s => s.trim()).filter(Boolean)
          : null,
      })
      loadPlaybooks()
      setShowCreate(false)
      setForm({ name: '', description: '', purpose: '', instructions: '', category: 'compliance', visibility: 'org', approved_models: '' })
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || 'Failed to create playbook.'
      setCreateError(msg)
    } finally {
      setCreating(false)
    }
  }

  const handleLaunch = async () => {
    if (!launch.playbook) return
    setLaunch(s => ({ ...s, launching: true }))
    setLaunchError('')
    try {
      const res = await api.launchPlaybook(launch.playbook.id, {
        context: launch.context || null,
        workspace_id: null,
        model: null,
      })
      const d = res.data as { conversation_id: string }
      router.push(`/chat?cid=${d.conversation_id}`)
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || 'Launch failed.'
      setLaunchError(msg)
      setLaunch(s => ({ ...s, launching: false }))
    }
  }

  if (loading || !user) return null

  return (
    <div className="flex flex-col h-full" style={{ background: 'var(--surface-1)' }}>

      {/* Header */}
      <div className="flex-shrink-0 border-b border-white/[0.06] px-4 py-2.5 flex items-center gap-3"
        style={{ background: 'rgba(7,7,15,0.8)', backdropFilter: 'blur(12px)' }}>
        <div className="logo-mark flex-shrink-0" style={{ width: 20, height: 20, fontSize: 10, borderRadius: 6 }}>A</div>
        <span className="text-sm font-semibold hidden sm:block" style={{ color: '#e8c44a', letterSpacing: '0.01em' }}>Aegis Lite</span>
        <div className="divider hidden sm:block" style={{ height: 16 }} />
        <AppNav currentPage="/playbooks" />
        {user.role === 'admin' && (
          <button
            onClick={() => setShowCreate(!showCreate)}
            className="ml-auto px-3 py-1.5 text-white text-xs font-medium rounded-lg transition-all hover:opacity-90 cursor-pointer flex-shrink-0"
            style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}>
            + Playbook
          </button>
        )}
      </div>

      {/* Page intro */}
      <div className="flex-shrink-0 px-4 py-2 flex items-start gap-2"
        style={{ background: 'var(--surface-2)', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
        <div className="w-1 h-3 rounded-full mt-0.5 flex-shrink-0" style={{ background: 'rgba(99,102,241,0.5)' }} />
        <p className="text-[11px] text-gray-600 leading-relaxed">
          <span className="text-gray-400 font-medium">Playbooks</span> are governed AI workflow templates — select one to launch a policy-enforced session with pre-approved models and guardrails.
          {user.role === 'admin' && <span className="text-indigo-600/70"> Admins can create playbooks for the team.</span>}
        </p>
      </div>

      <div className="flex flex-1 min-h-0">

        {/* ── Left sidebar ───────────────────────────────────────────────── */}
        <div className={`${selected ? 'hidden md:flex' : 'flex'} flex-col w-full md:w-64 flex-shrink-0 border-r border-white/[0.06] overflow-y-auto`}
          style={{ background: 'var(--surface-2)' }}>

          {/* Create form */}
          {showCreate && user.role === 'admin' && (
            <form onSubmit={handleCreate} className="p-4 border-b border-white/[0.06] space-y-2.5"
              style={{ background: 'var(--surface-3)' }}>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">New Playbook</p>
              {[
                { key: 'name',         label: 'Name *',        placeholder: 'Compliance Review Playbook' },
                { key: 'description',  label: 'Description',   placeholder: 'What this playbook does' },
                { key: 'purpose',      label: 'Purpose',       placeholder: 'One-paragraph intent...' },
                { key: 'instructions', label: 'Instructions',  placeholder: 'Step-by-step guidance...' },
                { key: 'approved_models', label: 'Approved Models', placeholder: 'claude_sonnet, gpt4o' },
              ].map(({ key, label, placeholder }) => (
                <div key={key}>
                  <label className="text-[10px] text-gray-600 block mb-1">{label}</label>
                  <input
                    value={form[key as keyof CreateForm]}
                    onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                    placeholder={placeholder}
                    required={key === 'name'}
                    className="w-full px-2.5 py-1.5 rounded-lg text-xs text-gray-200 placeholder-gray-600 focus:outline-none transition-colors"
                    style={{ background: 'var(--surface-2)', border: '1px solid rgba(255,255,255,0.08)' }}
                  />
                </div>
              ))}
              <div>
                <label className="text-[10px] text-gray-600 block mb-1">Category</label>
                <select
                  value={form.category}
                  onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                  className="w-full px-2.5 py-1.5 rounded-lg text-xs text-gray-200 focus:outline-none"
                  style={{ background: 'var(--surface-2)', border: '1px solid rgba(255,255,255,0.08)' }}>
                  {CATEGORIES.slice(1).map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              {createError && <p className="text-[10px] text-red-400">{createError}</p>}
              <div className="flex gap-2 pt-1">
                <button type="submit" disabled={creating}
                  className="flex-1 py-1.5 text-white text-xs font-semibold rounded-lg disabled:opacity-50 cursor-pointer hover:opacity-90"
                  style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}>
                  {creating ? 'Creating…' : 'Create'}
                </button>
                <button type="button" onClick={() => { setShowCreate(false); setCreateError('') }}
                  className="px-3 text-gray-500 hover:text-gray-300 text-xs cursor-pointer">
                  Cancel
                </button>
              </div>
            </form>
          )}

          {/* Category filter */}
          <div className="p-2 border-b border-white/[0.04]">
            {CATEGORIES.map(cat => (
              <button key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`w-full text-left px-3 py-1.5 rounded-lg text-xs transition-colors cursor-pointer mb-0.5 ${
                  activeCategory === cat
                    ? 'text-white font-medium'
                    : 'text-gray-500 hover:text-gray-300 hover:bg-white/[0.03]'
                }`}
                style={activeCategory === cat ? { background: 'rgba(99,102,241,0.12)' } : {}}>
                {cat}
              </button>
            ))}
          </div>

          {/* Playbook list */}
          {loadingData ? (
            <div className="p-4 space-y-2">
              {[0, 1, 2].map(i => <div key={i} className="skeleton h-16 rounded-lg" />)}
            </div>
          ) : filtered.length === 0 ? (
            <div className="px-4 py-8 text-center">
              <p className="text-xs text-gray-600">No playbooks in this category.</p>
              {user.role === 'admin' && (
                <button onClick={() => setShowCreate(true)}
                  className="mt-2 text-[11px] text-indigo-400 hover:text-indigo-300 cursor-pointer">
                  Create one →
                </button>
              )}
            </div>
          ) : (
            filtered.map(p => (
              <button key={p.id}
                onClick={() => setSelected(p)}
                className={`w-full text-left px-4 py-3 border-b border-white/[0.03] transition-colors cursor-pointer ${
                  selected?.id === p.id ? 'border-l-2 border-l-indigo-500' : 'hover:bg-white/[0.03]'
                }`}
                style={selected?.id === p.id ? { background: 'rgba(99,102,241,0.06)' } : {}}>
                <div className="flex items-center gap-2 mb-1">
                  {p.category && (
                    <span className="text-[9px] px-1.5 py-0.5 rounded font-semibold uppercase tracking-wider"
                      style={{ background: `${categoryColor(p.category)}18`, color: categoryColor(p.category) }}>
                      {p.category}
                    </span>
                  )}
                </div>
                <p className="text-xs font-medium text-gray-200 leading-snug">{p.name}</p>
                {p.description && (
                  <p className="text-[10px] text-gray-500 mt-0.5 truncate">{p.description}</p>
                )}
                <p className="text-[10px] text-gray-600 mt-1">{p.execution_count} launches</p>
              </button>
            ))
          )}
        </div>

        {/* ── Detail panel ───────────────────────────────────────────────── */}
        <div className={`${selected ? 'flex' : 'hidden md:flex'} flex-1 flex-col min-w-0`}>
          {!selected ? (
            <div className="flex-1 flex items-center justify-center px-8">
              <div className="text-center max-w-xs">
                <div className="w-11 h-11 rounded-2xl flex items-center justify-center mx-auto mb-4"
                  style={{ background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.18)' }}>
                  <svg className="w-5 h-5 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                  </svg>
                </div>
                <h3 className="text-sm font-semibold text-white mb-2">Select a playbook</h3>
                <p className="text-[12px] text-gray-500 leading-relaxed">
                  Playbooks are governed work templates with pre-approved models, agents, and governance rules.
                  Launch one to start a governed session.
                </p>
              </div>
            </div>
          ) : (
            <>
              <div className="border-b border-white/[0.06] px-4 md:px-6 py-4 flex-shrink-0">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-2">
                    <button onClick={() => setSelected(null)}
                      className="md:hidden mt-0.5 text-gray-500 hover:text-gray-300 cursor-pointer flex-shrink-0">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                      </svg>
                    </button>
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        {selected.category && (
                          <span className="text-[9px] px-1.5 py-0.5 rounded font-semibold uppercase tracking-wider"
                            style={{ background: `${categoryColor(selected.category)}18`, color: categoryColor(selected.category) }}>
                            {selected.category}
                          </span>
                        )}
                        <span className="badge badge-info">{selected.visibility}</span>
                      </div>
                      <h2 className="text-sm font-semibold text-white">{selected.name}</h2>
                      {selected.description && (
                        <p className="text-[12px] text-gray-500 mt-0.5">{selected.description}</p>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => { setLaunch({ open: true, playbook: selected, context: '', launching: false }); setLaunchError('') }}
                    className="px-4 py-1.5 text-white text-xs font-semibold rounded-lg flex-shrink-0 cursor-pointer hover:opacity-90 transition-all"
                    style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}>
                    Launch ▶
                  </button>
                </div>

                <div className="flex items-center gap-4 mt-3 flex-wrap">
                  <div className="flex items-center gap-1.5 text-[10px] text-gray-600">
                    <svg className="w-3 h-3 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                    {selected.execution_count} total launches
                  </div>
                  {selected.approved_models.length > 0 && (
                    <div className="flex items-center gap-1.5 text-[10px] text-gray-600">
                      <svg className="w-3 h-3 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      {selected.approved_models.join(', ')}
                    </div>
                  )}
                  <div className="flex items-center gap-1.5 text-[10px] text-gray-600">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
                    Audit logging active
                  </div>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4">
                {selected.purpose && (
                  <div className="rounded-xl p-4 border border-white/[0.06]"
                    style={{ background: 'var(--surface-2)' }}>
                    <p className="text-[9px] font-semibold uppercase tracking-widest text-gray-600 mb-2">Purpose</p>
                    <p className="text-xs text-gray-300 leading-relaxed whitespace-pre-wrap">{selected.purpose}</p>
                  </div>
                )}

                {selected.instructions && (
                  <div className="rounded-xl p-4 border border-white/[0.06]"
                    style={{ background: 'var(--surface-2)' }}>
                    <p className="text-[9px] font-semibold uppercase tracking-widest text-gray-600 mb-2">Instructions</p>
                    <p className="text-xs text-gray-400 leading-relaxed whitespace-pre-wrap">{selected.instructions}</p>
                  </div>
                )}

                {selected.agent_ids.length > 0 && (
                  <div className="rounded-xl p-4 border border-white/[0.06]"
                    style={{ background: 'var(--surface-2)' }}>
                    <p className="text-[9px] font-semibold uppercase tracking-widest text-gray-600 mb-2">Assigned Agents</p>
                    <div className="flex flex-wrap gap-1.5">
                      {selected.agent_ids.map(aid => (
                        <span key={aid} className="px-2 py-0.5 rounded text-[10px] text-violet-300"
                          style={{ background: 'rgba(139,92,246,0.12)' }}>
                          {aid}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {selected.output_standards && (
                  <div className="rounded-xl p-4 border border-white/[0.06]"
                    style={{ background: 'var(--surface-2)' }}>
                    <p className="text-[9px] font-semibold uppercase tracking-widest text-gray-600 mb-2">Output Standards</p>
                    <p className="text-xs text-gray-400 leading-relaxed whitespace-pre-wrap">{selected.output_standards}</p>
                  </div>
                )}

                <div className="rounded-xl p-4 border border-white/[0.06]"
                  style={{ background: 'var(--surface-2)' }}>
                  <p className="text-[9px] font-semibold uppercase tracking-widest text-gray-600 mb-2">Governance</p>
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2 text-[11px] text-gray-400">
                      <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                      PII detection enabled
                    </div>
                    <div className="flex items-center gap-2 text-[11px] text-gray-400">
                      <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                      All outputs audit-logged
                    </div>
                    <div className="flex items-center gap-2 text-[11px] text-gray-400">
                      <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                      Policy engine active
                    </div>
                    {selected.approved_models.length > 0 && (
                      <div className="flex items-center gap-2 text-[11px] text-gray-400">
                        <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                        Model restricted to: {selected.approved_models.join(', ')}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Launch modal */}
      {launch.open && launch.playbook && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4"
          style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}>
          <div className="w-full max-w-md rounded-2xl border border-white/[0.08] p-6 space-y-4"
            style={{ background: 'var(--surface-3)' }}>
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Launch playbook</p>
                <h3 className="text-sm font-semibold text-white">{launch.playbook.name}</h3>
              </div>
              <button onClick={() => setLaunch(s => ({ ...s, open: false }))}
                className="text-gray-500 hover:text-gray-300 cursor-pointer">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div>
              <label className="text-[10px] text-gray-600 block mb-1.5">Additional context (optional)</label>
              <textarea
                value={launch.context}
                onChange={e => setLaunch(s => ({ ...s, context: e.target.value }))}
                placeholder="Any specific context for this session..."
                rows={3}
                className="w-full px-3 py-2 rounded-lg text-xs text-gray-200 placeholder-gray-600 resize-none focus:outline-none"
                style={{ background: 'var(--surface-2)', border: '1px solid rgba(255,255,255,0.08)' }}
              />
            </div>

            <div className="rounded-lg px-3 py-2.5 text-[10px] text-gray-500"
              style={{ background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.15)' }}>
              This playbook enforces policy-engine governance, PII detection, and full audit logging.
              All outputs are traceable.
            </div>

            {launchError && <p className="text-[11px] text-red-400">{launchError}</p>}

            <div className="flex gap-2 pt-1">
              <button
                onClick={handleLaunch}
                disabled={launch.launching}
                className="flex-1 py-2 text-white text-xs font-semibold rounded-lg disabled:opacity-50 cursor-pointer hover:opacity-90 transition-all"
                style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}>
                {launch.launching ? 'Launching…' : 'Launch Playbook ▶'}
              </button>
              <button onClick={() => setLaunch(s => ({ ...s, open: false }))}
                className="px-4 text-gray-500 hover:text-gray-300 text-xs cursor-pointer">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      <LogoutButton />
    </div>
  )
}
