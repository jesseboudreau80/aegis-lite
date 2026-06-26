'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'
import AppNav from '@/components/AppNav'
import LogoutButton from '@/components/LogoutButton'
import { api } from '@/lib/api'
import { Workspace, WorkspaceMember } from '@/lib/types'

type ActivityRow = {
  id: string; timestamp: string; actor: string; actor_name: string
  model: string; decision: string; cost: number; event_type: string
}

const RISK_CONFIG: Record<string, { label: string; color: string }> = {
  low:    { label: 'Low Risk',    color: '#10b981' },
  medium: { label: 'Medium Risk', color: '#fbbf24' },
  high:   { label: 'High Risk',   color: '#ef4444' },
}

export default function WorkspacesPage() {
  const { user, loading } = useAuth()
  const router = useRouter()

  const [workspaces, setWorkspaces] = useState<Workspace[]>([])
  const [loadingData, setLoadingData] = useState(true)
  const [selected, setSelected]     = useState<Workspace | null>(null)
  const [activeTab, setActiveTab]   = useState<'overview' | 'members' | 'activity'>('overview')
  const [members, setMembers]       = useState<WorkspaceMember[]>([])
  const [activity, setActivity]     = useState<ActivityRow[]>([])
  const [loadingDetail, setLoadingDetail] = useState(false)

  const [showCreate, setShowCreate] = useState(false)
  const [creating, setCreating]     = useState(false)
  const [createError, setCreateError] = useState('')
  const [createForm, setCreateForm] = useState({ name: '', description: '', budget_limit_usd: '', risk_threshold: 'medium' })

  const [showAddMember, setShowAddMember] = useState(false)
  const [addingMember, setAddingMember]   = useState(false)
  const [memberEmail, setMemberEmail]     = useState('')
  const [memberRole, setMemberRole]       = useState('member')
  const [memberError, setMemberError]     = useState('')

  useEffect(() => {
    if (!loading && !user) router.replace('/login')
    if (!loading && user && !user.training_completed) router.replace('/training')
  }, [user, loading, router])

  const loadWorkspaces = () => {
    if (!user) return
    setLoadingData(true)
    api.getWorkspaces()
      .then(r => setWorkspaces(r.data as Workspace[]))
      .catch(() => {})
      .finally(() => setLoadingData(false))
  }

  useEffect(() => { loadWorkspaces() }, [user]) // eslint-disable-line react-hooks/exhaustive-deps

  const selectWorkspace = async (ws: Workspace) => {
    setSelected(ws)
    setActiveTab('overview')
    setLoadingDetail(true)
    try {
      const [wsDetail, membersRes, activityRes] = await Promise.all([
        api.getWorkspace(ws.id),
        api.getWorkspaceMembers(ws.id),
        api.getWorkspaceActivity(ws.id, 20),
      ])
      setSelected(wsDetail.data as Workspace)
      setMembers(membersRes.data as WorkspaceMember[])
      setActivity(activityRes.data as ActivityRow[])
    } catch { /* non-fatal */ }
    finally { setLoadingDetail(false) }
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    setCreating(true)
    setCreateError('')
    try {
      await api.createWorkspace({
        name:             createForm.name,
        description:      createForm.description || null,
        budget_limit_usd: createForm.budget_limit_usd ? parseFloat(createForm.budget_limit_usd) : null,
        risk_threshold:   createForm.risk_threshold,
      })
      loadWorkspaces()
      setShowCreate(false)
      setCreateForm({ name: '', description: '', budget_limit_usd: '', risk_threshold: 'medium' })
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || 'Failed to create workspace.'
      setCreateError(msg)
    } finally {
      setCreating(false)
    }
  }

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selected) return
    setAddingMember(true)
    setMemberError('')
    try {
      const res = await api.addWorkspaceMember(selected.id, { email: memberEmail, role: memberRole })
      setMembers(prev => [...prev, res.data as WorkspaceMember])
      setMemberEmail('')
      setShowAddMember(false)
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || 'Failed to add member.'
      setMemberError(msg)
    } finally {
      setAddingMember(false)
    }
  }

  const handleRemoveMember = async (wsId: string, userId: string) => {
    await api.removeWorkspaceMember(wsId, userId)
    setMembers(prev => prev.filter(m => m.user_id !== userId))
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
        <AppNav currentPage="/workspaces" />
        <button
          onClick={() => setShowCreate(true)}
          className="ml-auto px-3 py-1.5 text-white text-xs font-medium rounded-lg transition-all hover:opacity-90 cursor-pointer flex-shrink-0"
          style={{ background: 'linear-gradient(135deg, #3b82f6, #6366f1)' }}>
          + Workspace
        </button>
      </div>

      {/* Page intro */}
      <div className="flex-shrink-0 px-4 py-2 flex items-start gap-2"
        style={{ background: 'var(--surface-2)', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
        <div className="w-1 h-3 rounded-full mt-0.5 flex-shrink-0" style={{ background: 'rgba(59,130,246,0.5)' }} />
        <p className="text-[11px] text-gray-600 leading-relaxed">
          <span className="text-gray-400 font-medium">Workspaces</span> scope AI usage to teams — members share playbooks, knowledge, and activity under a governed budget.
          Create a workspace to track AI spend and usage by department or project.
        </p>
      </div>

      <div className="flex flex-1 min-h-0">

        {/* ── Workspace list ─────────────────────────────────────────────── */}
        <div className={`${selected ? 'hidden md:flex' : 'flex'} flex-col w-full md:w-72 flex-shrink-0 border-r border-white/[0.06] overflow-y-auto`}
          style={{ background: 'var(--surface-2)' }}>

          <div className="px-4 py-3 border-b border-white/[0.04]">
            <p className="text-[9px] text-gray-600 uppercase tracking-widest font-semibold">
              {workspaces.length} workspace{workspaces.length !== 1 ? 's' : ''}
            </p>
          </div>

          {loadingData ? (
            <div className="p-4 space-y-3">
              {[0, 1].map(i => <div key={i} className="skeleton h-20 rounded-xl" />)}
            </div>
          ) : workspaces.length === 0 ? (
            <div className="px-4 py-10 text-center">
              <p className="text-xs text-gray-600">No workspaces yet.</p>
              <button onClick={() => setShowCreate(true)}
                className="mt-2 text-[11px] text-blue-400 hover:text-blue-300 cursor-pointer">
                Create one →
              </button>
            </div>
          ) : (
            workspaces.map(ws => {
              const rc = RISK_CONFIG[ws.risk_threshold] || RISK_CONFIG.medium
              return (
                <button key={ws.id}
                  onClick={() => selectWorkspace(ws)}
                  className={`w-full text-left px-4 py-4 border-b border-white/[0.03] transition-colors cursor-pointer ${
                    selected?.id === ws.id ? 'border-l-2 border-l-blue-500' : 'hover:bg-white/[0.03]'
                  }`}
                  style={selected?.id === ws.id ? { background: 'rgba(59,130,246,0.06)' } : {}}>
                  <div className="flex items-start justify-between mb-1">
                    <p className="text-xs font-medium text-gray-200 leading-snug">{ws.name}</p>
                    <span className="text-[9px] ml-2 flex-shrink-0" style={{ color: rc.color }}>● {ws.risk_threshold}</span>
                  </div>
                  {ws.description && (
                    <p className="text-[10px] text-gray-500 truncate">{ws.description}</p>
                  )}
                  <div className="flex items-center gap-3 mt-2">
                    <span className="text-[10px] text-gray-600">{ws.member_count} member{ws.member_count !== 1 ? 's' : ''}</span>
                    {ws.budget_limit_usd && (
                      <span className="text-[10px] text-gray-600">${ws.budget_limit_usd} limit</span>
                    )}
                  </div>
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
                  style={{ background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.18)' }}>
                  <svg className="w-5 h-5 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </div>
                <h3 className="text-sm font-semibold text-white mb-2">Team Workspaces</h3>
                <p className="text-[12px] text-gray-500 leading-relaxed">
                  Workspaces scope AI usage to teams. Members share agents, playbooks, and activity under a governed budget.
                </p>
              </div>
            </div>
          ) : (
            <>
              {/* Workspace header */}
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
                      <h2 className="text-sm font-semibold text-white">{selected.name}</h2>
                      {selected.description && (
                        <p className="text-[12px] text-gray-500 mt-0.5">{selected.description}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="text-[10px] px-2 py-0.5 rounded"
                      style={{ background: `${RISK_CONFIG[selected.risk_threshold]?.color}18`, color: RISK_CONFIG[selected.risk_threshold]?.color }}>
                      {RISK_CONFIG[selected.risk_threshold]?.label || selected.risk_threshold}
                    </span>
                  </div>
                </div>

                {/* Tabs */}
                <div className="flex items-center gap-1 mt-4">
                  {(['overview', 'members', 'activity'] as const).map(tab => (
                    <button key={tab}
                      onClick={() => setActiveTab(tab)}
                      className={`px-3 py-1.5 text-xs rounded-lg transition-colors cursor-pointer capitalize ${
                        activeTab === tab ? 'text-white font-medium' : 'text-gray-500 hover:text-gray-300'
                      }`}
                      style={activeTab === tab ? { background: 'rgba(255,255,255,0.08)' } : {}}>
                      {tab}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-4 md:p-6">
                {loadingDetail ? (
                  <div className="space-y-3">
                    {[0, 1, 2].map(i => <div key={i} className="skeleton h-16 rounded-xl" />)}
                  </div>
                ) : (
                  <>
                    {/* Overview tab */}
                    {activeTab === 'overview' && (
                      <div className="space-y-4">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                          {[
                            { label: 'Members',      value: members.length,  color: '#3b82f6' },
                            { label: '30d Spend',    value: `$${(selected.spend_30d ?? 0).toFixed(2)}`, color: '#fbbf24' },
                            { label: 'Budget Limit', value: selected.budget_limit_usd ? `$${selected.budget_limit_usd}` : 'None', color: '#6366f1' },
                            { label: 'Risk',         value: selected.risk_threshold,  color: RISK_CONFIG[selected.risk_threshold]?.color || '#fbbf24' },
                          ].map(({ label, value, color }) => (
                            <div key={label} className="card p-4">
                              <p className="stat-label">{label}</p>
                              <p className="text-base font-bold mt-1" style={{ color }}>{value}</p>
                            </div>
                          ))}
                        </div>

                        {selected.budget_limit_usd && (selected.spend_30d ?? 0) > 0 && (
                          <div className="card p-4">
                            <div className="flex items-center justify-between mb-2">
                              <p className="text-xs text-gray-400">Budget Usage (30d)</p>
                              <p className="text-xs text-gray-500">
                                ${(selected.spend_30d ?? 0).toFixed(2)} / ${selected.budget_limit_usd}
                              </p>
                            </div>
                            <div className="progress-track h-1.5 rounded-full">
                              <div className="h-full rounded-full transition-all"
                                style={{
                                  width: `${Math.min(100, ((selected.spend_30d ?? 0) / selected.budget_limit_usd) * 100)}%`,
                                  background: 'linear-gradient(90deg, #3b82f6, #6366f1)',
                                }} />
                            </div>
                          </div>
                        )}

                        <div className="card p-4">
                          <p className="text-xs font-semibold text-gray-300 mb-3">Recent Activity</p>
                          {activity.length === 0 ? (
                            <p className="text-xs text-gray-600">No activity yet.</p>
                          ) : (
                            <div className="space-y-2">
                              {activity.slice(0, 5).map(a => (
                                <div key={a.id} className="flex items-center gap-3">
                                  <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                                    a.decision === 'block' ? 'bg-red-500' : a.decision === 'warn' ? 'bg-yellow-500' : 'bg-emerald-600'
                                  }`} />
                                  <p className="text-[11px] text-gray-400 flex-1 truncate">
                                    <span className="text-gray-300">{a.actor_name || a.actor}</span>
                                    {' · '}{a.event_type}
                                    {a.cost > 0 && <span className="text-gray-600"> · ${a.cost.toFixed(4)}</span>}
                                  </p>
                                  <span className="text-[10px] text-gray-600 flex-shrink-0">
                                    {new Date(a.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                  </span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Members tab */}
                    {activeTab === 'members' && (
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <p className="text-xs text-gray-400">{members.length} member{members.length !== 1 ? 's' : ''}</p>
                          <button onClick={() => { setShowAddMember(!showAddMember); setMemberError('') }}
                            className="px-3 py-1.5 text-xs text-white rounded-lg cursor-pointer hover:opacity-90"
                            style={{ background: 'rgba(255,255,255,0.08)' }}>
                            + Add Member
                          </button>
                        </div>

                        {showAddMember && (
                          <form onSubmit={handleAddMember} className="card p-4 space-y-2">
                            <input
                              value={memberEmail}
                              onChange={e => setMemberEmail(e.target.value)}
                              placeholder="user@example.com"
                              required type="email"
                              className="w-full px-3 py-2 rounded-lg text-xs text-gray-200 placeholder-gray-600 focus:outline-none"
                              style={{ background: 'var(--surface-2)', border: '1px solid rgba(255,255,255,0.08)' }}
                            />
                            <select
                              value={memberRole}
                              onChange={e => setMemberRole(e.target.value)}
                              className="w-full px-3 py-2 rounded-lg text-xs text-gray-200 focus:outline-none"
                              style={{ background: 'var(--surface-2)', border: '1px solid rgba(255,255,255,0.08)' }}>
                              <option value="member">Member</option>
                              <option value="viewer">Viewer</option>
                              <option value="owner">Owner</option>
                            </select>
                            {memberError && <p className="text-[10px] text-red-400">{memberError}</p>}
                            <div className="flex gap-2">
                              <button type="submit" disabled={addingMember}
                                className="flex-1 py-1.5 text-white text-xs font-semibold rounded-lg cursor-pointer disabled:opacity-50 hover:opacity-90"
                                style={{ background: 'linear-gradient(135deg, #3b82f6, #6366f1)' }}>
                                {addingMember ? 'Adding…' : 'Add'}
                              </button>
                              <button type="button" onClick={() => setShowAddMember(false)}
                                className="px-3 text-gray-500 hover:text-gray-300 text-xs cursor-pointer">
                                Cancel
                              </button>
                            </div>
                          </form>
                        )}

                        {members.map(m => (
                          <div key={m.id} className="card px-4 py-3 flex items-center gap-3">
                            <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 text-[10px] font-semibold"
                              style={{ background: 'rgba(99,102,241,0.15)', color: '#818cf8' }}>
                              {m.user_name?.charAt(0)?.toUpperCase() || '?'}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-medium text-gray-200">{m.user_name}</p>
                              <p className="text-[10px] text-gray-500">{m.user_email}</p>
                            </div>
                            <span className={`text-[9px] px-1.5 py-0.5 rounded font-semibold uppercase ${
                              m.role === 'owner' ? 'text-amber-400' : 'text-gray-500'
                            }`}
                              style={{ background: m.role === 'owner' ? 'rgba(251,191,36,0.1)' : 'rgba(255,255,255,0.05)' }}>
                              {m.role}
                            </span>
                            {user.role === 'admin' && m.role !== 'owner' && (
                              <button onClick={() => handleRemoveMember(selected.id, m.user_id)}
                                className="text-gray-600 hover:text-red-400 text-xs cursor-pointer transition-colors ml-1">
                                ✕
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Activity tab */}
                    {activeTab === 'activity' && (
                      <div className="space-y-1">
                        {activity.length === 0 ? (
                          <p className="text-xs text-gray-600 py-8 text-center">No activity recorded.</p>
                        ) : activity.map(a => (
                          <div key={a.id} className="flex items-center gap-3 px-4 py-2.5 rounded-lg hover:bg-white/[0.02] transition-colors">
                            <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                              a.decision === 'block' ? 'bg-red-500' : a.decision === 'warn' ? 'bg-yellow-500' : 'bg-emerald-600'
                            }`} />
                            <div className="flex-1 min-w-0">
                              <p className="text-[11px] text-gray-300 truncate">
                                {a.actor_name || a.actor}
                                <span className="text-gray-600"> · {a.model} · {a.event_type}</span>
                              </p>
                            </div>
                            {a.cost > 0 && <span className="text-[10px] text-gray-600 flex-shrink-0">${a.cost.toFixed(4)}</span>}
                            <span className="text-[10px] text-gray-600 flex-shrink-0 tabular-nums">
                              {new Date(a.timestamp).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Create workspace modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4"
          style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}>
          <div className="w-full max-w-sm rounded-2xl border border-white/[0.08] p-6 space-y-4"
            style={{ background: 'var(--surface-3)' }}>
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-white">New Workspace</h3>
              <button onClick={() => setShowCreate(false)}
                className="text-gray-500 hover:text-gray-300 cursor-pointer">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <form onSubmit={handleCreate} className="space-y-3">
              <div>
                <label className="text-[10px] text-gray-600 block mb-1">Name *</label>
                <input
                  value={createForm.name}
                  onChange={e => setCreateForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="Compliance Workspace"
                  required
                  className="w-full px-3 py-2 rounded-lg text-xs text-gray-200 placeholder-gray-600 focus:outline-none"
                  style={{ background: 'var(--surface-2)', border: '1px solid rgba(255,255,255,0.08)' }}
                />
              </div>
              <div>
                <label className="text-[10px] text-gray-600 block mb-1">Description</label>
                <input
                  value={createForm.description}
                  onChange={e => setCreateForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="Team purpose..."
                  className="w-full px-3 py-2 rounded-lg text-xs text-gray-200 placeholder-gray-600 focus:outline-none"
                  style={{ background: 'var(--surface-2)', border: '1px solid rgba(255,255,255,0.08)' }}
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] text-gray-600 block mb-1">Budget Limit ($)</label>
                  <input
                    value={createForm.budget_limit_usd}
                    onChange={e => setCreateForm(f => ({ ...f, budget_limit_usd: e.target.value }))}
                    placeholder="100"
                    type="number" min="0" step="0.01"
                    className="w-full px-3 py-2 rounded-lg text-xs text-gray-200 placeholder-gray-600 focus:outline-none"
                    style={{ background: 'var(--surface-2)', border: '1px solid rgba(255,255,255,0.08)' }}
                  />
                </div>
                <div>
                  <label className="text-[10px] text-gray-600 block mb-1">Risk Threshold</label>
                  <select
                    value={createForm.risk_threshold}
                    onChange={e => setCreateForm(f => ({ ...f, risk_threshold: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg text-xs text-gray-200 focus:outline-none"
                    style={{ background: 'var(--surface-2)', border: '1px solid rgba(255,255,255,0.08)' }}>
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                  </select>
                </div>
              </div>
              {createError && <p className="text-[11px] text-red-400">{createError}</p>}
              <div className="flex gap-2 pt-1">
                <button type="submit" disabled={creating}
                  className="flex-1 py-2 text-white text-xs font-semibold rounded-lg disabled:opacity-50 cursor-pointer hover:opacity-90"
                  style={{ background: 'linear-gradient(135deg, #3b82f6, #6366f1)' }}>
                  {creating ? 'Creating…' : 'Create Workspace'}
                </button>
                <button type="button" onClick={() => setShowCreate(false)}
                  className="px-4 text-gray-500 hover:text-gray-300 text-xs cursor-pointer">
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <LogoutButton />
    </div>
  )
}
