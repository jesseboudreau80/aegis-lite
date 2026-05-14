import type { NextConfig } from 'next'

const BACKEND_URL = process.env.API_URL || 'http://127.0.0.1:8107'

// Security headers applied to every response.
// Cloudflare handles TLS termination; these headers are sent inside the tunnel.
const SECURITY_HEADERS = [
  // Tell browsers to always use HTTPS for this origin for 1 year.
  // Only send after Cloudflare "Always Use HTTPS" is enabled — prevents HSTS
  // being set on an HTTP response, which some browsers treat as an error.
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=31536000; includeSubDomains',
  },
  // Block this site from being framed by other origins.
  // Governance dashboards should never be embeddable cross-origin.
  {
    key: 'X-Frame-Options',
    value: 'DENY',
  },
  // Prevent MIME-type sniffing. Stops browsers from interpreting files as a
  // different MIME type than declared (e.g. treating a text file as JS).
  {
    key: 'X-Content-Type-Options',
    value: 'nosniff',
  },
  // Send only the origin (no path/query) in the Referer header when navigating
  // to a different origin. Prevents leaking governance page paths externally.
  {
    key: 'Referrer-Policy',
    value: 'strict-origin-when-cross-origin',
  },
  // Constrain browser feature access. Microphone allowed on same origin only
  // (voice input feature). Camera and geolocation blocked entirely.
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(self), geolocation=()',
  },
  // Prevent browsers from making DNS prefetch requests for external links,
  // which could leak that a user visited this page.
  {
    key: 'X-DNS-Prefetch-Control',
    value: 'off',
  },
]

const nextConfig: NextConfig = {
  experimental: {
    // Extend proxy timeout to cover OpenRouter free-tier latency (45s) + overhead
    proxyTimeout: 90_000,
  },
  async headers() {
    return [
      {
        // Apply security headers to all routes
        source: '/(.*)',
        headers: SECURITY_HEADERS,
      },
    ]
  },
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${BACKEND_URL}/:path*`,
      },
    ]
  },
}

export default nextConfig
