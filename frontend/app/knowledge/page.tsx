'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'
import AppNav from '@/components/AppNav'
import LogoutButton from '@/components/LogoutButton'
import { api } from '@/lib/api'
import { KnowledgeAsset, KnowledgeAssetType, KnowledgeAssetStatus } from '@/lib/types'

const TYPE_LABELS: Record<string, string> = {
  sop:              'SOP',
  research:         'Research',
  policy:           'Policy',
  compliance:       'Compliance',
  risk_assessment:  'Risk',
  presentation:     'Presentation',
  other:            'Other',
}

const TYPE_COLORS: Record<string, string> = {
  sop:             '#6366f1',
  research:        '#10b981',
  policy:          '#3b82f6',
  compliance:      '#f97316',
  risk_assessment: '#ef4444',
  presentation:    '#8b5cf6',
  other:           '#6b7280',
}

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  draft:          { label: 'Draft',          color: '#6b7280' },
  pending_review: { label: 'Pending Review', color: '#fbbf24' },
  approved:       { label: 'Approved',       color: '#3b82f6' },
  published:      { label: 'Published',      color: '#10b981' },
  deprecated:     { label: 'Deprecated',     color: '#ef4444' },
}

type SaveForm = { title: string; type: KnowledgeAssetType; content: string; summary: string; tags: string }

