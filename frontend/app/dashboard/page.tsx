'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'
import AppNav from '@/components/AppNav'
import LogoutButton from '@/components/LogoutButton'
import UsageDashboard from '@/components/UsageDashboard'
import AISystemOverview from '@/components/AISystemOverview'

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
    <div className="flex flex-col h-full bg-gray-950">
      <div className="flex-shrink-0 border-b border-gray-800 px-4 py-2.5 flex items-center gap-3">
        <div className="flex items-center gap-1.5">
          <div className="w-5 h-5 rounded bg-blue-600 flex items-center justify-center text-xs font-bold text-white">A</div>
          <span className="text-sm font-semibold text-white hidden sm:block">Aegis Lite</span>
        </div>
        <div className="w-px h-4 bg-gray-800 hidden sm:block" />
        <AppNav currentPage="/dashboard" />
        {user.role === 'admin' && (
          <span className="px-2 py-0.5 bg-purple-900/40 border border-purple-700/40 text-purple-300 text-xs rounded-full hidden md:block">
            Admin
          </span>
        )}
        <div className="ml-auto flex items-center gap-2">
          <div className="w-6 h-6 rounded-full bg-blue-600 flex items-center justify-center text-xs text-white font-semibold flex-shrink-0">
            {user.name[0]}
          </div>
          <span className="text-xs text-gray-400 hidden sm:block">{user.name}</span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-4xl mx-auto space-y-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-base font-semibold text-white">Dashboard</h1>
              <p className="text-xs text-gray-500 mt-0.5">AI usage · governance · cost tracking</p>
            </div>
            <div className="text-right hidden sm:block">
              <p className="text-[10px] text-zinc-600 uppercase tracking-wider">Signed in as</p>
              <p className="text-xs text-zinc-400 font-medium">{user.name}</p>
              <p className="text-[10px] text-zinc-600">{user.role}</p>
            </div>
          </div>

          {user.role === 'admin' && <AISystemOverview />}
          <UsageDashboard isAdmin={user.role === 'admin'} />
        </div>
      </div>
      <LogoutButton />
    </div>
  )
}
