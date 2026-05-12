'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'
import { api } from '@/lib/api'
import { User } from '@/lib/types'
import Link from 'next/link'

const DEMO_ACCOUNTS = [
  { email: 'admin@example.com', password: 'demo', role: 'Admin',    desc: 'Full governance + user management',  color: '#8b5cf6' },
  { email: 'demo@example.com',  password: 'demo', role: 'User',     desc: 'Chat, research, usage dashboard',    color: '#3b82f6' },
]

function ArrowLeft() {
  return (
    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 12H5m7-7l-7 7 7 7" />
    </svg>
  )
}

function LoginContent() {
  const { loginWithJWT, user, loading } = useAuth()
  const router  = useRouter()
  const params  = useSearchParams()
  const token   = params.get('token')

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

  const fillAccount = (acct: typeof DEMO_ACCOUNTS[0]) => {
    setEmail(acct.email)
    setPassword(acct.password)
    setMode('password')
    setError('')
    setStatus('idle')
  }

  if (loading || token) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--surface-1)' }}>
        <div className="flex flex-col items-center gap-3">
          <div className="logo-mark" />
          <p className="text-xs text-gray-500">Loading…</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex" style={{ background: 'var(--surface-1)' }}>

      {/* Left panel — branding */}
      <div className="hidden lg:flex lg:w-[48%] flex-col justify-between p-12 border-r border-white/[0.05] relative overflow-hidden"
        style={{ background: 'linear-gradient(150deg, #090912 0%, #0c0c1a 100%)' }}>

        {/* Grid bg */}
        <div className="absolute inset-0 grid-bg opacity-60 pointer-events-none" />
        {/* Glow */}
        <div className="glow-orb w-64 h-64 bottom-16 left-8"
          style={{ background: 'rgba(99,102,241,0.08)' }} />

        <div className="relative z-10 flex items-center gap-2.5">
          <div className="logo-mark">A</div>
          <span className="text-sm font-semibold text-white">Aegis Lite</span>
          <span className="badge badge-info">OSS</span>
        </div>

        <div className="relative z-10">
          <div className="mb-6">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-600 mb-3">
              Demo deployment
            </p>
            <h2 className="text-2xl font-semibold text-white leading-tight mb-3">
              Explore the governance<br />workspace.
            </h2>
            <p className="text-sm text-gray-500 leading-relaxed max-w-sm">
              Full-featured demo running with synthetic governance data.
              Browse audit logs, policy decisions, agent runs, and the
              AI provider routing layer.
            </p>
          </div>

          {/* Mini policy log */}
          <div className="rounded-xl border border-white/[0.06] overflow-hidden"
            style={{ background: 'rgba(0,0,0,0.4)', fontFamily: 'var(--font-geist-mono)' }}>
            <div className="px-4 py-2 border-b border-white/[0.04] flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 pulse-dot" />
              <span className="text-[10px] text-gray-600">policy_engine.log</span>
            </div>
            <div className="p-4 space-y-1.5">
              {[
                { rule: '_check_secrets',           result: 'pass',   color: '#10b981' },
                { rule: '_check_model_access',      result: 'pass',   color: '#10b981' },
                { rule: '_check_pii',               result: 'redact', color: '#f59e0b' },
                { rule: '_check_prompt_injection',  result: 'pass',   color: '#10b981' },
                { rule: '_apply_risk_controls',     result: 'allow',  color: '#10b981' },
              ].map(({ rule, result, color }) => (
                <div key={rule} className="flex items-center justify-between">
                  <span className="text-[10px] text-gray-600">{rule}</span>
                  <span className="text-[10px] font-semibold" style={{ color }}>{result}</span>
                </div>
              ))}
            </div>
            <div className="px-4 py-2 border-t border-white/[0.04] flex justify-between">
              <span className="text-[9px] text-gray-700 font-mono">
                decision: <span className="text-emerald-500">allow</span>
              </span>
              <span className="text-[9px] text-gray-700 font-mono">risk_score: 0.20</span>
            </div>
          </div>
        </div>

        <div className="relative z-10 flex items-center gap-4">
          {['Policy engine', 'Audit logging', 'Apache 2.0'].map(label => (
            <div key={label} className="flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
              <span className="text-[10px] text-gray-600">{label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Right panel — form */}
      <div className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">

          {/* Mobile logo */}
          <div className="mb-8 lg:hidden flex items-center gap-2">
            <div className="logo-mark">A</div>
            <span className="text-sm font-semibold text-white">Aegis Lite</span>
          </div>

          {/* Back link */}
          <Link href="/"
            className="flex items-center gap-1.5 text-[11px] text-gray-600 hover:text-gray-300 transition-colors mb-6">
            <ArrowLeft />
            Back to overview
          </Link>

          <h1 className="text-xl font-semibold text-white mb-1">Demo workspace</h1>
          <p className="text-sm text-gray-500 mb-6">
            Sign in with a demo account to explore the full governance feature set.
          </p>

          {/* Demo credential cards */}
          <div className="space-y-2 mb-6">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-600 mb-2">
              Demo accounts — click to fill
            </p>
            {DEMO_ACCOUNTS.map(acct => (
              <button key={acct.email} onClick={() => fillAccount(acct)}
                className="w-full text-left p-3 rounded-xl border transition-all group"
                style={{
                  background: email === acct.email ? `${acct.color}08` : 'rgba(255,255,255,0.02)',
                  borderColor: email === acct.email ? `${acct.color}35` : 'rgba(255,255,255,0.06)',
                }}>
                <div className="flex items-center justify-between mb-0.5">
                  <span className="text-[11px] font-semibold text-gray-300 font-mono">{acct.email}</span>
                  <span className="text-[9px] px-1.5 py-0.5 rounded font-semibold"
                    style={{ background: `${acct.color}15`, color: acct.color, border: `1px solid ${acct.color}25` }}>
                    {acct.role}
                  </span>
                </div>
                <p className="text-[10px] text-gray-600">{acct.desc}</p>
                <p className="text-[9px] text-gray-700 mt-0.5 font-mono">
                  password: <span className="text-gray-600">demo</span>
                </p>
              </button>
            ))}
          </div>

          {/* Mode tabs */}
          <div className="flex rounded-xl p-1 mb-5 border border-white/[0.06]"
            style={{ background: 'rgba(255,255,255,0.02)' }}>
            {(['password', 'magic'] as const).map((m) => (
              <button key={m} onClick={() => { setMode(m); setError(''); setStatus('idle') }}
                className={`flex-1 py-1.5 text-xs rounded-lg transition-all ${
                  mode === m
                    ? 'text-white font-medium bg-white/[0.07]'
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
                  placeholder="admin@example.com" required className="input-base w-full" />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1.5">Password</label>
                <input type="password" value={password} onChange={e => setPassword(e.target.value)}
                  placeholder="demo" required className="input-base w-full" />
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
                {status === 'loading' ? 'Signing in…' : 'Enter workspace →'}
              </button>
            </form>
          )}

          {/* Magic link form */}
          {mode === 'magic' && status !== 'sent' && (
            <form onSubmit={handleMagic} className="space-y-4">
              <div>
                <label className="block text-xs text-gray-400 mb-1.5">Email</label>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                  placeholder="admin@example.com" required className="input-base w-full" />
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
                  <p className="text-[10px] text-gray-600 mb-1.5">Demo mode — login URL returned in response:</p>
                  <a href={magicLink} className="text-[10px] text-blue-400 break-all hover:underline font-mono">{magicLink}</a>
                </div>
              )}
            </div>
          )}

          {/* Footer */}
          <div className="mt-8 pt-5 border-t border-white/[0.05] space-y-3">
            <p className="text-[10px] text-gray-700 text-center">
              This is a public demo deployment of{' '}
              <a href="https://github.com/jesseboudreau80/aegis-lite"
                target="_blank" rel="noopener noreferrer"
                className="text-gray-500 hover:text-gray-300 transition-colors">
                Aegis Lite
              </a>
              .
              Data resets periodically.
            </p>
            <p className="text-[10px] text-gray-700 text-center">
              Self-hosting?{' '}
              <a href="https://github.com/jesseboudreau80/aegis-lite/blob/main/docs/SETUP.md"
                target="_blank" rel="noopener noreferrer"
                className="text-gray-500 hover:text-gray-300 transition-colors">
                Read the setup guide →
              </a>
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
