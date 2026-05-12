'use client'

import { useAuth } from '@/context/AuthContext'
import { usePathname } from 'next/navigation'

const PUBLIC_ROUTES = new Set(['/', '/login'])

export default function LogoutButton() {
  const { user, logout } = useAuth()
  const pathname = usePathname()

  if (!user || PUBLIC_ROUTES.has(pathname)) return null

  return (
    <button
      onClick={logout}
      className="fixed bottom-4 right-4 z-50 flex items-center gap-1.5 px-3 py-1.5 text-xs text-gray-600 hover:text-gray-300 transition-all rounded-lg border border-white/[0.06] hover:border-white/[0.1]"
      style={{ background: 'rgba(10,10,15,0.9)', backdropFilter: 'blur(12px)' }}
    >
      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
      </svg>
      Sign out
    </button>
  )
}
