'use client'

import Link from 'next/link'
import { createPortal } from 'react-dom'
import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'
import { getOnboardingHref, ONBOARDING_EVENT } from './OnboardingGuide'

const NAV = [
  {
    href: '/dashboard',
    label: 'Dashboard',
    icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z',
  },
  {
    href: '/chat',
    label: 'Chat',
    icon: 'M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z',
  },
  {
    href: '/playbooks',
    label: 'Playbooks',
    icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01',
  },
  {
    href: '/agents',
    label: 'Agents',
    icon: 'M9 3H5a2 2 0 00-2 2v4m6-6h10a2 2 0 012 2v4M9 3v18m0 0h10a2 2 0 002-2V9M9 21H5a2 2 0 01-2-2V9m0 0h18',
  },
  {
    href: '/knowledge',
    label: 'Knowledge',
    icon: 'M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253',
  },
  {
    href: '/workspaces',
    label: 'Workspaces',
    icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z',
  },
]

const ADMIN_NAV = [
  {
    href: '/governance',
    label: 'Governance',
    icon: 'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z',
  },
  {
    href: '/governance/executive',
    label: 'Executive',
    icon: 'M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z',
  },
]

interface Props {
  currentPage?: string
  compact?: boolean
}

function NavIcon({ d }: { d: string }) {
  return (
    <svg className="w-[15px] h-[15px] flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d={d} />
    </svg>
  )
}

