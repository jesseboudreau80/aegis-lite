'use client'

import { useAuth } from '@/context/AuthContext'
import { usePathname } from 'next/navigation'

const PUBLIC_ROUTES = new Set(['/', '/login'])

export default function LogoutButton() {
  const { user, logout } = useAuth()
  const pathname = usePathname()

  if (!user || PUBLIC_ROUTES.has(pathname)) return null

  // Sign-out lives in the AppNav mobile drawer and is not rendered as a floating element
  return null
}
