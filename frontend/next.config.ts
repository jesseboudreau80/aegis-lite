import type { NextConfig } from 'next'

const BACKEND_URL = process.env.API_URL || 'http://127.0.0.1:8107'

const nextConfig: NextConfig = {
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
