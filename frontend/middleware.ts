import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const PUBLIC_EXACT = new Set(['/', '/login', '/privacy', '/terms', '/about'])
const PUBLIC_PREFIXES = [
  '/api/auth/',              // login + magic-link endpoints
  '/api/status',             // public system status (no auth)
  '/api/health',             // liveness probe
  '/api/models',             // model list for landing page
  '/api/early-access',       // waitlist — no auth
  '/api/governance/stream',  // SSE stream — auth via ?token= query param
]

// ── HTTPS enforcement ──────────────────────────────────────────────────────────
//
// Cloudflare sets X-Forwarded-Proto: http on requests that arrived at the edge
// over plain HTTP, even though they travel through the tunnel encrypted.
// Redirecting here at the Next.js layer gives us a belt-and-suspenders redirect
// for any request Cloudflare's "Always Use HTTPS" edge rule missed.
//
// We skip this on localhost (127.x / ::1) so local dev isn't forced to HTTPS.
//
function enforceHttps(request: NextRequest): NextResponse | null {
  const forwardedProto = request.headers.get('x-forwarded-proto')
  const cfVisitor = request.headers.get('cf-visitor') // '{"scheme":"http"}'
  const host = request.headers.get('host') ?? ''

  // Skip redirect on local/dev environments
  const isLocal = host.startsWith('localhost') || host.startsWith('127.') || host.startsWith('::1')
  if (isLocal) return null

  // Determine the protocol Cloudflare received from the client
  let scheme: string | null = forwardedProto
  if (!scheme && cfVisitor) {
    const match = cfVisitor.match(/"scheme"\s*:\s*"(\w+)"/)
    if (match) scheme = match[1]
  }

  if (scheme === 'http') {
    const url = request.nextUrl.clone()
    url.protocol = 'https:'
    // 308 Permanent Redirect preserves the HTTP method (important for POST/SSE)
    return NextResponse.redirect(url, { status: 308 })
  }

  return null
}

export function middleware(request: NextRequest) {
  // Enforce HTTPS before any auth check
  const httpsRedirect = enforceHttps(request)
  if (httpsRedirect) return httpsRedirect

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