export default function KnowledgePage() {
  const { user, loading } = useAuth()
  const router = useRouter()

  const [assets, setAssets]           = useState<KnowledgeAsset[]>([])
  const [loadingData, setLoadingData] = useState(true)
  const [selected, setSelected]       = useState<KnowledgeAsset | null>(null)
  const [typeFilter, setTypeFilter]   = useState<string>('all')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [showCreate, setShowCreate]   = useState(false)
  const [creating, setCreating]       = useState(false)
  const [createError, setCreateError] = useState('')
  const [publishing, setPublishing]   = useState(false)
  const [form, setForm] = useState<SaveForm>({
    title: '', type: 'other', content: '', summary: '', tags: '',
  })

  useEffect(() => {
    if (!loading && !user) router.replace('/login')
    if (!loading && user && !user.training_completed) router.replace('/training')
  }, [user, loading, router])

  const loadAssets = () => {
    if (!user) return
    setLoadingData(true)
    const params: Record<string, string> = {}
    if (typeFilter !== 'all') params.type = typeFilter
    if (statusFilter !== 'all') params.status = statusFilter
    api.getKnowledge(params)
      .then(r => setAssets(r.data as KnowledgeAsset[]))
      .catch(() => {})
      .finally(() => setLoadingData(false))
  }

  useEffect(() => { loadAssets() }, [user, typeFilter, statusFilter]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    setCreating(true)
    setCreateError('')
    try {
      await api.createKnowledgeAsset({
        title:   form.title,
        type:    form.type,
        content: form.content,
        summary: form.summary || null,
        tags:    form.tags ? form.tags.split(',').map(s => s.trim()).filter(Boolean) : null,
      })
      loadAssets()
      setShowCreate(false)
      setForm({ title: '', type: 'other', content: '', summary: '', tags: '' })
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || 'Failed to save.'
      setCreateError(msg)
    } finally {
      setCreating(false)
    }
  }

  const handlePublish = async (id: string) => {
    setPublishing(true)
    try {
      await api.publishKnowledgeAsset(id)
      loadAssets()
      if (selected?.id === id) {
        const r = await api.getKnowledgeAsset(id)
        setSelected(r.data as KnowledgeAsset)
      }
    } finally {
      setPublishing(false)
    }
  }

  const handleReuse = async (id: string) => {
    await api.reuseKnowledgeAsset(id)
    setAssets(prev => prev.map(a => a.id === id ? { ...a, reuse_count: a.reuse_count + 1 } : a))
    if (selected?.id === id) setSelected(s => s ? { ...s, reuse_count: s.reuse_count + 1 } : s)
  }

  if (loading || !user) return null

  const statusCfg = (status: KnowledgeAssetStatus) => STATUS_CONFIG[status] || STATUS_CONFIG.draft

  return (
    <div className="flex flex-col h-full" style={{ background: 'var(--surface-1)' }}>

      {/* Header */}
      <div className="flex-shrink-0 border-b border-white/[0.06] px-4 py-2.5 flex items-center gap-3"
        style={{ background: 'rgba(7,7,15,0.8)', backdropFilter: 'blur(12px)' }}>
        <div className="logo-mark flex-shrink-0" style={{ width: 20, height: 20, fontSize: 10, borderRadius: 6 }}>A</div>
        <span className="text-sm font-semibold hidden sm:block" style={{ color: '#e8c44a', letterSpacing: '0.01em' }}>Aegis Lite</span>
        <div className="divider hidden sm:block" style={{ height: 16 }} />
        <AppNav currentPage="/knowledge" />
        <button
          onClick={() => setShowCreate(!showCreate)}
          className="ml-auto px-3 py-1.5 text-white text-xs font-medium rounded-lg transition-all hover:opacity-90 cursor-pointer flex-shrink-0"
          style={{ background: 'linear-gradient(135deg, #10b981, #059669)' }}>
          + Save Output
        </button>
      </div>

      {/* Page intro */}
      <div className="flex-shrink-0 px-4 py-2 flex items-start gap-2"
        style={{ background: 'var(--surface-2)', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
        <div className="w-1 h-3 rounded-full mt-0.5 flex-shrink-0" style={{ background: 'rgba(16,185,129,0.5)' }} />
        <p className="text-[11px] text-gray-600 leading-relaxed">
          <span className="text-gray-400 font-medium">Knowledge</span> is your org&apos;s library of AI-generated outputs — research, SOPs, policies, and insights saved from Chat or Research sessions.
          {user.role === 'admin' && <span className="text-emerald-600/70"> Admins review and publish assets for the whole organization.</span>}
        </p>
      </div>

      <div className="flex flex-1 min-h-0">

        {/* ── Left sidebar ───────────────────────────────────────────────── */}
        <div className={`${selected ? 'hidden md:flex' : 'flex'} flex-col w-full md:w-64 flex-shrink-0 border-r border-white/[0.06] overflow-y-auto`}
          style={{ background: 'var(--surface-2)' }}>

          {/* Save form */}
          {showCreate && (
            <form onSubmit={handleCreate} className="p-4 border-b border-white/[0.06] space-y-2.5"
              style={{ background: 'var(--surface-3)' }}>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">Save Knowledge Asset</p>
              <div>
                <label className="text-[10px] text-gray-600 block mb-1">Title *</label>
                <input
                  value={form.title}
                  onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                  placeholder="AI Acceptable Use Policy SOP"
                  required
                  className="w-full px-2.5 py-1.5 rounded-lg text-xs text-gray-200 placeholder-gray-600 focus:outline-none"
                  style={{ background: 'var(--surface-2)', border: '1px solid rgba(255,255,255,0.08)' }}
                />
              </div>
              <div>
                <label className="text-[10px] text-gray-600 block mb-1">Type</label>
                <select
                  value={form.type}
                  onChange={e => setForm(f => ({ ...f, type: e.target.value as KnowledgeAssetType }))}
                  className="w-full px-2.5 py-1.5 rounded-lg text-xs text-gray-200 focus:outline-none"
                  style={{ background: 'var(--surface-2)', border: '1px solid rgba(255,255,255,0.08)' }}>
                  {Object.entries(TYPE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[10px] text-gray-600 block mb-1">Summary</label>
                <input
                  value={form.summary}
                  onChange={e => setForm(f => ({ ...f, summary: e.target.value }))}
                  placeholder="One-line description"
                  className="w-full px-2.5 py-1.5 rounded-lg text-xs text-gray-200 placeholder-gray-600 focus:outline-none"
                  style={{ background: 'var(--surface-2)', border: '1px solid rgba(255,255,255,0.08)' }}
                />
              </div>
              <div>
                <label className="text-[10px] text-gray-600 block mb-1">Content *</label>
                <textarea
                  value={form.content}
                  onChange={e => setForm(f => ({ ...f, content: e.target.value }))}
                  placeholder="Paste or type the content to preserve..."
                  required rows={4}
                  className="w-full px-2.5 py-1.5 rounded-lg text-xs text-gray-200 placeholder-gray-600 resize-none focus:outline-none"
                  style={{ background: 'var(--surface-2)', border: '1px solid rgba(255,255,255,0.08)' }}
                />
              </div>
              <div>
                <label className="text-[10px] text-gray-600 block mb-1">Tags (comma-separated)</label>
                <input
                  value={form.tags}
                  onChange={e => setForm(f => ({ ...f, tags: e.target.value }))}
                  placeholder="governance, policy, ai-safety"
                  className="w-full px-2.5 py-1.5 rounded-lg text-xs text-gray-200 placeholder-gray-600 focus:outline-none"
                  style={{ background: 'var(--surface-2)', border: '1px solid rgba(255,255,255,0.08)' }}
                />
              </div>
              {createError && <p className="text-[10px] text-red-400">{createError}</p>}
              <div className="flex gap-2 pt-1">
                <button type="submit" disabled={creating}
                  className="flex-1 py-1.5 text-white text-xs font-semibold rounded-lg disabled:opacity-50 cursor-pointer hover:opacity-90"
                  style={{ background: 'linear-gradient(135deg, #10b981, #059669)' }}>
                  {creating ? 'Saving…' : 'Save'}
                </button>
                <button type="button" onClick={() => { setShowCreate(false); setCreateError('') }}
                  className="px-3 text-gray-500 hover:text-gray-300 text-xs cursor-pointer">
                  Cancel
                </button>
              </div>
            </form>
          )}

          {/* Filters */}
          <div className="p-2 border-b border-white/[0.04] space-y-1">
            <p className="px-1 text-[9px] text-gray-600 uppercase tracking-widest mb-2">Type</p>
            {[['all', 'All Types'], ...Object.entries(TYPE_LABELS)].map(([v, l]) => (
              <button key={v}
                onClick={() => setTypeFilter(v)}
                className={`w-full text-left px-3 py-1.5 rounded-lg text-xs transition-colors cursor-pointer ${
                  typeFilter === v ? 'text-white font-medium' : 'text-gray-500 hover:text-gray-300 hover:bg-white/[0.03]'
                }`}
                style={typeFilter === v ? { background: `${TYPE_COLORS[v] ?? '#6366f1'}18`, color: TYPE_COLORS[v] ?? '#10b981' } : {}}>
                {l}
              </button>
            ))}

            {user.role === 'admin' && (
              <>
                <p className="px-1 text-[9px] text-gray-600 uppercase tracking-widest mt-3 mb-1">Status</p>
                {[['all', 'All'], ['draft', 'Draft'], ['pending_review', 'Pending'], ['published', 'Published']].map(([v, l]) => (
                  <button key={v}
                    onClick={() => setStatusFilter(v)}
                    className={`w-full text-left px-3 py-1.5 rounded-lg text-xs transition-colors cursor-pointer ${
                      statusFilter === v ? 'text-white font-medium' : 'text-gray-500 hover:text-gray-300 hover:bg-white/[0.03]'
                    }`}
                    style={statusFilter === v ? { background: 'rgba(255,255,255,0.06)' } : {}}>
                    {l}
                  </button>
                ))}
              </>
            )}
          </div>

          {/* Asset list */}
          {loadingData ? (
            <div className="p-4 space-y-2">
              {[0, 1, 2].map(i => <div key={i} className="skeleton h-14 rounded-lg" />)}
            </div>
          ) : assets.length === 0 ? (
            <div className="px-4 py-8 text-center">
              <p className="text-xs text-gray-600">No knowledge assets found.</p>
              <button onClick={() => setShowCreate(true)}
                className="mt-2 text-[11px] text-emerald-400 hover:text-emerald-300 cursor-pointer">
                Save your first output →
              </button>
            </div>
          ) : (
            assets.map(a => {
              const sc = statusCfg(a.status)
              const tc = TYPE_COLORS[a.type] || '#6366f1'
              return (
                <button key={a.id}
                  onClick={() => setSelected(a)}
                  className={`w-full text-left px-4 py-3 border-b border-white/[0.03] transition-colors cursor-pointer ${
                    selected?.id === a.id ? 'border-l-2 border-l-emerald-500' : 'hover:bg-white/[0.03]'
                  }`}
                  style={selected?.id === a.id ? { background: 'rgba(16,185,129,0.06)' } : {}}>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[9px] px-1.5 py-0.5 rounded font-semibold uppercase tracking-wider"
                      style={{ background: `${tc}18`, color: tc }}>
                      {TYPE_LABELS[a.type] || a.type}
                    </span>
                    <span className="text-[9px]" style={{ color: sc.color }}>● {sc.label}</span>
                  </div>
                  <p className="text-xs font-medium text-gray-200 leading-snug truncate">{a.title}</p>
                  {a.reuse_count > 0 && (
                    <p className="text-[10px] text-gray-600 mt-0.5">{a.reuse_count} reuse{a.reuse_count !== 1 ? 's' : ''}</p>
                  )}
                </button>
              )
            })
          )}
        </div>

        {/* ── Detail panel ───────────────────────────────────────────────── */}
        <div className={`${selected ? 'flex' : 'hidden md:flex'} flex-1 flex-col min-w-0`}>
          {!selected ? (
            <div className="flex-1 flex items-center justify-center px-8">
              <div className="text-center max-w-xs">
                <div className="w-11 h-11 rounded-2xl flex items-center justify-center mx-auto mb-4"
                  style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.18)' }}>
                  <svg className="w-5 h-5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                  </svg>
                </div>
                <h3 className="text-sm font-semibold text-white mb-2">Knowledge Library</h3>
                <p className="text-[12px] text-gray-500 leading-relaxed">
                  Save AI outputs as reusable knowledge assets. Publish approved work to share with your organization.
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
                        <span className="text-[9px] px-1.5 py-0.5 rounded font-semibold uppercase tracking-wider"
                          style={{ background: `${TYPE_COLORS[selected.type] || '#6366f1'}18`, color: TYPE_COLORS[selected.type] || '#6366f1' }}>
                          {TYPE_LABELS[selected.type] || selected.type}
                        </span>
                        <span className="text-[10px]" style={{ color: statusCfg(selected.status).color }}>
                          ● {statusCfg(selected.status).label}
                        </span>
                        {selected.version > 1 && (
                          <span className="text-[9px] text-gray-600">v{selected.version}</span>
                        )}
                      </div>
                      <h2 className="text-sm font-semibold text-white">{selected.title}</h2>
                      {selected.summary && (
                        <p className="text-[12px] text-gray-500 mt-0.5">{selected.summary}</p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button onClick={() => handleReuse(selected.id)}
                      className="px-3 py-1.5 text-xs text-gray-300 rounded-lg border border-white/[0.08] hover:bg-white/[0.05] cursor-pointer transition-colors">
                      Reuse ↗
                    </button>
                    {user.role === 'admin' && selected.status !== 'published' && (
                      <button
                        onClick={() => handlePublish(selected.id)}
                        disabled={publishing}
                        className="px-3 py-1.5 text-white text-xs font-semibold rounded-lg cursor-pointer hover:opacity-90 disabled:opacity-50 transition-all"
                        style={{ background: 'linear-gradient(135deg, #10b981, #059669)' }}>
                        {publishing ? 'Publishing…' : 'Publish ✓'}
                      </button>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-3 mt-3 flex-wrap">
                  <span className="text-[10px] text-gray-600">{selected.reuse_count} reuses</span>
                  {selected.tags.length > 0 && selected.tags.map(t => (
                    <span key={t} className="text-[9px] px-1.5 py-0.5 rounded text-gray-500"
                      style={{ background: 'rgba(255,255,255,0.05)' }}>
                      {t}
                    </span>
                  ))}
                  {selected.published_at && (
                    <span className="text-[10px] text-gray-600">
                      Published {new Date(selected.published_at).toLocaleDateString()}
                    </span>
                  )}
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-4 md:p-6">
                <div className="rounded-xl border border-white/[0.06] p-5"
                  style={{ background: 'var(--surface-2)' }}>
                  <p className="text-[9px] font-semibold uppercase tracking-widest text-gray-600 mb-3">Content</p>
                  <div className="text-xs text-gray-300 leading-relaxed whitespace-pre-wrap">{selected.content}</div>
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
