import Link from 'next/link'

export const metadata = {
  title: 'Privacy — Aegis Lite',
  description: 'How Aegis Lite handles your data and AI request telemetry.',
}

const SECTION = 'text-sm font-semibold text-white mb-3 mt-8 first:mt-0'
const P       = 'text-[13px] text-gray-400 leading-relaxed mb-4'
const LI      = 'text-[13px] text-gray-400 leading-relaxed'

export default function PrivacyPage() {
  return (
    <div className="min-h-screen" style={{ background: 'var(--surface-1)' }}>
      {/* Nav */}
      <header className="sticky top-0 z-50 border-b border-white/[0.06]"
        style={{ background: 'rgba(7,7,15,0.9)', backdropFilter: 'blur(20px)' }}>
        <div className="max-w-3xl mx-auto px-6 h-12 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="logo-mark" style={{ width: 22, height: 22, fontSize: 10, borderRadius: 6 }}>A</div>
            <span className="text-sm font-semibold text-white">Aegis Lite</span>
          </Link>
          <Link href="/" className="text-xs text-gray-500 hover:text-gray-300 transition-colors">← Back</Link>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-6 py-16">
        {/* Header */}
        <div className="mb-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-[10px] border border-blue-500/20 bg-blue-500/[0.06] text-blue-400 mb-5 font-mono">
            governance-first · open-source · self-hosted
          </div>
          <h1 className="text-2xl font-bold text-white mb-3">Privacy Policy</h1>
          <p className={P}>
            Aegis Lite is open-source software (Apache 2.0). This document describes how data flows through the platform
            when you self-host it or use the public demonstration deployment at{' '}
            <span className="font-mono text-gray-300">aegis-lite.jesseboudreau.com</span>.
          </p>
          <p className="text-[11px] font-mono text-gray-600">Last updated: May 2026</p>
        </div>

        <div className="h-px mb-10" style={{ background: 'rgba(255,255,255,0.06)' }} />

        {/* Sections */}
        <h2 className={SECTION}>1. What Aegis Lite is</h2>
        <p className={P}>
          Aegis Lite is a governance and observability layer that sits between users and AI inference providers.
          Every request passes through a deterministic policy engine (10 ordered rules, zero LLM calls inside
          the engine) before being dispatched. All request and response metadata is written to an immutable
          local audit log.
        </p>
        <p className={P}>
          Aegis Lite is designed to be self-hosted. When you run your own instance, all data stays within
          your infrastructure. The public demo at <span className="font-mono text-gray-300">aegis-lite.jesseboudreau.com</span> is
          a shared demonstration environment intended for evaluation only.
        </p>

        <h2 className={SECTION}>2. Data collected and stored</h2>
        <p className={P}>The following data is persisted in the local SQLite database (or PostgreSQL in production configurations):</p>
        <ul className="list-disc pl-5 space-y-2 mb-4">
          {[
            'User account: email address, hashed password (bcrypt), role, created_at',
            'AI requests: prompt text (truncated to 2,000 chars), response text (truncated to 2,000 chars), model used, token counts, cost estimates',
            'Policy decisions: decision type (allow/warn/modify/escalate/block), risk score, triggered rule flags, policy version',
            'Governance events: rule traces, actor identity, timestamps — used for the audit log and activity feed',
            'Usage ledger: cumulative cost per user, monthly budget state',
          ].map(item => <li key={item} className={LI}>{item}</li>)}
        </ul>
        <p className={P}>
          Full prompt and response text are <strong className="text-gray-200">not</strong> stored beyond 2,000 characters per request.
          Audio recordings from voice input are never stored — only the transcribed text is used.
        </p>

        <h2 className={SECTION}>3. Governed inference and external providers</h2>
        <p className={P}>
          When a request is approved by the policy engine, it is dispatched to an external AI provider.
          The following providers may receive your prompt text:
        </p>
        <ul className="list-disc pl-5 space-y-2 mb-4">
          {[
            'OpenRouter (openrouter.ai) — for free-tier models (Llama, GPT OSS, Gemma)',
            'Anthropic — if ANTHROPIC_API_KEY is configured (Claude models)',
            'OpenAI — if OPENAI_API_KEY is configured (GPT-4o)',
            'Perplexity — if PERPLEXITY_API_KEY is configured (web research)',
          ].map(item => <li key={item} className={LI}>{item}</li>)}
        </ul>
        <p className={P}>
          The governance policy engine enforces data classification rules before dispatch.
          Content classified as <strong className="text-gray-200">restricted</strong> is blocked from external providers.
          Content classified as <strong className="text-gray-200">confidential</strong> triggers escalation when routed to external APIs.
          PII (personally identifiable information) is detected and redacted before dispatch.
        </p>

        <h2 className={SECTION}>4. File attachments and voice input</h2>
        <p className={P}>
          File attachments are read in-browser and passed as text context to the governed inference request.
          Files are <strong className="text-gray-200">not</strong> stored on the Aegis Lite server. Only the text content
          (up to 4,000 characters) is included in the AI request payload, which is governed and audited.
        </p>
        <p className={P}>
          Voice input uses the browser&apos;s native Speech Recognition API. Audio is processed on-device by the browser;
          only the resulting text transcript is sent to Aegis Lite.
        </p>

        <h2 className={SECTION}>5. Early access / waitlist</h2>
        <p className={P}>
          If you submit your email through the early access form, it is stored in a local JSON file
          (<span className="font-mono text-gray-300">.data/early_access.json</span>) on the server.
          This data is not sold or shared. It is used only to communicate updates about Aegis Lite.
        </p>

        <h2 className={SECTION}>6. Cookies and sessions</h2>
        <p className={P}>
          Aegis Lite uses a single session cookie (<span className="font-mono text-gray-300">aegis_session</span>) to
          maintain authenticated state. This cookie contains no personal data. Authentication uses signed JWTs
          with a configurable expiry (default: 8 hours). No third-party tracking cookies are used.
        </p>

        <h2 className={SECTION}>7. Data retention</h2>
        <p className={P}>
          On the public demo deployment, audit logs and governance events are retained indefinitely for
          operational purposes. In a self-hosted deployment, you control the database and can delete
          records at any time. There is no automated deletion schedule in the default configuration.
        </p>

        <h2 className={SECTION}>8. OSS transparency</h2>
        <p className={P}>
          Aegis Lite is fully open-source. The complete source code, including all data handling logic,
          is available at{' '}
          <a href="https://github.com/jesseboudreau80/aegis-lite" target="_blank" rel="noopener noreferrer"
            className="text-blue-400 hover:underline">
            github.com/jesseboudreau80/aegis-lite
          </a>. You can inspect exactly what is stored and how.
        </p>

        <h2 className={SECTION}>9. Contact</h2>
        <p className={P}>
          Questions about this policy or data handling:{' '}
          <a href="https://github.com/jesseboudreau80/aegis-lite/issues" target="_blank" rel="noopener noreferrer"
            className="text-blue-400 hover:underline">
            open an issue on GitHub
          </a>.
        </p>

        <div className="h-px mt-12 mb-8" style={{ background: 'rgba(255,255,255,0.06)' }} />
        <div className="flex items-center justify-between">
          <Link href="/" className="text-xs text-gray-600 hover:text-gray-400 transition-colors">← Back to Aegis Lite</Link>
          <Link href="/terms" className="text-xs text-gray-600 hover:text-gray-400 transition-colors">Terms →</Link>
        </div>
      </div>
    </div>
  )
}
