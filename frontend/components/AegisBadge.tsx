'use client'

import { useEffect, useState } from 'react'

type Status = 'checking' | 'connected' | 'degraded' | 'offline'

const SESSION_KEY = 'aegis-badge-dismissed'

export default function AegisBadge() {
  const [status,    setStatus]    = useState<Status>('checking')
  const [expanded,  setExpanded]  = useState(true)
  const [dismissed, setDismissed] = useState(false)
  const [mounted,   setMounted]   = useState(false)

  useEffect(() => {
    setMounted(true)
    if (sessionStorage.getItem(SESSION_KEY) === '1') setDismissed(true)
  }, [])

  useEffect(() => {
    let cancelled = false
    const check = async () => {
      try {
        const res  = await fetch('/api/health', {
          signal: AbortSignal.timeout(5000),
          cache: 'no-store',
        })
        const data = await res.json()
        if (!cancelled) setStatus(data.status === 'ok' ? 'connected' : 'degraded')
      } catch {
        if (!cancelled) setStatus('offline')
      }
    }
    check()
    const t = setInterval(check, 60_000)
    return () => { cancelled = true; clearInterval(t) }
  }, [])

  // Auto-collapse 2.5 s after healthy verification
  useEffect(() => {
    if (status !== 'connected') return
    const t = setTimeout(() => setExpanded(false), 2500)
    return () => clearTimeout(t)
  }, [status])

  const handleDismiss = () => {
    sessionStorage.setItem(SESSION_KEY, '1')
    setDismissed(true)
  }

  // SSR guard — don't render until client hydrated
  if (!mounted || dismissed) return null

  const healthy   = status === 'connected'
  const degraded  = status === 'degraded'
  const offline   = status === 'offline'
  const checking  = status === 'checking'

  // Collapsed to tiny seal badge once verified
  if (!expanded) {
    return (
      <button
        onClick={() => setExpanded(true)}
        title={`Aegis governance ${status}`}
        className="fixed bottom-4 left-4 z-40 w-8 h-8 rounded-lg hidden md:flex items-center justify-center transition-all hover:scale-110 cursor-pointer"
        style={{
          background: healthy ? 'rgba(34,197,94,0.10)' : degraded ? 'rgba(245,158,11,0.12)' : 'rgba(239,68,68,0.12)',
          border: healthy ? '1px solid rgba(34,197,94,0.22)' : degraded ? '1px solid rgba(245,158,11,0.28)' : '1px solid rgba(239,68,68,0.28)',
          boxShadow: healthy ? '0 0 8px rgba(34,197,94,0.15)' : 'none',
        }}>
        {/* Status dot */}
        <div style={{
          position: 'absolute', top: 2, right: 2,
          width: 5, height: 5, borderRadius: '50%',
          background: healthy ? '#22c55e' : degraded ? '#f59e0b' : '#ef4444',
          ...(healthy || degraded ? { animation: 'pulse-dot 2.2s ease-in-out infinite' } : {}),
        }} />
        <img
          src="/aegis-shield-sm.webp"
          alt="Aegis"
          style={{
            width: 18, height: 18, objectFit: 'contain',
            filter: healthy
              ? 'brightness(1.1) drop-shadow(0 0 4px rgba(34,197,94,0.5))'
              : degraded
              ? 'brightness(0.9) sepia(0.4) hue-rotate(-10deg) drop-shadow(0 0 4px rgba(245,158,11,0.5))'
              : 'brightness(0.6) saturate(0.3)',
            opacity: healthy ? 1 : degraded ? 0.85 : 0.5,
          }}
        />
      </button>
    )
  }

  const borderColor = checking ? 'rgba(100,116,139,0.2)'
    : healthy   ? 'rgba(34,197,94,0.18)'
    : degraded  ? 'rgba(245,158,11,0.28)'
    : 'rgba(239,68,68,0.28)'

  const bg = checking ? 'rgba(15,15,20,0.88)'
    : healthy   ? 'rgba(10,20,12,0.90)'
    : degraded  ? 'rgba(20,14,4,0.90)'
    : 'rgba(20,6,6,0.90)'

  const iconColor = checking ? '#64748b'
    : healthy   ? '#22c55e'
    : degraded  ? '#f59e0b'
    : '#ef4444'

  const dotClass = checking ? 'bg-slate-500'
    : healthy   ? 'bg-green-500 animate-pulse'
    : degraded  ? 'bg-amber-400 animate-pulse'
    : 'bg-red-500'

  const label = checking ? 'Verifying governance…'
    : healthy   ? 'Governance active'
    : degraded  ? 'Governance degraded'
    : 'Governance offline'

  return (
    <div
      className="fixed bottom-4 left-4 z-40 rounded-xl overflow-hidden hidden md:block"
      style={{ background: bg, border: `1px solid ${borderColor}`, backdropFilter: 'blur(10px)', width: 210 }}>

      {/* Main row */}
      <div className="flex items-center gap-2 px-3 py-2.5">
        <img src="/aegis-shield-sm.webp" alt="Aegis" style={{
          width: 14, height: 14, objectFit: 'contain', flexShrink: 0,
          filter: checking ? 'brightness(0.5) saturate(0)'
            : healthy  ? 'brightness(1.1) drop-shadow(0 0 3px rgba(34,197,94,0.6))'
            : degraded ? 'brightness(0.9) sepia(0.5) hue-rotate(-10deg)'
            : 'brightness(0.6) saturate(0.3)',
          opacity: checking ? 0.4 : 1,
        }} />
        <span className="text-[11px] font-medium text-white flex-1 leading-none">{label}</span>
        <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${dotClass}`} />
        {/* X only when safe to dismiss (not degraded/offline which needs attention) */}
        {(healthy || checking) && (
          <button
            onClick={handleDismiss}
            title="Dismiss"
            className="ml-0.5 text-gray-700 hover:text-gray-400 transition-colors cursor-pointer flex-shrink-0">
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {/* Detail row — only after check completes */}
      {!checking && (
        <div className="px-3 pb-2.5 space-y-1">
          <div className="text-[9px] font-mono" style={{ color: 'rgba(255,255,255,0.22)' }}>
            {healthy  && 'Policy engine v1.1.0 · all controls active'}
            {degraded && <span className="text-amber-500/70">Some controls may be unavailable</span>}
            {offline  && <span className="text-red-500/70">Enforcement paused — check API service</span>}
          </div>
          {(degraded || offline) && (
            <button
              onClick={() => setExpanded(false)}
              className="text-[9px] text-gray-600 hover:text-gray-400 transition-colors cursor-pointer">
              Dismiss
            </button>
          )}
        </div>
      )}
    </div>
  )
}
