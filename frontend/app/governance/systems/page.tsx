'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'
import AppNav from '@/components/AppNav'
import LogoutButton from '@/components/LogoutButton'
import { api } from '@/lib/api'
import { AISystem } from '@/lib/types'

const RISK_STYLES: Record<string, string> = {
  low:      'text-green-400 bg-green-900/20 border-green-700/30',
  medium:   'text-yellow-400 bg-yellow-900/20 border-yellow-700/30',
  high:     'text-orange-400 bg-orange-900/20 border-orange-700/30',
  critical: 'text-red-400 bg-red-900/20 border-red-700/30',
}

const STATUS_STYLES: Record<string, string> = {
  active:     'text-green-400',
  draft:      'text-gray-400',
  deprecated: 'text-red-400',
}

export default function SystemsPage() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const [systems, setSystems] = useState<AISystem[]>([])
  const [loadingData, setLoadingData] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ name: '', department: '', risk_level: 'medium', model_used: '', description: '' })

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
    await api.createSystem(form)
    const res = await api.getSystems()
    setSystems(res.data as AISystem[])
    setShowForm(false)
    setForm({ name: '', department: '', risk_level: 'medium', model_used: '', description: '' })
  }

  const handleActivate = async (id: string) => {
    await api.updateSystem(id, { status: 'active' })
    const res = await api.getSystems()
    setSystems(res.data as AISystem[])
  }

  if (loading || !user || user.role !== 'admin') return null

  return (
    <div className="flex flex-col h-full bg-gray-950">
      <div className="flex-shrink-0 border-b border-gray-800 px-4 py-2.5 flex items-center gap-3">
        <div className="flex items-center gap-1.5">
          <div className="w-5 h-5 rounded bg-blue-600 flex items-center justify-center text-xs font-bold text-white">A</div>
          <span className="text-sm font-semibold text-white hidden sm:block">Aegis Lite</span>
        </div>
        <div className="w-px h-4 bg-gray-800 hidden sm:block" />
        <AppNav currentPage="/governance/systems" />
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-4xl mx-auto space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-base font-semibold text-white">AI System Registry</h1>
              <p className="text-xs text-gray-500 mt-0.5">Register and govern AI systems in your organization</p>
            </div>
            <button
              onClick={() => setShowForm(!showForm)}
              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium rounded-lg transition-colors"
            >
              Register system
            </button>
          </div>

          {showForm && (
            <form onSubmit={handleCreate} className="bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-3">
              <h3 className="text-sm font-semibold text-white">Register AI System</h3>
              {[
                { key: 'name', label: 'System name', placeholder: 'e.g. Customer Support Bot', required: true },
                { key: 'department', label: 'Department', placeholder: 'e.g. Customer Success' },
                { key: 'model_used', label: 'Model', placeholder: 'e.g. claude_sonnet' },
                { key: 'description', label: 'Description', placeholder: 'What does this system do?' },
              ].map(({ key, label, placeholder, required }) => (
                <div key={key}>
                  <label className="block text-xs text-gray-400 mb-1">{label}</label>
                  <input
                    value={form[key as keyof typeof form]}
                    onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                    placeholder={placeholder}
                    required={required}
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-xs text-gray-200 placeholder-gray-600 focus:outline-none focus:border-blue-600"
                  />
                </div>
              ))}
              <div>
                <label className="block text-xs text-gray-400 mb-1">Risk level</label>
                <select
                  value={form.risk_level}
                  onChange={e => setForm(f => ({ ...f, risk_level: e.target.value }))}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-xs text-gray-200"
                >
                  {['low', 'medium', 'high', 'critical'].map(r => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
              </div>
              <div className="flex gap-3">
                <button type="submit" className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium rounded-lg">
                  Register
                </button>
                <button type="button" onClick={() => setShowForm(false)} className="px-3 py-1.5 text-gray-400 text-xs">
                  Cancel
                </button>
              </div>
            </form>
          )}

          {loadingData ? (
            <div className="text-xs text-gray-500">Loading…</div>
          ) : systems.length === 0 ? (
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-8 text-center">
              <p className="text-sm text-gray-400">No AI systems registered yet.</p>
              <p className="text-xs text-gray-600 mt-1">Register your AI systems to track governance and usage.</p>
            </div>
          ) : (
            <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
              <div className="divide-y divide-gray-800">
                {systems.map(s => (
                  <div key={s.id} className="px-5 py-4 flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <p className="text-sm text-white font-medium">{s.name}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        {s.department && <span className="text-[10px] text-gray-500">{s.department}</span>}
                        {s.model_used && <span className="text-[10px] text-gray-600">· {s.model_used}</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className={`px-1.5 py-0.5 text-[10px] rounded border ${RISK_STYLES[s.risk_level] || RISK_STYLES.medium}`}>
                        {s.risk_level}
                      </span>
                      <span className={`text-xs ${STATUS_STYLES[s.status] || 'text-gray-400'}`}>{s.status}</span>
                      {s.status === 'draft' && (
                        <button
                          onClick={() => handleActivate(s.id)}
                          className="px-2 py-0.5 bg-green-900/30 border border-green-700/30 text-green-400 text-[10px] rounded hover:bg-green-900/50"
                        >
                          Activate
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
      <LogoutButton />
    </div>
  )
}