export default function AppNav({ currentPage }: Props) {
  const pathname         = usePathname()
  const { user, logout } = useAuth()
  const isAdmin          = user?.role === 'admin'
  const [onboardingHref, setOnboardingHref] = useState<string | null>(null)
  const [drawerOpen, setDrawerOpen]         = useState(false)
  const [mounted,    setMounted]            = useState(false)

  useEffect(() => { setMounted(true) }, [])

  useEffect(() => {
    const check = () => setOnboardingHref(getOnboardingHref())
    check()
    window.addEventListener(ONBOARDING_EVENT, check)
    window.addEventListener('storage', check)
    return () => {
      window.removeEventListener(ONBOARDING_EVENT, check)
      window.removeEventListener('storage', check)
    }
  }, [])

  useEffect(() => {
    document.body.style.overflow = drawerOpen ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [drawerOpen])

  const isActive = (href: string) =>
    currentPage
      ? href === currentPage
      : pathname === href || (href !== '/chat' && pathname.startsWith(href + '/'))

  const allNav = [...NAV, ...(isAdmin ? ADMIN_NAV : [])]
  const currentItem = allNav.find(n => isActive(n.href))

  // Build the drawer as a plain JSX element (not a component) so React doesn't
  // try to reconcile component identity across re-renders (which would cause
  // unmount/remount flicker with a nested function component).
  const drawerEl = mounted && drawerOpen ? (
    <div
      className="fixed inset-0 flex"
      style={{ zIndex: 9999 }}
      aria-modal="true"
      role="dialog"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/75"
        onClick={() => setDrawerOpen(false)}
      />

      {/* Slide-over panel */}
      <div
        className="relative flex flex-col h-full flex-shrink-0"
        style={{
          width: 'min(288px, 85vw)',
          background: '#0e0e1a',
          borderRight: '1px solid rgba(255,255,255,0.08)',
          boxShadow: '4px 0 40px rgba(0,0,0,0.6)',
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-4 border-b border-white/[0.07]">
          <div className="flex items-center gap-3">
            <div className="logo-mark flex-shrink-0" style={{ width: 26, height: 26 }}>A</div>
            <div>
              <div className="text-sm font-semibold text-white leading-none">Aegis Lite</div>
              <div className="text-[10px] text-gray-600 mt-0.5">AI Governance Platform</div>
            </div>
          </div>
          <button
            onClick={() => setDrawerOpen(false)}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-500 hover:text-gray-200 transition-colors cursor-pointer"
            style={{ background: 'rgba(255,255,255,0.05)' }}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Nav links */}
        <nav className="flex-1 overflow-y-auto py-3" aria-label="App navigation">
          {NAV.map(({ href, label, icon }) => {
            const active = isActive(href)
            const pulse  = onboardingHref === href && !active
            return (
              <Link
                key={href}
                href={href}
                onClick={() => setDrawerOpen(false)}
                className="relative flex items-center gap-4 px-4 py-3.5 text-sm transition-colors"
                style={{
                  color:      active ? '#f9fafb' : '#9ca3af',
                  fontWeight: active ? 600 : 400,
                  background: active ? 'rgba(59,130,246,0.08)' : 'transparent',
                  borderLeft: active ? '2px solid #3b82f6' : '2px solid transparent',
                }}
              >
                <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d={icon} />
                </svg>
                {label}
                {pulse && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-blue-400 pulse-dot" />}
              </Link>
            )
          })}

          {isAdmin && (
            <>
              <div className="mx-4 my-3 border-t border-white/[0.06]" />
              <p className="px-4 pb-2 text-[10px] font-semibold uppercase tracking-widest text-gray-700">Admin</p>
              {ADMIN_NAV.map(({ href, label, icon }) => {
                const active = isActive(href)
                return (
                  <Link
                    key={href}
                    href={href}
                    onClick={() => setDrawerOpen(false)}
                    className="flex items-center gap-4 px-4 py-3.5 text-sm transition-colors"
                    style={{
                      color:      active ? '#f9fafb' : '#9ca3af',
                      fontWeight: active ? 600 : 400,
                      background: active ? 'rgba(59,130,246,0.08)' : 'transparent',
                      borderLeft: active ? '2px solid #3b82f6' : '2px solid transparent',
                    }}
                  >
                    <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d={icon} />
                    </svg>
                    {label}
                  </Link>
                )
              })}
            </>
          )}
        </nav>

        {/* Footer */}
        <div className="px-4 py-3.5 border-t border-white/[0.06] flex items-center justify-between">
          <div className="text-[10px] font-mono text-gray-700">Policy engine active</div>
          {user && (
            <button
              onClick={() => { setDrawerOpen(false); logout() }}
              className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-300 transition-colors cursor-pointer"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              Sign out
            </button>
          )}
        </div>
      </div>
    </div>
  ) : null

  return (
    <>
      {/* ── Desktop nav ─────────────────────────────────────────────────── */}
      <nav className="hidden md:flex items-center gap-0.5" aria-label="App navigation">
        {NAV.map(({ href, label, icon }) => {
          const active = isActive(href)
          const pulse  = onboardingHref === href && !active
          const base   = 'relative flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs transition-all duration-150'
          return active ? (
            <span key={href} className={`${base} font-medium text-white`}
              style={{ background: 'rgba(255,255,255,0.08)', boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.08)' }}>
              {pulse && <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-blue-400 pulse-dot" />}
              <NavIcon d={icon} />{label}
            </span>
          ) : (
            <Link key={href} href={href}
              className={`${base} text-gray-500 hover:text-gray-200 hover:bg-white/[0.05]`}>
              {pulse && <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-blue-400 pulse-dot" />}
              <NavIcon d={icon} />{label}
            </Link>
          )
        })}

        {isAdmin && (
          <>
            <div className="w-px mx-1" style={{ height: 16, background: 'rgba(255,255,255,0.08)' }} />
            {ADMIN_NAV.map(({ href, label, icon }) => {
              const active = isActive(href)
              const base   = 'relative flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs transition-all duration-150'
              return active ? (
                <span key={href} className={`${base} font-medium text-white`}
                  style={{ background: 'rgba(255,255,255,0.08)', boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.08)' }}>
                  <NavIcon d={icon} />{label}
                </span>
              ) : (
                <Link key={href} href={href}
                  className={`${base} text-gray-500 hover:text-gray-200 hover:bg-white/[0.05]`}>
                  <NavIcon d={icon} />{label}
                </Link>
              )
            })}
          </>
        )}
      </nav>

      {/* ── Mobile: hamburger + current page label ─────────────────────── */}
      <div className="flex md:hidden items-center gap-2">
        <button
          onClick={() => setDrawerOpen(true)}
          aria-label="Open navigation"
          className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/[0.07] transition-all cursor-pointer">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
        {currentItem && (
          <span className="text-sm font-medium text-white">{currentItem.label}</span>
        )}
      </div>

      {/* Drawer — portaled to document.body to escape any backdrop-filter
          stacking context (iOS Safari clips fixed children to the ancestor) */}
      {drawerEl && createPortal(drawerEl, document.body)}
    </>
  )
}
