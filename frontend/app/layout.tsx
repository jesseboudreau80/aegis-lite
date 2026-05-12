import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import { AuthProvider } from '@/context/AuthContext'
import './globals.css'

const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'] })
const geistMono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Aegis Lite — AI Governance Workspace',
  description: 'Open-source AI governance platform. Policy enforcement, audit logging, and model routing for every AI request.',
  openGraph: {
    title: 'Aegis Lite — AI Governance Workspace',
    description: 'Deterministic policy enforcement, structured audit logging, and explainable model routing. Self-hostable, Apache 2.0.',
    type: 'website',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full`}>
      <body className="h-full text-gray-100 antialiased" style={{ background: 'var(--surface-1)' }}>
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  )
}
