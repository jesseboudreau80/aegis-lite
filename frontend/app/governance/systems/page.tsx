'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'
import AppNav from '@/components/AppNav'
import LogoutButton from '@/components/LogoutButton'
import { api } from '@/lib/api'
import { AISystem } from '@/lib/types'

const RISK_BADGE: Record<string, string> = {
  low:      'badge badge-low',
  medium:   'badge badge-medium',
  high:     'badge badge-high',
  critical: 'badge badge-critical',
}

const STATUS_CONFIG: Record<string, { dot: string; label: string; text: string }> = {
  active:     { dot: 'bg-emerald-500', label: 'Active',      text: 'text-emerald-400' },
  draft:      { dot: 'bg-gray-600',    label: 'Draft',        text: 'text-gray-500' },
  deprecated: { dot: 'bg-red-500',     label: 'Deprecated',   text: 'text-red-400' },
}

function LoadingSkeleton() {
  return (
    <div className="card overflow-hidden">
      {[1, 2, 3].map(i => (
        <div key={i} className="px-5 py-4 border-b border-white/[0.04] flex items-center justify-between gap-4">
          <div className="space-y-1.5 flex-1">
            <div className="skeleton h-3.5 w-40" />
            <div className="skeleton h-2.5 w-24" />
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <div className="skeleton h-5 w-16 rounded-full" />
            <div className="skeleton h-4 w-12" />
          </div>
        </div>
      ))}
    </div>
  )
}

