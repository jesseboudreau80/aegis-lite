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
      className="fixed bottom-4 right-4 z-50 px-3 py-1.5 text-xs text-gray-500 hover:text-gray-300 bg-gray-900/80 hover:bg-gray-800 border border-gray-800 rounded-lg transition-colors backdrop-blur-sm"
    >
      Sign out
    </button>
  )
}
