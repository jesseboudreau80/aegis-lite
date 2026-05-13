'use client'

import { useEffect, useState } from 'react'

interface StatusData {
  status: string
  demo_mode: boolean
  policy: { version: string; rules_active: number }
  models: { providers: Array<{ name: string; status: string }> }
}

const INDICATORS = [
  { key: 'policy',    label: 'Policy Engine',  icon: 'M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.955 11.955 0 002.25 12c0 3.072 1.15 5.877 3.047 7.987A11.952 11.952 0 0012 21.75a11.95 11.95 0 006.98-2.26A11.96 11.96 0 0021.75 12c0-2.044-.51-3.97-1.41-5.657A11.956 11.956 0 0012 4.964z' },
  { key: 'audit',     label: 'Audit Log',      icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2' },
  { key: 'router',    label: 'AI Router',      icon: 'M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5' },
  { key: 'provider',  label: 'Inference',      icon: 'M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z' },
]

export default function RuntimeStatus() {
  const [status, setStatus] = useState<StatusData | null>(null)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    fetch('/api/status')
      .then(r => r.json())
      .then((d: StatusData) => { setStatus(d); setLoaded(true) })
      .catch(() => setLoaded(true))
  }, [])

  if (!loaded) return null

  const operational = status?.status === 'operational'

  return (
    <div className="flex items-center gap-3 flex-wrap">
      {INDICATORS.map(({ key, label, icon }) => {
        const ok = operational || key === 'audit'
        return (
          <div key={key} className="flex items-center gap-1.5">
            <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${ok ? 'bg-emerald-500' : 'bg-amber-500'}`}
              style={{ boxShadow: ok ? '0 0 4px rgba(16,185,129,0.4)' : '0 0 4px rgba(245,158,11,0.4)' }} />
            <span className="text-[9px] font-mono text-gray-700 hidden sm:block">{label}</span>
          </div>
        )
      })}
      {status && (
        <span className="text-[9px] font-mono text-gray-800 hidden md:block">
          v{status.policy?.version ?? '1.1.0'}
        </span>
      )}
    </div>
  )
}
