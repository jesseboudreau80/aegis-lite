'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'
import { api } from '@/lib/api'
import { User } from '@/lib/types'

export default function LoginPage() {
  const { loginWithJWT, user, loading } = useAuth()
  const router = useRouter()
  const params = useSearchParams()
  const token = params.get('token')

  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [mode, setMode]         = useState<'magic' | 'password'>('password')
  const [status, setStatus]     = useState<'idle' | 'loading' | 'sent' | 'error'>('idle')
  const [error, setError]       = useState('')
  const [magicLink, setMagicLink] = useState('')

  // Redirect if already logged in
  useEffect(() => {
    if (!loading && user) router.replace('/dashboard')
  }, [user, loading, router])

  // Auto-verify magic-link token from URL
  useEffect(() => {
    if (!token) return
    setStatus('loading')
    api.verifyToken(token)
      .then(res => {
        const { access_token, user: userInfo } = res.data as { access_token: string; user: User }
        loginWithJWT(access_token, userInfo)
        router.replace('/dashboard')
      })
      .catch(() => {
        setError('Magic link is invalid or expired.')
        setStatus('error')
      })
  }, [token, loginWithJWT, router])

  const handlePasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setStatus('loading')
    setError('')
    try {
      const res = await api.passwordLogin(email, password)
      const { access_token, user: userInfo } = res.data as { access_token: string; user: User }
      loginWithJWT(access_token, userInfo)
      router.replace('/dashboard')
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || 'Login failed.'
      setError(msg)
      setStatus('error')
    }
  }

  const handleMagicLink = async (e: React.FormEvent) => {
    e.preventDefault()
    setStatus('loading')
    setError('')
    try {
      const res = await api.requestMagicLink(email)
      const { login_url } = res.data as { login_url?: string }
      setMagicLink(login_url || '')
      setStatus('sent')
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || 'Failed to send magic link.'
      setError(msg)
      setStatus('error')
    }
  }

  if (loading || token) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-gray-400 text-sm">Loading…</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-blue-600 mb-3">
            <span className="text-white font-bold text-lg">A</span>
          </div>
          <h1 className="text-xl font-semibold text-white">Aegis Lite</h1>
          <p className="text-xs text-gray-500 mt-1">AI governance workspace</p>
        </div>

        {/* Mode tabs */}
        <div className="flex rounded-lg bg-gray-900 p-1 mb-6 border border-gray-800">
          <button
            onClick={() => { setMode('password'); setError(''); setStatus('idle') }}
            className={`flex-1 py-1.5 text-xs rounded-md transition-colors ${mode === 'password' ? 'bg-gray-700 text-white font-medium' : 'text-gray-400 hover:text-gray-200'}`}
          >
            Password
          </button>
          <button
            onClick={() => { setMode('magic'); setError(''); setStatus('idle') }}
            className={`flex-1 py-1.5 text-xs rounded-md transition-colors ${mode === 'magic' ? 'bg-gray-700 text-white font-medium' : 'text-gray-400 hover:text-gray-200'}`}
          >
            Magic link
          </button>
        </div>

        {/* Password form */}
        {mode === 'password' && (
          <form onSubmit={handlePasswordLogin} className="space-y-4">
            <div>
              <label className="block text-xs text-gray-400 mb-1">Email</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-sm text-gray-100 placeholder-gray-600 focus:outline-none focus:border-blue-600"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Password</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-sm text-gray-100 placeholder-gray-600 focus:outline-none focus:border-blue-600"
              />
            </div>
            {error && <p className="text-xs text-red-400">{error}</p>}
            <button
              type="submit"
              disabled={status === 'loading'}
              className="w-full py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
            >
              {status === 'loading' ? 'Signing in…' : 'Sign in'}
            </button>
          </form>
        )}

        {/* Magic link form */}
        {mode === 'magic' && status !== 'sent' && (
          <form onSubmit={handleMagicLink} className="space-y-4">
            <div>
              <label className="block text-xs text-gray-400 mb-1">Email</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-sm text-gray-100 placeholder-gray-600 focus:outline-none focus:border-blue-600"
              />
            </div>
            {error && <p className="text-xs text-red-400">{error}</p>}
            <button
              type="submit"
              disabled={status === 'loading'}
              className="w-full py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
            >
              {status === 'loading' ? 'Sending…' : 'Send magic link'}
            </button>
          </form>
        )}

        {/* Magic link sent */}
        {mode === 'magic' && status === 'sent' && (
          <div className="text-center">
            <div className="w-10 h-10 rounded-full bg-green-900/30 border border-green-700/30 flex items-center justify-center mx-auto mb-3">
              <svg className="w-5 h-5 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <p className="text-sm text-gray-300 mb-2">Magic link sent</p>
            <p className="text-xs text-gray-500">Check your email. Expires in 60 minutes.</p>
            {magicLink && (
              <div className="mt-4 p-3 bg-gray-900 border border-gray-700 rounded-lg text-left">
                <p className="text-[10px] text-gray-500 mb-1">Dev mode — link returned in response:</p>
                <a href={magicLink} className="text-xs text-blue-400 break-all hover:underline">{magicLink}</a>
              </div>
            )}
          </div>
        )}

        {/* Demo hint */}
        <p className="text-center text-[10px] text-gray-600 mt-6">
          Demo: admin@example.com / demo@example.com
        </p>
      </div>
    </div>
  )
}
