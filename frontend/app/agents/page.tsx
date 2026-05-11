'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'
import AppNav from '@/components/AppNav'
import LogoutButton from '@/components/LogoutButton'
import { api } from '@/lib/api'
import { Agent } from '@/lib/types'

export default function AgentsPage() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const [agents, setAgents]   = useState<Agent[]>([])
  const [loadingData, setLoadingData] = useState(true)
  const [selected, setSelected] = useState<Agent | null>(null)
  const [message, setMessage] = useState('')
  const [running, setRunning] = useState(false)
  const [response, setResponse] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState({ name: '', description: '', system_prompt: '', model: 'claude_sonnet' })

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
    try {
      const res = await api.runAgent(selected.id, { message })
      const d = res.data as { response: string }
      setResponse(d.response)
      setMessage('')
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || 'Run failed.'
      setResponse(`Error: ${msg}`)
    } finally {
      setRunning(false)
    }
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    await api.createAgent(form)
    const r = await api.getAgents()
    setAgents(r.data as Agent[])
    setShowCreate(false)
    setForm({ name: '', description: '', system_prompt: '', model: 'claude_sonnet' })
  }

  if (loading || !user) return null

  const builtin = agents.filter(a => a.agent_type === 'builtin')
  const custom   = agents.filter(a => a.agent_type === 'user_created')

  return (
    <div className="flex flex-col h-full bg-gray-950">
      <div className="flex-shrink-0 border-b border-gray-800 px-4 py-2.5 flex items-center gap-3">
        <div className="flex items-center gap-1.5">
          <div className="w-5 h-5 rounded bg-blue-600 flex items-center justify-center text-xs font-bold text-white">A</div>
          <span className="text-sm font-semibold text-white hidden sm:block">Aegis Lite</span>
        </div>
        <div className="w-px h-4 bg-gray-800 hidden sm:block" />
        <AppNav currentPage="/agents" />
        <button
          onClick={() => setShowCreate(!showCreate)}
          className="ml-auto px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium rounded-lg"
        >
          + Agent
        </button>
      </div>

      <div className="flex flex-1 min-h-0">
        {/* Agent list */}
        <div className="w-72 flex-shrink-0 border-r border-gray-800 overflow-y-auto">
          {/* Create form */}
          {showCreate && (
            <form onSubmit={handleCreate} className="p-4 border-b border-gray-800 space-y-2 bg-gray-900/50">
              <p className="text-xs font-semibold text-gray-300">New Agent</p>
              {[
                { key: 'name', label: 'Name', placeholder: 'My Agent' },
                { key: 'description', label: 'Description', placeholder: 'What does it do?' },
                { key: 'system_prompt', label: 'System Prompt', placeholder: 'You are...' },
              ].map(({ key, label, placeholder }) => (
                <div key={key}>
                  <label className="text-[10px] text-gray-500">{label}</label>
                  <input
                    value={form[key as keyof typeof form]}
                    onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                    placeholder={placeholder}
                    required
                    className="w-full mt-0.5 px-2 py-1.5 bg-gray-800 border border-gray-700 rounded text-xs text-gray-200 placeholder-gray-600 focus:outline-none focus:border-blue-600"
                  />
                </div>
              ))}
              <div className="flex gap-2">
                <button type="submit" className="flex-1 py-1.5 bg-blue-600 text-white text-xs rounded">Create</button>
                <button type="button" onClick={() => setShowCreate(false)} className="px-2 text-gray-500 text-xs">Cancel</button>
              </div>
            </form>
          )}

          {/* Built-in */}
          {builtin.length > 0 && (
            <div>
              <p className="px-4 py-2 text-[10px] text-gray-600 uppercase tracking-wider">Built-in</p>
              {builtin.map(a => (
                <button
                  key={a.id}
                  onClick={() => { setSelected(a); setResponse('') }}
                  className={`w-full text-left px-4 py-3 border-b border-gray-800/50 transition-colors ${
                    selected?.id === a.id ? 'bg-blue-600/10 border-l-2 border-l-blue-500' : 'hover:bg-gray-900'
                  }`}
                >
                  <p className="text-xs font-medium text-gray-200">{a.name}</p>
                  <p className="text-[10px] text-gray-500 mt-0.5 truncate">{a.description}</p>
                </button>
              ))}
            </div>
          )}

          {/* Custom */}
          {custom.length > 0 && (
            <div>
              <p className="px-4 py-2 text-[10px] text-gray-600 uppercase tracking-wider">Custom</p>
              {custom.map(a => (
                <button
                  key={a.id}
                  onClick={() => { setSelected(a); setResponse('') }}
                  className={`w-full text-left px-4 py-3 border-b border-gray-800/50 transition-colors ${
                    selected?.id === a.id ? 'bg-blue-600/10 border-l-2 border-l-blue-500' : 'hover:bg-gray-900'
                  }`}
                >
                  <p className="text-xs font-medium text-gray-200">{a.name}</p>
                  <p className="text-[10px] text-gray-500 mt-0.5 truncate">{a.description}</p>
                </button>
              ))}
            </div>
          )}

          {loadingData && <p className="px-4 py-4 text-xs text-gray-500">Loading…</p>}
        </div>

        {/* Run panel */}
        <div className="flex-1 flex flex-col">
          {!selected ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <p className="text-sm text-gray-400 mb-1">Select an agent to run</p>
                <p className="text-xs text-gray-600">Built-in agents are governed and budget-limited.</p>
              </div>
            </div>
          ) : (
            <>
              <div className="border-b border-gray-800 px-6 py-4">
                <h2 className="text-sm font-semibold text-white">{selected.name}</h2>
                <p className="text-xs text-gray-500 mt-0.5">{selected.description}</p>
                <div className="flex items-center gap-2 mt-1.5">
                  <span className="text-[10px] text-gray-600">Model: {selected.model}</span>
                  {selected.budget_limit_usd && (
                    <span className="text-[10px] text-gray-600">Budget: ${selected.budget_limit_usd}/run</span>
                  )}
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-6">
                {response && (
                  <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 mb-4">
                    <p className="text-[10px] text-gray-500 mb-2 uppercase tracking-wider">Response</p>
                    <div className="text-sm text-gray-200 prose-chat whitespace-pre-wrap">{response}</div>
                  </div>
                )}
              </div>

              <div className="border-t border-gray-800 p-4">
                <div className="flex gap-2">
                  <textarea
                    value={message}
                    onChange={e => setMessage(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleRun() } }}
                    placeholder={`Message ${selected.name}…`}
                    rows={2}
                    className="flex-1 px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-sm text-gray-200 placeholder-gray-600 resize-none focus:outline-none focus:border-blue-600"
                  />
                  <button
                    onClick={handleRun}
                    disabled={!message.trim() || running}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-sm font-medium rounded-lg transition-colors"
                  >
                    {running ? '…' : 'Run'}
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
