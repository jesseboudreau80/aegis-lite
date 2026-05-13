import type { NextConfig } from 'next'

const BACKEND_URL = process.env.API_URL || 'http://127.0.0.1:8107'

const nextConfig: NextConfig = {
  experimental: {
    // Extend proxy timeout to cover OpenRouter free-tier latency (45s) + overhead
    proxyTimeout: 90_000,
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
