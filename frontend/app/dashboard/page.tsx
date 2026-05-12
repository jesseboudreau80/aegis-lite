'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'
import AppNav from '@/components/AppNav'
import LogoutButton from '@/components/LogoutButton'
import UsageDashboard from '@/components/UsageDashboard'
import AISystemOverview from '@/components/AISystemOverview'
import Link from 'next/link'

const QUICK_LINKS = [
  {
    href: '/chat',
    label: 'New conversation',
    desc: 'Start a governed AI chat session',
    icon: 'M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z',
    color: '#3b82f6',
  },
  {
    href: '/agents',
    label: 'Run an agent',
    desc: 'Execute a governed custom agent',
    icon: 'M9 3H5a2 2 0 00-2 2v4m6-6h10a2 2 0 012 2v4M9 3v18m0 0h10a2 2 0 002-2V9M9 21H5a2 2 0 01-2-2V9m0 0h18',
    color: '#8b5cf6',
  },
  {
    href: '/research',
    label: 'Web research',
    desc: 'Governed Perplexity research',
    icon: '21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z',
    color: '#06b6d4',
  },
]

export default function DashboardPage() {
  const { user, loading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (loading) return
    if (!user) { router.replace('/login'); return }
    if (!user.training_completed) { router.replace('/training'); return }
  }, [user, loading, router])

  if (loading || !user) return null

  return (
    <div className="flex flex-col h-full" style={{ background: 'var(--surface-1)' }}>

      {/* Header */}
      <header className="page-header">
        <div className="logo-mark">A</div>
        <span className="text-sm font-semibold text-white hidden sm:block">Aegis Lite</span>
        <div className="divider hidden sm:block" style={{ height: 16 }} />
        <AppNav currentPage="/dashboard" />

        <div className="ml-auto flex items-center gap-3">
          {user.role === 'admin' && (
            <span className="badge badge-info">Admin</span>
          )}
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0"
              style={{ background: 'linear-gradient(135deg, #3b82f6, #6366f1)' }}>
              {user.name[0].toUpperCase()}
            </div>
            <span className="text-xs text-gray-400 hidden sm:block">{user.name}</span>
          </div>
        </div>
      </header>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-5">
        <div className="max-w-4xl mx-auto space-y-5">

          {/* Page header */}
          <div className="flex items-start justify-between gap-4 pt-1">
            <div>
              <h1 className="text-base font-semibold text-white">Command Center</h1>
              <p className="text-xs text-gray-500 mt-0.5">AI usage · governance · cost tracking</p>
            </div>
            <div className="hidden sm:block text-right">
              <p className="stat-label">Signed in as</p>
              <p className="text-xs text-gray-400 font-medium mt-0.5">{user.email}</p>
            </div>
          </div>

          {/* Quick links */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {QUICK_LINKS.map(({ href, label, desc, icon, color }) => (
              <Link key={href} href={href}
                className="card card-hover p-4 flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ background: `${color}15`, border: `1px solid ${color}25` }}>
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke={color} strokeWidth={1.75}>
                    <path strokeLinecap="round" strokeLinejoin="round" d={icon} />
                  </svg>
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-white truncate">{label}</p>
                  <p className="text-[10px] text-gray-500 truncate">{desc}</p>
                </div>
              </Link>
            ))}
          </div>

          {/* Admin: AI registry */}
          {user.role === 'admin' && <AISystemOverview />}

          {/* Usage */}
          <UsageDashboard isAdmin={user.role === 'admin'} />

          {/* Governance link for admins */}
          {user.role === 'admin' && (
            <div className="card p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center"
                  style={{ background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.2)' }}>
                  <svg className="w-4 h-4 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                </div>
                <div>
                  <p className="text-xs font-semibold text-white">Governance Dashboard</p>
                  <p className="text-[10px] text-gray-500">Policy events, risk scores, audit explorer</p>
                </div>
              </div>
              <Link href="/governance"
                className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors flex items-center gap-1">
                Open →
              </Link>
            </div>
          )}
        </div>
      </div>
      <LogoutButton />
    </div>
  )
}
