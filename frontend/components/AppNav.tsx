'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'

const NAV = [
  {
    href: '/chat',
    label: 'Chat',
    icon: 'M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z',
  },
  {
    href: '/agents',
    label: 'Agents',
    icon: 'M9 3H5a2 2 0 00-2 2v4m6-6h10a2 2 0 012 2v4M9 3v18m0 0h10a2 2 0 002-2V9M9 21H5a2 2 0 01-2-2V9m0 0h18',
  },
  {
    href: '/research',
    label: 'Research',
    icon: 'M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z',
  },
  {
    href: '/dashboard',
    label: 'Dashboard',
    icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z',
  },
]

const ADMIN_NAV = [
  {
    href: '/governance',
    label: 'Governance',
    icon: 'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z',
  },
  {
    href: '/governance/audit',
    label: 'Audit',
    icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4',
  },
  {
    href: '/governance/policies',
    label: 'Policies',
    icon: 'M9 12l2 2 4-4m-6 8a9 9 0 110-18 9 9 0 010 18zm0-14v4m0 4h.01',
  },
  {
    href: '/governance/systems',
    label: 'AI Registry',
    icon: 'M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10',
  },
]

interface Props {
  currentPage?: string
  compact?: boolean
}

function NavItem({
  href, label, icon, active, currentPage, compact,
}: {
  href: string; label: string; icon: string
  active: boolean; currentPage?: string; compact: boolean
}) {
  const base = 'flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs transition-all duration-150'

  if (active && currentPage) {
    return (
      <span className={`${base} font-medium text-white`}
        style={{ background: 'rgba(255,255,255,0.08)', boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.08)' }}>
        <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={icon} />
        </svg>
        {!compact && label}
      </span>
    )
  }

  return (
    <Link href={href}
      className={`${base} text-gray-500 hover:text-gray-200 hover:bg-white/[0.05] ${active ? 'text-white' : ''}`}
      style={active ? { background: 'rgba(255,255,255,0.08)' } : {}}>
      <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={icon} />
      </svg>
      {!compact && label}
    </Link>
  )
}

export default function AppNav({ currentPage, compact = false }: Props) {
  const pathname  = usePathname()
  const { user }  = useAuth()
  const isAdmin   = user?.role === 'admin'

  const isActive = (href: string) =>
    currentPage
      ? href === currentPage
      : pathname === href || (href !== '/chat' && pathname.startsWith(href + '/'))

  return (
    <nav className="flex items-center gap-0.5 flex-wrap" aria-label="App navigation">
      {NAV.map(({ href, label, icon }) => (
        <NavItem key={href} href={href} label={label} icon={icon}
          active={isActive(href)} currentPage={currentPage} compact={compact} />
      ))}

      {isAdmin && (
        <>
          <div className="divider mx-1 hidden sm:block" style={{ height: 16 }} />
          {ADMIN_NAV.map(({ href, label, icon }) => (
            <NavItem key={href} href={href} label={label} icon={icon}
              active={isActive(href)} currentPage={currentPage} compact={compact} />
          ))}
        </>
      )}
    </nav>
  )
}
