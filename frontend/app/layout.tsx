import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import { AuthProvider } from '@/context/AuthContext'
import OnboardingGuide from '@/components/OnboardingGuide'
import './globals.css'

const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'] })
const geistMono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Aegis Lite — AI Governance Workspace',
  description: 'Open-source AI governance layer. Policy enforcement, structured audit logging, and explainable model routing before every token. Self-hostable, Apache 2.0.',
  keywords: ['AI governance', 'LLM policy engine', 'audit logging', 'open source', 'self-hosted AI', 'enterprise AI governance'],
  authors: [{ name: 'Jesse Boudreau', url: 'https://github.com/jesseboudreau80' }],
  openGraph: {
    title: 'Aegis Lite — AI Governance Workspace',
    description: 'Open-source governance infrastructure for AI. Deterministic policy enforcement, immutable audit logging, real-time telemetry. Apache 2.0.',
    type: 'website',
    url: 'https://aegis-lite.jesseboudreau.com',
    siteName: 'Aegis Lite',
    images: [{ url: '/og.svg', width: 1200, height: 630, alt: 'Aegis Lite — Open Source AI Governance Layer' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Aegis Lite — Open-Source AI Governance',
    description: 'Policy enforcement before every AI token. Deterministic. Auditable. Self-hosted.',
    images: ['/og.svg'],
  },
  icons: {
    icon: [
      { url: '/favicon.svg', type: 'image/svg+xml' },
    ],
    apple: '/favicon.svg',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full`}>
      <head>
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
        <meta name="theme-color" content="#07070f" />
        <meta name="color-scheme" content="dark" />
      </head>
      <body className="h-full text-gray-100 antialiased" style={{ background: 'var(--surface-1)' }}>
        <AuthProvider>
          <OnboardingGuide />
          {children}
        </AuthProvider>
      </body>
    </html>
  )
}
