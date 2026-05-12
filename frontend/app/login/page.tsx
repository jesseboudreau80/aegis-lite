'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'
import { api } from '@/lib/api'
import { User } from '@/lib/types'

function LoginContent() {
  const { loginWithJWT, user, loading } = useAuth()
  const router = useRouter()
  const params = useSearchParams()
  const token = params.get('token')

  const [email, setEmail]         = useState('')
  const [password, setPassword]   = useState('')
  const [mode, setMode]           = useState<'password' | 'magic'>('password')
  const [status, setStatus]       = useState<'idle' | 'loading' | 'sent' | 'error'>('idle')
  const [error, setError]         = useState('')
  const [magicLink, setMagicLink] = useState('')

  useEffect(() => {
    if (!loading && user) router.replace('/dashboard')
  }, [user, loading, router])

  useEffect(() => {
    if (!token) return
    setStatus('loading')
    api.verifyToken(token)
      .then(res => {
        const { access_token, user: userInfo } = res.data as { access_token: string; user: User }
        loginWithJWT(access_token, userInfo)
        router.replace('/dashboard')
      })
      .catch(() => { setError('Magic link is invalid or expired.'); setStatus('error') })
  }, [token, loginWithJWT, router])

  const handlePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setStatus('loading'); setError('')
    try {
      const res = await api.passwordLogin(email, password)
      const { access_token, user: u } = res.data as { access_token: string; user: User }
      loginWithJWT(access_token, u)
      router.replace('/dashboard')
    } catch (err: unknown) {
      setError((err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || 'Login failed.')
      setStatus('error')
    }
  }

  const handleMagic = async (e: React.FormEvent) => {
    e.preventDefault()
    setStatus('loading'); setError('')
    try {
      const res = await api.requestMagicLink(email)
      setMagicLink((res.data as { login_url?: string }).login_url || '')
      setStatus('sent')
    } catch (err: unknown) {
      setError((err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || 'Failed to send magic link.')
      setStatus('error')
    }
  }

  if (loading || token) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--surface-1)' }}>
        <div className="flex flex-col items-center gap-3">
          <div className="logo-mark w-8 h-8" />
          <p className="text-xs text-gray-500">Loading…</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex" style={{ background: 'var(--surface-1)' }}>
      {/* Left panel — branding */}
      <div className="hidden lg:flex lg:w-1/2 flex-col justify-between p-12 border-r border-white/[0.05]"
        style={{ background: 'linear-gradient(135deg, #0d0d17 0%, #111120 100%)' }}>
        <div className="flex items-center gap-2.5">
          <div className="logo-mark">A</div>
          <span className="text-sm font-semibold text-white">Aegis Lite</span>
        </div>

        <div>
          <blockquote className="text-2xl font-semibold text-white leading-tight mb-6">
            "Every AI request should have<br />an audit trail."
          </blockquote>

          {/* Mini policy trace */}
          <div className="rounded-xl border border-white/[0.06] overflow-hidden font-mono text-xs"
            style={{ background: 'rgba(0,0,0,0.4)' }}>
            <div className="px-4 py-2.5 border-b border-white/[0.04] flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 pulse-dot" />
              <span className="text-gray-600">policy_engine.log</span>
            </div>
            <div className="p-4 space-y-2">
              {[
                { rule: '_check_secrets',           result: 'pass',    color: 'text-emerald-400' },
                { rule: '_check_model_access',      result: 'pass',    color: 'text-emerald-400' },
                { rule: '_check_pii',               result: 'redact',  color: 'text-yellow-400' },
                { rule: '_check_prompt_injection',  result: 'pass',    color: 'text-emerald-400' },
                { rule: '_check_data_classification',result: 'allow',  color: 'text-emerald-400' },
              ].map(({ rule, result, color }) => (
                <div key={rule} className="flex items-center justify-between">
                  <span className="text-gray-500">{rule}</span>
                  <span className={`${color} font-semibold`}>{result}</span>
                </div>
              ))}
            </div>
            <div className="px-4 py-2.5 border-t border-white/[0.04] flex justify-between text-gray-600">
              <span>decision: <span className="text-emerald-400">allow</span></span>
              <span>risk_score: 0.20</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {[
            { label: 'Policy engine' },
            { label: 'Audit logging' },
            { label: 'Open source' },
          ].map(({ label }) => (
            <div key={label} className="flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              <span className="text-xs text-gray-600">{label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Right panel — form */}
      <div className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">

          <div className="mb-8 lg:hidden flex items-center gap-2">
            <div className="logo-mark">A</div>
            <span className="text-sm font-semibold text-white">Aegis Lite</span>
          </div>

          <h1 className="text-xl font-semibold text-white mb-1">Welcome back</h1>
          <p className="text-sm text-gray-500 mb-8">Sign in to your governance workspace</p>

          {/* Mode tabs */}
          <div className="flex rounded-xl p-1 mb-6 border border-white/[0.06]"
            style={{ background: 'rgba(255,255,255,0.03)' }}>
            {(['password', 'magic'] as const).map((m) => (
              <button key={m} onClick={() => { setMode(m); setError(''); setStatus('idle') }}
                className={`flex-1 py-1.5 text-xs rounded-lg transition-all ${
                  mode === m
                    ? 'text-white font-medium bg-white/[0.08]'
                    : 'text-gray-500 hover:text-gray-300'
                }`}>
                {m === 'password' ? 'Password' : 'Magic link'}
              </button>
            ))}
          </div>

          {/* Password form */}
          {mode === 'password' && (
            <form onSubmit={handlePassword} className="space-y-4">
              <div>
                <label className="block text-xs text-gray-400 mb-1.5">Email</label>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                  placeholder="you@example.com" required className="input-base w-full" />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1.5">Password</label>
                <input type="password" value={password} onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••" required className="input-base w-full" />
              </div>
              {error && (
                <div className="px-3 py-2 rounded-lg border text-xs text-red-400"
                  style={{ background: 'rgba(239,68,68,0.06)', borderColor: 'rgba(239,68,68,0.2)' }}>
                  {error}
                </div>
              )}
              <button type="submit" disabled={status === 'loading'}
                className="w-full py-2.5 text-sm font-semibold text-white rounded-xl transition-all disabled:opacity-50 hover:opacity-90"
                style={{ background: 'linear-gradient(135deg, #3b82f6, #6366f1)' }}>
                {status === 'loading' ? 'Signing in…' : 'Sign in'}
              </button>
            </form>
          )}

          {/* Magic link form */}
          {mode === 'magic' && status !== 'sent' && (
            <form onSubmit={handleMagic} className="space-y-4">
              <div>
                <label className="block text-xs text-gray-400 mb-1.5">Email</label>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                  placeholder="you@example.com" required className="input-base w-full" />
              </div>
              {error && (
                <div className="px-3 py-2 rounded-lg border text-xs text-red-400"
                  style={{ background: 'rgba(239,68,68,0.06)', borderColor: 'rgba(239,68,68,0.2)' }}>
                  {error}
                </div>
              )}
              <button type="submit" disabled={status === 'loading'}
                className="w-full py-2.5 text-sm font-semibold text-white rounded-xl transition-all disabled:opacity-50 hover:opacity-90"
                style={{ background: 'linear-gradient(135deg, #3b82f6, #6366f1)' }}>
                {status === 'loading' ? 'Sending…' : 'Send magic link'}
              </button>
            </form>
          )}

          {/* Magic link sent */}
          {mode === 'magic' && status === 'sent' && (
            <div className="text-center py-4">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full mb-4 border"
                style={{ background: 'rgba(16,185,129,0.08)', borderColor: 'rgba(16,185,129,0.2)' }}>
                <svg className="w-5 h-5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <p className="text-sm font-medium text-white mb-1">Link sent</p>
              <p className="text-xs text-gray-500">Check your email. Expires in 60 minutes.</p>
              {magicLink && (
                <div className="mt-5 p-3 rounded-lg border text-left"
                  style={{ background: 'rgba(255,255,255,0.03)', borderColor: 'rgba(255,255,255,0.06)' }}>
                  <p className="text-[10px] text-gray-600 mb-1.5">Dev mode — returned in response:</p>
                  <a href={magicLink} className="text-[10px] text-blue-400 break-all hover:underline font-mono">{magicLink}</a>
                </div>
              )}
            </div>
          )}

          <div className="mt-8 pt-6 border-t border-white/[0.05]">
            <p className="text-[10px] text-gray-600 text-center">
              Demo accounts: <span className="text-gray-500 font-mono">admin@example.com</span> &middot; <span className="text-gray-500 font-mono">demo@example.com</span>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginContent />
    </Suspense>
  )
}
