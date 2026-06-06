'use client';

import { useEffect, useState } from 'react';

type Status = 'checking' | 'connected' | 'degraded' | 'offline';

const DOT: Record<Status, string> = {
  checking:  'bg-slate-500',
  connected: 'bg-[#22c55e] animate-pulse',
  degraded:  'bg-amber-400 animate-pulse',
  offline:   'bg-red-500',
};

const LABEL: Record<Status, string> = {
  checking:  'Checking…',
  connected: 'Connected',
  degraded:  'Degraded',
  offline:   'Offline',
};

export default function AegisBadge() {
  const [status, setStatus] = useState<Status>('checking');

  useEffect(() => {
    let cancelled = false;

    const check = async () => {
      try {
        const res = await fetch('https://hermes-api.jesseboudreau.com/health', {
          signal: AbortSignal.timeout(5000),
          cache: 'no-store',
        });
        const data = await res.json();
        if (!cancelled) setStatus(data.status === 'ok' ? 'connected' : 'degraded');
      } catch {
        if (!cancelled) setStatus('offline');
      }
    };

    check();
    const t = setInterval(check, 60_000);
    return () => { cancelled = true; clearInterval(t); };
  }, []);

  return (
    <div className="fixed bottom-4 left-4 z-40 flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[#1A1A18]/80 border border-[rgba(255,255,255,0.07)] backdrop-blur-sm hover:bg-[#1A1A18] transition-colors group">
      {/* Shield icon */}
      <svg className="w-3.5 h-3.5 shrink-0 text-[#22c55e]" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 2L3 7v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V7l-9-5zm-1.5 10.59l-2.12-2.12 1.06-1.06L10.5 10.47l4.12-4.12 1.06 1.06-5.18 5.18z"/>
      </svg>
      <a
        href="https://aegis.jesseboudreau.com"
        target="_blank"
        rel="noopener noreferrer"
        className="text-[10px] font-medium text-[rgba(250,250,247,0.5)] group-hover:text-[rgba(250,250,247,0.8)] transition-colors whitespace-nowrap"
      >
        Governed by Aegis
      </a>
      {/* Status dot */}
      <span
        className={`w-1.5 h-1.5 rounded-full shrink-0 ${DOT[status]}`}
        title={LABEL[status]}
      />
    </div>
  );
}