export default function SystemsPage() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const [systems, setSystems]         = useState<AISystem[]>([])
  const [loadingData, setLoadingData] = useState(true)
  const [showForm, setShowForm]       = useState(false)
  const [creating, setCreating]       = useState(false)
  const [form, setForm]               = useState({
    name: '', department: '', risk_level: 'medium', model_used: '', description: '',
  })

  useEffect(() => {
    if (!loading && (!user || user.role !== 'admin')) router.replace('/login')
  }, [user, loading, router])

  useEffect(() => {
    if (!user || user.role !== 'admin') return
    api.getSystems()
      .then(res => setSystems(res.data as AISystem[]))
      .catch(() => {})
      .finally(() => setLoadingData(false))
  }, [user])

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    setCreating(true)
    try {
      await api.createSystem(form)
      const res = await api.getSystems()
      setSystems(res.data as AISystem[])
      setShowForm(false)
      setForm({ name: '', department: '', risk_level: 'medium', model_used: '', description: '' })
    } catch { /* silent */ } finally {
      setCreating(false)
    }
  }

  const handleActivate = async (id: string) => {
    try {
      await api.updateSystem(id, { status: 'active' })
      const res = await api.getSystems()
      setSystems(res.data as AISystem[])
    } catch { /* silent */ }
  }

  if (loading || !user || user.role !== 'admin') return null

  const FORM_FIELDS = [
    { key: 'name',        label: 'System name',            placeholder: 'e.g. Customer Support Agent', required: true },
    { key: 'department',  label: 'Department',             placeholder: 'e.g. Customer Success' },
    { key: 'model_used',  label: 'Inference runtime (opt)', placeholder: 'e.g. llama3' },
    { key: 'description', label: 'Description',            placeholder: 'Purpose and scope of this AI system' },
  ]

  return (
    <div className="flex flex-col h-full" style={{ background: 'var(--surface-1)' }}>
      <header className="page-header">
        <div className="logo-mark">A</div>
        <span className="text-sm font-semibold text-white hidden sm:block">Aegis Lite</span>
        <div className="divider hidden sm:block" style={{ height: 16 }} />
        <AppNav currentPage="/governance/systems" />
      </header>

      <div className="flex-1 overflow-y-auto p-5">
        <div className="max-w-4xl mx-auto space-y-5">

          <div className="flex items-start justify-between gap-4 pt-1">
            <div>
              <h1 className="text-base font-semibold text-white">AI System Registry</h1>
              <p className="text-xs text-gray-500 mt-0.5">
                Register and govern AI systems in your organization.
                All registered systems are subject to workspace governance policy.
              </p>
            </div>
            <button
              onClick={() => setShowForm(!showForm)}
              className="px-3 py-1.5 text-white text-xs font-semibold rounded-lg transition-all hover:opacity-90 flex-shrink-0 cursor-pointer"
              style={{ background: 'linear-gradient(135deg, #3b82f6, #6366f1)' }}>
              + Register system
            </button>
          </div>

          {/* Registration form */}
          {showForm && (
            <form onSubmit={handleCreate} className="card p-5 space-y-3">
              <h3 className="text-xs font-semibold text-gray-300">Register AI System</h3>
              {FORM_FIELDS.map(({ key, label, placeholder, required }) => (
                <div key={key}>
                  <label className="block text-[11px] text-gray-500 mb-1.5">{label}</label>
                  <input
                    value={form[key as keyof typeof form]}
                    onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                    placeholder={placeholder}
                    required={required}
                    className="input-base"
                  />
                </div>
              ))}
              <div>
                <label className="block text-[11px] text-gray-500 mb-1.5">Risk classification</label>
                <select
                  value={form.risk_level}
                  onChange={e => setForm(f => ({ ...f, risk_level: e.target.value }))}
                  className="input-base cursor-pointer"
                  style={{ background: 'rgba(255,255,255,0.04)' }}
                >
                  {['low', 'medium', 'high', 'critical'].map(r => (
                    <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>
                  ))}
                </select>
              </div>
              <div className="flex gap-2.5 pt-1">
                <button type="submit" disabled={creating}
                  className="px-4 py-2 text-white text-xs font-semibold rounded-lg disabled:opacity-50 transition-all hover:opacity-90 cursor-pointer"
                  style={{ background: 'linear-gradient(135deg, #3b82f6, #6366f1)' }}>
                  {creating ? 'Registering…' : 'Register system'}
                </button>
                <button type="button" onClick={() => setShowForm(false)}
                  className="px-3 py-2 text-gray-500 hover:text-gray-300 text-xs transition-colors cursor-pointer">
                  Cancel
                </button>
              </div>
            </form>
          )}

          {/* Systems list */}
          {loadingData ? (
            <LoadingSkeleton />
          ) : systems.length === 0 ? (
            <div className="card p-8 text-center">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center mx-auto mb-3 border border-white/[0.06]"
                style={{ background: 'rgba(255,255,255,0.03)' }}>
                <svg className="w-5 h-5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
              </div>
              <p className="text-sm text-gray-400 font-medium mb-1">No systems registered</p>
              <p className="text-[11px] text-gray-600 leading-relaxed">
                Register AI systems to track governance, classify risk levels,
                and apply workspace policies to their inference requests.
              </p>
            </div>
          ) : (
            <div className="card overflow-hidden">
              <div className="px-5 py-2.5 border-b border-white/[0.05] flex items-center justify-between">
                <span className="stat-label">{systems.length} registered {systems.length === 1 ? 'system' : 'systems'}</span>
                <div className="flex items-center gap-3">
                  {systems.filter(s => s.status === 'active').length > 0 && (
                    <div className="flex items-center gap-1.5">
                      <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 pulse-dot" />
                      <span className="text-[10px] text-gray-500">
                        {systems.filter(s => s.status === 'active').length} active
                      </span>
                    </div>
                  )}
                  {systems.filter(s => ['high', 'critical'].includes(s.risk_level)).length > 0 && (
                    <span className="badge badge-high">
                      {systems.filter(s => ['high', 'critical'].includes(s.risk_level)).length} high-risk
                    </span>
                  )}
                </div>
              </div>
              <div className="divide-y divide-white/[0.04]">
                {systems.map(s => {
                  const statusCfg = STATUS_CONFIG[s.status] ?? STATUS_CONFIG.draft
                  return (
                    <div key={s.id}
                      className="px-5 py-3.5 flex items-center justify-between gap-4 hover:bg-white/[0.02] transition-colors">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${statusCfg.dot}`} />
                          <p className="text-xs font-medium text-white truncate">{s.name}</p>
                        </div>
                        <div className="flex items-center gap-2 pl-3.5">
                          {s.department && (
                            <span className="text-[10px] text-gray-600">{s.department}</span>
                          )}
                          {s.model_used && (
                            <span className="text-[10px] text-gray-700 font-mono">· {s.model_used}</span>
                          )}
                          {s.data_classification && (
                            <span className="text-[10px] text-gray-700">· {s.data_classification}</span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2.5 flex-shrink-0">
                        <span className={RISK_BADGE[s.risk_level] ?? RISK_BADGE.medium}>
                          {s.risk_level}
                        </span>
                        <span className={`text-[10px] font-medium ${statusCfg.text}`}>
                          {statusCfg.label}
                        </span>
                        {s.status === 'draft' && (
                          <button onClick={() => handleActivate(s.id)}
                            className="px-2 py-0.5 text-[10px] font-medium rounded-lg border transition-colors cursor-pointer hover:bg-emerald-400/10"
                            style={{ color: '#34d399', borderColor: 'rgba(52,211,153,0.25)' }}>
                            Activate
                          </button>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      </div>
      <LogoutButton />
    </div>
  )
}
