'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'
import AppNav from '@/components/AppNav'
import LogoutButton from '@/components/LogoutButton'
import { api } from '@/lib/api'

const DECISION_COLORS: Record<string, string> = {
  block:    'text-red-400',
  escalate: 'text-orange-400',
  warn:     'text-yellow-400',
  modify:   'text-blue-400',
  allow:    'text-green-400',
}

export default function AuditPage() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const [rows, setRows] = useState<unknown[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loadingData, setLoadingData] = useState(true)
  const [search, setSearch] = useState('')

  useEffect(() => {
    if (!loading && (!user || user.role !== 'admin')) router.replace('/login')
  }, [user, loading, router])

  useEffect(() => {
    if (!user || user.role !== 'admin') return
    setLoadingData(true)
    api.getAuditLog({ page, limit: 25, days: 30, search: search || undefined })
      .then(res => {
        const d = res.data as { total: number; results: unknown[] }
        setTotal(d.total)
        setRows(d.results)
      })
      .catch(() => {})
      .finally(() => setLoadingData(false))
  }, [user, page, search])

  if (loading || !user || user.role !== 'admin') return null

  type AuditRow = {
    id: string; timestamp: string; user: string; model: string | null;
    decision: string; cost: number; tokens_in: number | null; tokens_out: number | null;
    prompt: string; status: string
  }

  return (
    <div className="flex flex-col h-full bg-gray-950">
      <div className="flex-shrink-0 border-b border-gray-800 px-4 py-2.5 flex items-center gap-3">
        <div className="flex items-center gap-1.5">
          <div className="w-5 h-5 rounded bg-blue-600 flex items-center justify-center text-xs font-bold text-white">A</div>
          <span className="text-sm font-semibold text-white hidden sm:block">Aegis Lite</span>
        </div>
        <div className="w-px h-4 bg-gray-800 hidden sm:block" />
        <AppNav currentPage="/governance/audit" />
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-6xl mx-auto space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h1 className="text-base font-semibold text-white">Audit Log</h1>
              <p className="text-xs text-gray-500 mt-0.5">{total} events — last 30 days</p>
            </div>
            <input
              type="text"
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1) }}
              placeholder="Search prompts…"
              className="px-3 py-1.5 bg-gray-900 border border-gray-700 rounded-lg text-xs text-gray-300 placeholder-gray-600 focus:outline-none focus:border-blue-600 w-48"
            />
          </div>

          <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-gray-800 text-gray-500">
                    <th className="px-4 py-3 text-left font-medium">Time</th>
                    <th className="px-4 py-3 text-left font-medium">User</th>
                    <th className="px-4 py-3 text-left font-medium">Model</th>
                    <th className="px-4 py-3 text-left font-medium">Decision</th>
                    <th className="px-4 py-3 text-left font-medium">Cost</th>
                    <th className="px-4 py-3 text-left font-medium">Prompt</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800">
                  {loadingData ? (
                    <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-500">Loading…</td></tr>
                  ) : rows.length === 0 ? (
                    <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-500">No audit events found.</td></tr>
                  ) : (
                    (rows as AuditRow[]).map(row => (
                      <tr key={row.id} className="hover:bg-gray-800/50">
                        <td className="px-4 py-2.5 text-gray-500">{new Date(row.timestamp).toLocaleString()}</td>
                        <td className="px-4 py-2.5 text-gray-300 truncate max-w-[150px]">{row.user}</td>
                        <td className="px-4 py-2.5 text-gray-400">{row.model || '—'}</td>
                        <td className="px-4 py-2.5">
                          <span className={DECISION_COLORS[row.decision] || 'text-gray-400'}>{row.decision}</span>
                        </td>
                        <td className="px-4 py-2.5 text-gray-400">${row.cost.toFixed(6)}</td>
                        <td className="px-4 py-2.5 text-gray-500 truncate max-w-[200px]">{row.prompt}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="px-4 py-3 border-t border-gray-800 flex items-center justify-between">
              <span className="text-xs text-gray-500">Page {page} of {Math.ceil(total / 25)}</span>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="px-2 py-1 text-xs text-gray-400 hover:text-gray-200 disabled:opacity-30"
                >
                  ← Prev
                </button>
                <button
                  onClick={() => setPage(p => p + 1)}
                  disabled={page * 25 >= total}
                  className="px-2 py-1 text-xs text-gray-400 hover:text-gray-200 disabled:opacity-30"
                >
                  Next →
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
      <LogoutButton />
    </div>
  )
}
