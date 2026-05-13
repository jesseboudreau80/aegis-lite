'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'
import AppNav from '@/components/AppNav'
import LogoutButton from '@/components/LogoutButton'
import { api } from '@/lib/api'

type AuditRow = {
  id: string; timestamp: string; user: string; model: string | null;
  decision: string; cost: number; tokens_in?: number; tokens_out?: number;
  prompt: string; status: string
}

const DECISION_FILTERS = ['all', 'block', 'escalate', 'warn', 'modify', 'allow']

const DECISION_BADGE: Record<string, string> = {
  block:    'badge badge-block',
  escalate: 'badge badge-escalate',
  warn:     'badge badge-warn',
  modify:   'badge badge-modify',
  allow:    'badge badge-allow',
}

function Skeleton() {
  return (
    <tr>
      {[1, 2, 3, 4, 5, 6].map(i => (
        <td key={i} className="px-4 py-3">
          <div className="skeleton h-3 w-full max-w-[80px]" />
        </td>
      ))}
    </tr>
  )
}

export default function AuditPage() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const [rows, setRows]               = useState<AuditRow[]>([])
  const [total, setTotal]             = useState(0)
  const [page, setPage]               = useState(1)
  const [loadingData, setLoadingData] = useState(true)
  const [search, setSearch]           = useState('')
  const [decisionFilter, setDecision] = useState('all')
  const [selected, setSelected]       = useState<AuditRow | null>(null)

  useEffect(() => {
    if (!loading && (!user || user.role !== 'admin')) router.replace('/login')
  }, [user, loading, router])

  useEffect(() => {
    if (!user || user.role !== 'admin') return
    setLoadingData(true)
    api.getAuditLog({
      page, limit: 20, days: 30,
      search: search || undefined,
      decision: decisionFilter !== 'all' ? decisionFilter : undefined,
    })
      .then(r => {
        const d = r.data as { total: number; results: AuditRow[] }
        setTotal(d.total)
        setRows(d.results)
      })
      .catch(() => {})
      .finally(() => setLoadingData(false))
  }, [user, page, search, decisionFilter])

  if (loading || !user || user.role !== 'admin') return null

  const totalPages = Math.max(1, Math.ceil(total / 20))

  return (
    <div className="flex flex-col h-full" style={{ background: 'var(--surface-1)' }}>
      <header className="page-header">
        <div className="logo-mark">A</div>
        <span className="text-sm font-semibold text-white hidden sm:block">Aegis Lite</span>
        <div className="divider hidden sm:block" style={{ height: 16 }} />
        <AppNav currentPage="/governance/audit" />
      </header>

      <div className="flex-1 overflow-hidden flex flex-col">
        {/* Toolbar */}
        <div className="flex-shrink-0 px-5 py-3 border-b border-white/[0.05] flex items-center gap-3 flex-wrap"
          style={{ background: 'var(--surface-2)' }}>
          <div className="flex items-center gap-2 flex-1 min-w-[200px]">
            <svg className="w-3.5 h-3.5 text-gray-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text" value={search}
              onChange={e => { setSearch(e.target.value); setPage(1) }}
              placeholder="Search prompts…"
              className="bg-transparent text-xs text-gray-300 placeholder-gray-600 focus:outline-none w-full"
            />
          </div>

          {/* Decision filter chips */}
          <div className="flex items-center gap-1.5 flex-wrap">
            {DECISION_FILTERS.map(d => (
              <button key={d} onClick={() => { setDecision(d); setPage(1) }}
                className={`px-2.5 py-1 rounded-lg text-[10px] font-medium transition-all cursor-pointer ${
                  decisionFilter === d
                    ? 'bg-white/[0.1] text-white border border-white/[0.12]'
                    : 'text-gray-500 hover:text-gray-300 border border-transparent'
                }`}>
                {d === 'all' ? 'All decisions' : d.charAt(0).toUpperCase() + d.slice(1)}
              </button>
            ))}
          </div>

          <div className="text-[10px] text-gray-600 whitespace-nowrap ml-auto">
            {total.toLocaleString()} events · 30 days
          </div>
        </div>

        {/* Table + detail split */}
        <div className="flex-1 overflow-hidden flex">
          {/* Table */}
          <div className={`flex flex-col overflow-hidden transition-all ${selected ? 'w-3/5' : 'w-full'}`}>
            <div className="flex-1 overflow-y-auto overflow-x-auto">
              <table className="data-table" style={{ minWidth: 560 }}>
                <thead className="sticky top-0" style={{ background: 'var(--surface-2)' }}>
                  <tr>
                    <th>Time</th>
                    <th>User</th>
                    <th>Runtime</th>
                    <th>Decision</th>
                    <th>Cost</th>
                    <th>Prompt</th>
                  </tr>
                </thead>
                <tbody>
                  {loadingData
                    ? Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} />)
                    : rows.length === 0
                    ? (
                      <tr>
                        <td colSpan={6} className="py-16 text-center">
                          <p className="text-xs text-gray-500 mb-1">No audit events found</p>
                          <p className="text-[10px] text-gray-600">Try adjusting your filters.</p>
                        </td>
                      </tr>
                    )
                    : rows.map(row => (
                      <tr key={row.id}
                        onClick={() => setSelected(selected?.id === row.id ? null : row)}
                        className="cursor-pointer"
                        style={selected?.id === row.id ? { background: 'rgba(99,102,241,0.08)' } : {}}>
                        <td className="text-gray-500 tabular-nums whitespace-nowrap">
                          {new Date(row.timestamp).toLocaleString([], {
                            month: 'short', day: 'numeric',
                            hour: '2-digit', minute: '2-digit',
                          })}
                        </td>
                        <td>
                          <span className="truncate block max-w-[120px] text-gray-300">{row.user}</span>
                        </td>
                        <td className="font-mono text-[10px] text-gray-500">{row.model || '—'}</td>
                        <td>
                          <span className={DECISION_BADGE[row.decision] || DECISION_BADGE.allow}>
                            {row.decision}
                          </span>
                        </td>
                        <td className="font-mono text-[10px] text-gray-500">
                          ${row.cost.toFixed(row.cost < 0.001 ? 6 : 4)}
                        </td>
                        <td>
                          <span className="block max-w-[180px] truncate text-gray-500">{row.prompt}</span>
                        </td>
                      </tr>
                    ))
                  }
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="flex-shrink-0 px-4 py-3 border-t border-white/[0.04] flex items-center justify-between"
              style={{ background: 'var(--surface-2)' }}>
              <span className="text-[10px] text-gray-600">Page {page} of {totalPages}</span>
              <div className="flex items-center gap-1">
                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                  className="px-2.5 py-1 text-[10px] text-gray-500 hover:text-gray-300 disabled:opacity-30 disabled:cursor-default cursor-pointer border border-white/[0.06] rounded-md transition-colors">
                  ← Prev
                </button>
                <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages}
                  className="px-2.5 py-1 text-[10px] text-gray-500 hover:text-gray-300 disabled:opacity-30 disabled:cursor-default cursor-pointer border border-white/[0.06] rounded-md transition-colors">
                  Next →
                </button>
              </div>
            </div>
          </div>

          {/* Detail panel */}
          {selected && (
            <div className="w-2/5 border-l border-white/[0.05] overflow-y-auto flex-shrink-0"
              style={{ background: 'var(--surface-2)' }}>
              <div className="sticky top-0 px-4 py-3 border-b border-white/[0.04] flex items-center justify-between"
                style={{ background: 'var(--surface-2)' }}>
                <span className="text-xs font-semibold text-gray-300">Event Detail</span>
                <button onClick={() => setSelected(null)} className="text-gray-600 hover:text-gray-400 transition-colors cursor-pointer">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <div className="p-4 space-y-4">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={DECISION_BADGE[selected.decision] || DECISION_BADGE.allow}>
                    {selected.decision}
                  </span>
                  <span className="text-[10px] text-gray-600 font-mono">{selected.model || 'unknown'}</span>
                  <span className="text-[10px] text-gray-700">·</span>
                  <span className="text-[10px] text-gray-600">{selected.status}</span>
                </div>

                {[
                  { label: 'Timestamp',       value: new Date(selected.timestamp).toLocaleString() },
                  { label: 'Actor',            value: selected.user },
                  { label: 'Inference cost',   value: `$${selected.cost.toFixed(8)} USD` },
                  { label: 'Tokens (in/out)',  value: selected.tokens_in != null
                      ? `${selected.tokens_in?.toLocaleString() ?? '—'} / ${selected.tokens_out?.toLocaleString() ?? '—'}`
                      : '—' },
                ].map(({ label, value }) => (
                  <div key={label}>
                    <p className="stat-label mb-1">{label}</p>
                    <p className="text-xs text-gray-300 font-mono">{value}</p>
                  </div>
                ))}

                <div>
                  <p className="stat-label mb-1.5">Prompt (truncated)</p>
                  <div className="rounded-lg p-3 text-[11px] text-gray-400 font-mono leading-relaxed break-all max-h-32 overflow-y-auto"
                    style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.05)' }}>
                    {selected.prompt || '—'}
                  </div>
                </div>

                <div className="pt-2 border-t border-white/[0.04] space-y-1">
                  <p className="text-[9px] text-gray-700 font-mono">
                    audit_id: <span className="text-gray-600">{selected.id}</span>
                  </p>
                  <p className="text-[9px] text-gray-800 font-mono">
                    policy_version: v1.1.0
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
      <LogoutButton />
    </div>
  )
}
