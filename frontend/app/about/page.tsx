import Link from 'next/link'

export const metadata = {
  title: 'About — Aegis Lite',
  description: 'The governance-first philosophy behind Aegis Lite, and how it differs from general-purpose AI wrappers.',
}

const SECTION  = 'text-sm font-semibold text-white mb-3 mt-10 first:mt-0'
const P        = 'text-[13px] text-gray-400 leading-relaxed mb-4'
const MONO     = 'font-mono text-[11px] text-gray-600'

const PRINCIPLES = [
  {
    title: 'Policy before inference',
    body: 'Every request passes through a deterministic policy engine before a single token is dispatched to any model. The engine evaluates 10 ordered rules — from secrets detection to risk score thresholds — with no LLM calls and no probabilistic decisions.',
    color: '#3b82f6',
  },
  {
    title: 'Immutable audit trail',
    body: 'Every request, response, policy decision, and governance event is written to an append-only audit log. The record cannot be modified after the fact. You can always answer: what was sent, to which model, with what policy outcome, at what cost.',
    color: '#6366f1',
  },
  {
    title: 'Explainable routing',
    body: 'Users see "Governed Free Model" — not "llama3" or "openai/gpt-oss-20b:free". The governance layer abstracts provider identity. Routing decisions (fallbacks, budget downgrades, policy overrides) are traceable in the execution trace on every response.',
    color: '#10b981',
  },
  {
    title: 'Determinism over heuristics',
    body: 'The policy engine is rule-based. Given the same prompt and context, it produces the same decision every time. No temperature, no sampling, no ML model inside the governance path. This is intentional — governance requires predictability.',
    color: '#f59e0b',
  },
  {
    title: 'Self-hosted first',
    body: 'Aegis Lite is designed to run inside your infrastructure. Your prompts and responses are not sent to any third-party governance service. External AI providers receive data only when a governed request is approved and dispatched.',
    color: '#ef4444',
  },
]

const GOOD_FIRST_ISSUES = [
  { n: 1,  title: 'Write policy engine unit tests',          label: 'testing',    effort: 'Small' },
  { n: 2,  title: 'Add IBAN/UK NI detection to PII rules',   label: 'policy',     effort: 'Small' },
  { n: 5,  title: 'Write Railway / Fly.io deploy guides',    label: 'docs',       effort: 'Small' },
  { n: 7,  title: 'Improve mobile nav responsiveness',       label: 'frontend',   effort: 'Small' },
  { n: 11, title: 'Expand OpenRouter model catalog',         label: 'providers',  effort: 'Medium' },
  { n: 15, title: 'Docker Compose dev + prod profiles',      label: 'deployment', effort: 'Medium' },
]

const LABEL_COLOR: Record<string, string> = {
  testing:    '#3b82f6',
  policy:     '#6366f1',
  docs:       '#10b981',
  frontend:   '#f59e0b',
  providers:  '#8b5cf6',
  deployment: '#06b6d4',
}

