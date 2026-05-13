import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const PUBLIC_EXACT = new Set(['/', '/login'])
const PUBLIC_PREFIXES = [
  '/api/auth/',         // login + magic-link endpoints
  '/api/status',        // public system status (no auth)
  '/api/health',        // liveness probe
  '/api/models',        // model list for landing page
  '/api/early-access',  // waitlist — no auth
]

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  if (PUBLIC_EXACT.has(pathname)) return NextResponse.next()
  if (PUBLIC_PREFIXES.some(p => pathname.startsWith(p))) return NextResponse.next()

  const session = request.cookies.get('aegis_session')
  if (!session || session.value !== 'authenticated') {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:png|jpg|jpeg|gif|svg|webp|ico|woff2?|ttf|eot|otf)$).*)',
  ],
}
