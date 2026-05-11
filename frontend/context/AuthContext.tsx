'use client'

import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { api, initApiClient, clearApiClient, isSessionValid, isJWTExpired, STORAGE_KEY_EMAIL, STORAGE_KEY_JWT } from '@/lib/api'
import { User } from '@/lib/types'

const KEY_EMAIL = STORAGE_KEY_EMAIL
const KEY_JWT   = STORAGE_KEY_JWT

const PUBLIC_ROUTES = new Set(['/', '/login'])

function isPublicRoute(pathname: string): boolean {
  return PUBLIC_ROUTES.has(pathname)
}

interface AuthContextValue {
  user: User | null
  userEmail: string | null
  loading: boolean
  authMethod: 'jwt' | null
  sessionBanner: string | null
  loginWithJWT: (jwt: string, userInfo: User) => void
  logout: () => void
  refreshUser: () => Promise<void>
  dismissBanner: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router   = useRouter()
  const pathname = usePathname()

  const [user, setUser]               = useState<User | null>(null)
  const [userEmail, setUserEmail]     = useState<string | null>(null)
  const [loading, setLoading]         = useState(true)
  const [authMethod, setAuthMethod]   = useState<'jwt' | null>(null)
  const [sessionBanner, setSessionBanner] = useState<string | null>(null)

  const sessionRestoredRef = useRef(false)

  const loginWithJWT = useCallback((jwt: string, userInfo: User) => {
    localStorage.setItem(KEY_JWT,   jwt)
    localStorage.setItem(KEY_EMAIL, userInfo.email)
    initApiClient(userInfo.email, jwt)
    setUserEmail(userInfo.email)
    setUser(userInfo)
    setAuthMethod('jwt')
    setSessionBanner(`Logged in as ${userInfo.email}`)
  }, [])

  const logout = useCallback(() => {
    clearApiClient()
    setUser(null)
    setUserEmail(null)
    setAuthMethod(null)
    setSessionBanner(null)
    router.replace('/login')
  }, [router])

  const refreshUser = useCallback(async () => {
    if (!userEmail) return
    const stored = localStorage.getItem(KEY_JWT)
    if (stored) initApiClient(userEmail, stored)
    const res = await api.getMe()
    setUser(res.data as User)
  }, [userEmail])

  const dismissBanner = useCallback(() => setSessionBanner(null), [])

  useEffect(() => {
    function handleVisibility() {
      if (document.visibilityState === 'hidden') return
      if (isPublicRoute(pathname)) return
      const jwt = localStorage.getItem(KEY_JWT)
      if (!isSessionValid() || (jwt ? isJWTExpired(jwt) : false)) {
        clearApiClient()
        router.replace('/login')
      }
    }
    document.addEventListener('visibilitychange', handleVisibility)
    return () => document.removeEventListener('visibilitychange', handleVisibility)
  }, [router, pathname])

  useEffect(() => {
    if (sessionRestoredRef.current) return
    sessionRestoredRef.current = true

    if (isPublicRoute(pathname)) {
      setLoading(false)
      return
    }

    const storedJWT   = localStorage.getItem(KEY_JWT)
    const storedEmail = localStorage.getItem(KEY_EMAIL)

    if (storedJWT && isJWTExpired(storedJWT)) {
      clearApiClient()
      setLoading(false)
      router.replace('/login')
      return
    }

    if (!isSessionValid()) {
      clearApiClient()
      setLoading(false)
      router.replace('/login')
      return
    }

    if (storedJWT && storedEmail) {
      const applyUser = (res: { data: unknown }) => {
        const u = res.data as User
        initApiClient(u.email, storedJWT)
        setUserEmail(u.email)
        setUser(u)
        setAuthMethod('jwt')
        setLoading(false)
      }

      api.validateStoredJWT(storedJWT)
        .then(applyUser)
        .catch(() => {
          setTimeout(() => {
            api.validateStoredJWT(storedJWT)
              .then(applyUser)
              .catch(() => {
                clearApiClient()
                router.replace('/login')
                setLoading(false)
              })
          }, 2000)
        })
    } else {
      setLoading(false)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <AuthContext.Provider value={{
      user, userEmail, loading, authMethod, sessionBanner,
      loginWithJWT, logout, refreshUser, dismissBanner,
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