export default function AboutPage() {
  return (
    <div className="min-h-screen" style={{ background: 'var(--surface-1)' }}>

      {/* Nav */}
      <header className="sticky top-0 z-50 border-b border-white/[0.06]"
        style={{ background: 'rgba(7,7,15,0.9)', backdropFilter: 'blur(20px)' }}>
        <div className="max-w-4xl mx-auto px-6 h-12 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="logo-mark" style={{ width: 22, height: 22, fontSize: 10, borderRadius: 6 }}>A</div>
            <span className="text-sm font-semibold text-white">Aegis Lite</span>
          </Link>
          <nav className="flex items-center gap-4">
            <a href="https://github.com/jesseboudreau80/aegis-lite" target="_blank" rel="noopener noreferrer"
              className="text-xs text-gray-500 hover:text-gray-300 transition-colors">GitHub</a>
            <Link href="/login"
              className="text-xs font-medium text-white px-3 py-1.5 rounded-lg transition-all hover:opacity-90"
              style={{ background: 'linear-gradient(135deg, #3b82f6, #6366f1)' }}>
              Try workspace
            </Link>
          </nav>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-6 py-16">

        {/* Hero */}
        <div className="mb-16">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-[10px] border border-blue-500/20 bg-blue-500/[0.06] text-blue-400 mb-6 font-mono">
            <div className="w-1.5 h-1.5 rounded-full bg-blue-400" style={{ animation: 'pulse-dot 2.2s ease-in-out infinite' }} />
            Open Source · Apache 2.0 · Self-hostable
          </div>
          <h1 className="text-3xl font-bold text-white mb-4 leading-tight">
            Governance infrastructure<br />for AI that runs in production.
          </h1>
          <p className={P} style={{ fontSize: 16, maxWidth: 640 }}>
            Aegis Lite is the open-source foundation for governing how AI is used inside your organization —
            not by wrapping models, but by enforcing policy before every inference request.
          </p>
        </div>

        <div className="h-px mb-16" style={{ background: 'rgba(255,255,255,0.06)' }} />

        {/* The problem */}
        <div className="mb-16">
          <h2 className={SECTION} style={{ marginTop: 0 }}>Why this exists</h2>
          <p className={P}>
            Most AI deployments have no governance layer. Engineers connect employees directly to LLMs via thin
            wrapper APIs. There is no visibility into what is being sent, no enforcement of data classification
            rules, no audit trail, and no cost control. When something goes wrong — a credential leak, a
            jailbreak, a PII exposure — there is no record and no interceptor.
          </p>
          <p className={P}>
            Enterprise governance products exist, but they are expensive, closed-source, and often require
            multi-quarter procurement cycles. The open-source alternatives tend to be thin logging layers or
            prompt libraries, not governance engines.
          </p>
          <p className={P}>
            Aegis Lite is the middle path: a real governance infrastructure layer that you can self-host,
            inspect, and extend — without a vendor contract.
          </p>
        </div>

        {/* Principles grid */}
        <div className="mb-16">
          <h2 className={SECTION}>Design principles</h2>
          <div className="grid sm:grid-cols-2 gap-4 mt-4">
            {PRINCIPLES.map(({ title, body, color }) => (
              <div key={title}
                className="rounded-2xl p-5 border"
                style={{ background: 'var(--surface-2)', borderColor: 'rgba(255,255,255,0.07)' }}>
                <div className="flex items-center gap-2.5 mb-3">
                  <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: color }} />
                  <h3 className="text-[13px] font-semibold text-white">{title}</h3>
                </div>
                <p className="text-[12px] text-gray-500 leading-relaxed">{body}</p>
              </div>
            ))}
            {/* Fifth principle takes full width */}
          </div>
        </div>

        {/* What it is and isn't */}
        <div className="mb-16 grid sm:grid-cols-2 gap-8">
          <div>
            <h2 className={SECTION} style={{ marginTop: 0 }}>What Aegis Lite is</h2>
            <ul className="space-y-2.5">
              {[
                'A policy engine that runs before every AI inference request',
                'An immutable audit log of every AI interaction in your workspace',
                'A multi-provider router with budget controls and fallback chains',
                'A governance observability layer with real-time event telemetry',
                'An open-source foundation for building governed AI applications',
                'A self-hosted platform — your data stays in your infrastructure',
              ].map(item => (
                <li key={item} className="flex items-start gap-2">
                  <span className="text-emerald-500 mt-0.5 flex-shrink-0 text-sm">✓</span>
                  <span className="text-[12px] text-gray-400 leading-relaxed">{item}</span>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h2 className={SECTION} style={{ marginTop: 0 }}>What it is not</h2>
            <ul className="space-y-2.5">
              {[
                'An AI model or inference provider',
                'A guarantee of compliance with SOC 2, HIPAA, GDPR, or the EU AI Act',
                'A substitute for legal review of your AI usage',
                'A complete security solution — it is one layer among many',
                'A multi-tenant SaaS platform — it is designed for single-org deployment',
                'An AI assistant, chatbot, or consumer product',
              ].map(item => (
                <li key={item} className="flex items-start gap-2">
                  <span className="text-gray-600 mt-0.5 flex-shrink-0 text-sm">✕</span>
                  <span className="text-[12px] text-gray-500 leading-relaxed">{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Aegis Lite vs Enterprise */}
        <div className="mb-16 rounded-2xl p-6 border border-white/[0.07]"
          style={{ background: 'var(--surface-2)' }}>
          <h2 className="text-sm font-semibold text-white mb-4">Aegis Lite vs. Aegis AI (enterprise)</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-[12px]">
              <thead>
                <tr className="border-b border-white/[0.06]">
                  <th className="text-left py-2 pr-6 text-gray-600 font-medium">Capability</th>
                  <th className="text-left py-2 pr-6 text-blue-400 font-medium">Aegis Lite (OSS)</th>
                  <th className="text-left py-2 text-gray-500 font-medium">Aegis AI (Enterprise)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04]">
                {[
                  ['Policy engine', '10-rule chain, configurable thresholds', 'Extended rule library, custom rule authoring'],
                  ['Audit log', 'SQLite / PostgreSQL, local only', 'Centralized, multi-tenant, immutable cloud storage'],
                  ['Model routing', 'OpenRouter, Anthropic, OpenAI, Perplexity', '+ private model endpoints, on-prem LLMs'],
                  ['Multi-tenancy', 'Single organization', 'Full org/team/project isolation'],
                  ['SSO / SCIM', 'Not included', 'SAML, OIDC, SCIM provisioning'],
                  ['Approval workflows', 'Not included', 'Human-in-the-loop escalation queues'],
                  ['Compliance reports', 'Audit explorer only', 'Automated SOC 2 / ISO evidence export'],
                  ['Deployment', 'Self-hosted, manual', 'Managed cloud or private VPC'],
                  ['License', 'Apache 2.0', 'Commercial'],
                ].map(([cap, lite, ent]) => (
                  <tr key={cap}>
                    <td className="py-2.5 pr-6 text-gray-400 font-medium">{cap}</td>
                    <td className="py-2.5 pr-6 text-gray-300">{lite}</td>
                    <td className="py-2.5 text-gray-500">{ent}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-[11px] text-gray-600 mt-4">
            Aegis AI enterprise enquiries:{' '}
            <a href="https://aegis.jesseboudreau.com" target="_blank" rel="noopener noreferrer"
              className="text-blue-500 hover:underline">aegis.jesseboudreau.com</a>
          </p>
        </div>

        {/* Contributor section */}
        <div className="mb-16">
          <h2 className={SECTION}>Contributing</h2>
          <p className={P}>
            Aegis Lite is shaped by what the community needs. The governance problem space is large —
            there are many directions worth pursuing: better PII detection, Docker deployment, additional
            provider integrations, richer policy authoring, vector search governance.
          </p>
          <p className={P}>
            Start here:
          </p>

          <div className="space-y-2 mb-6">
            {GOOD_FIRST_ISSUES.map(({ n, title, label, effort }) => (
              <a key={n}
                href={`https://github.com/jesseboudreau80/aegis-lite/issues/${n}`}
                target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-3 rounded-xl px-4 py-3 border border-white/[0.06] hover:border-white/[0.1] transition-colors group"
                style={{ background: 'var(--surface-2)' }}>
                <span className={MONO + ' flex-shrink-0'}>#{n}</span>
                <span className="text-[12px] text-gray-300 flex-1 group-hover:text-white transition-colors">{title}</span>
                <span className="text-[9px] px-2 py-0.5 rounded-full font-mono flex-shrink-0"
                  style={{ background: `${LABEL_COLOR[label]}15`, color: LABEL_COLOR[label], border: `1px solid ${LABEL_COLOR[label]}30` }}>
                  {label}
                </span>
                <span className="text-[9px] text-gray-700 flex-shrink-0 font-mono">{effort}</span>
              </a>
            ))}
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <a href="https://github.com/jesseboudreau80/aegis-lite/blob/main/CONTRIBUTING.md"
              target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white rounded-xl transition-all hover:opacity-90"
              style={{ background: 'linear-gradient(135deg, #3b82f6, #6366f1)' }}>
              Contributing guide →
            </a>
            <a href="https://github.com/jesseboudreau80/aegis-lite/discussions"
              target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs text-gray-400 hover:text-gray-200 rounded-xl border border-white/[0.07] hover:border-white/[0.12] transition-all">
              GitHub Discussions
            </a>
            <a href="https://github.com/jesseboudreau80/aegis-lite/issues/new?template=bug_report.md"
              target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs text-gray-400 hover:text-gray-200 rounded-xl border border-white/[0.07] hover:border-white/[0.12] transition-all">
              Report a bug
            </a>
          </div>
        </div>

        {/* Project origin */}
        <div className="mb-16 rounded-2xl p-6 border border-white/[0.07]"
          style={{ background: 'var(--surface-2)' }}>
          <h2 className="text-sm font-semibold text-white mb-3">Origin and context</h2>
          <p className="text-[12px] text-gray-400 leading-relaxed mb-3">
            Aegis Lite is an extraction from the enterprise{' '}
            <a href="https://aegis.jesseboudreau.com" target="_blank" rel="noopener noreferrer"
              className="text-blue-400 hover:underline">Aegis AI</a>{' '}
            platform, open-sourced under Apache 2.0 so that teams without enterprise budgets can still
            deploy governance infrastructure. The core policy engine, audit model, and provider router
            are identical in architecture to the enterprise edition.
          </p>
          <p className="text-[12px] text-gray-400 leading-relaxed mb-3">
            The project is maintained by{' '}
            <a href="https://github.com/jesseboudreau80" target="_blank" rel="noopener noreferrer"
              className="text-blue-400 hover:underline">Jesse Boudreau</a>.
            Community contributions are encouraged and will shape the v1.1 and beyond roadmap.
          </p>
          <p className={MONO}>
            License: Apache 2.0 · Source: github.com/jesseboudreau80/aegis-lite
          </p>
        </div>

        <div className="h-px mb-10" style={{ background: 'rgba(255,255,255,0.06)' }} />

        <div className="flex items-center justify-between flex-wrap gap-4">
          <Link href="/"
            className="text-xs text-gray-600 hover:text-gray-400 transition-colors">
            ← Back to Aegis Lite
          </Link>
          <div className="flex items-center gap-4">
            <Link href="/privacy" className="text-xs text-gray-700 hover:text-gray-500 transition-colors">Privacy</Link>
            <Link href="/terms" className="text-xs text-gray-700 hover:text-gray-500 transition-colors">Terms</Link>
            <a href="https://github.com/jesseboudreau80/aegis-lite" target="_blank" rel="noopener noreferrer"
              className="text-xs text-gray-700 hover:text-gray-500 transition-colors">GitHub →</a>
          </div>
        </div>
      </div>
    </div>
  )
}
