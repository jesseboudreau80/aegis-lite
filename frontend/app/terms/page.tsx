import Link from 'next/link'

export const metadata = {
  title: 'Terms of Use — Aegis Lite',
  description: 'Terms governing use of the Aegis Lite open-source AI governance platform.',
}

const SECTION = 'text-sm font-semibold text-white mb-3 mt-8 first:mt-0'
const P       = 'text-[13px] text-gray-400 leading-relaxed mb-4'
const LI      = 'text-[13px] text-gray-400 leading-relaxed'

export default function TermsPage() {
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
            open-source · apache 2.0 · beta
          </div>
          <h1 className="text-2xl font-bold text-white mb-3">Terms of Use</h1>
          <p className={P}>
            These terms apply to use of the Aegis Lite software and the public demonstration deployment at{' '}
            <span className="font-mono text-gray-300">aegis-lite.jesseboudreau.com</span>.
            The software itself is licensed under Apache 2.0 — see the{' '}
            <a href="https://github.com/jesseboudreau80/aegis-lite/blob/main/LICENSE"
              target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">
              LICENSE
            </a> file for the full open-source license.
          </p>
          <p className="text-[11px] font-mono text-gray-600">Last updated: May 2026</p>
        </div>

        <div className="h-px mb-10" style={{ background: 'rgba(255,255,255,0.06)' }} />

        <h2 className={SECTION}>1. What Aegis Lite is</h2>
        <p className={P}>
          Aegis Lite is an experimental, open-source AI governance workspace. It provides a policy engine,
          audit logging, and model routing layer on top of third-party AI inference providers.
        </p>
        <p className={P}>
          Aegis Lite is <strong className="text-gray-200">governance infrastructure</strong>, not an AI model.
          It does not generate AI responses itself — it governs how requests flow to and from external providers.
        </p>

        <h2 className={SECTION}>2. Beta and experimental status</h2>
        <p className={P}>
          Aegis Lite is provided as-is, in active development, without any guarantee of availability,
          accuracy, or fitness for a particular purpose. The public demo deployment may experience
          downtime, data loss, or breaking changes without notice.
        </p>
        <p className={P}>
          <strong className="text-gray-200">Do not use the public demo deployment for sensitive, confidential,
          or production workloads.</strong> For sensitive use cases, self-host the software in your own
          controlled environment using the instructions in the{' '}
          <a href="https://github.com/jesseboudreau80/aegis-lite" target="_blank" rel="noopener noreferrer"
            className="text-blue-400 hover:underline">
            repository
          </a>.
        </p>

        <h2 className={SECTION}>3. Acceptable use</h2>
        <p className={P}>You may use Aegis Lite for:</p>
        <ul className="list-disc pl-5 space-y-2 mb-4">
          {[
            'Evaluating AI governance infrastructure for your organization',
            'Personal or organizational experimentation with policy-enforced AI workflows',
            'Research into deterministic policy engines and AI observability',
            'Contributing to the open-source project',
            'Building governed AI applications on top of the Aegis Lite API',
          ].map(item => <li key={item} className={LI}>{item}</li>)}
        </ul>

        <h2 className={SECTION}>4. Prohibited use</h2>
        <p className={P}>You may not use Aegis Lite (or the public demo deployment) to:</p>
        <ul className="list-disc pl-5 space-y-2 mb-4">
          {[
            'Transmit personal data of third parties without their consent',
            'Attempt to circumvent, reverse-engineer, or disable the policy engine',
            'Conduct denial-of-service attacks or API abuse',
            'Submit content that violates applicable law, including illegal content or hate speech',
            'Represent governance decisions from Aegis Lite as certified compliance (SOC 2, HIPAA, GDPR, etc.) without conducting your own legal assessment',
            'Resell access to the public demo deployment as if it were your own product',
          ].map(item => <li key={item} className={LI}>{item}</li>)}
        </ul>

        <h2 className={SECTION}>5. AI output disclaimer</h2>
        <p className={P}>
          Aegis Lite routes requests to third-party AI inference providers (OpenRouter, Anthropic, OpenAI, Perplexity).
          AI-generated outputs may be inaccurate, incomplete, or inappropriate. Aegis Lite&apos;s governance layer
          can block or modify requests based on configured policy rules, but <strong className="text-gray-200">does not guarantee the
          accuracy, safety, or reliability of AI-generated responses</strong>.
        </p>
        <p className={P}>
          Always apply human review before acting on AI-generated content in professional, legal, medical,
          financial, or safety-critical contexts.
        </p>

        <h2 className={SECTION}>6. Governance limitations</h2>
        <p className={P}>
          Aegis Lite&apos;s policy engine is deterministic and rule-based. It does not provide:
        </p>
        <ul className="list-disc pl-5 space-y-2 mb-4">
          {[
            'Certified compliance with any regulatory standard (SOC 2, ISO 27001, HIPAA, GDPR, EU AI Act)',
            'Legal advice on AI usage in your jurisdiction',
            'Guarantees of complete PII detection — detection is pattern-based and may miss novel formats',
            'Protection against all adversarial prompt injection attacks',
            'Guarantees that AI providers comply with their own stated terms',
          ].map(item => <li key={item} className={LI}>{item}</li>)}
        </ul>

        <h2 className={SECTION}>7. Warranty disclaimer</h2>
        <p className={P}>
          AEGIS LITE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING
          BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND
          NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
          DAMAGES, OR OTHER LIABILITY ARISING FROM USE OF THE SOFTWARE.
        </p>
        <p className={P}>
          See the{' '}
          <a href="https://github.com/jesseboudreau80/aegis-lite/blob/main/LICENSE"
            target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">
            Apache 2.0 License
          </a>{' '}for the full legal text.
        </p>

        <h2 className={SECTION}>8. Changes to these terms</h2>
        <p className={P}>
          These terms may be updated without notice. Continued use of the public demo deployment
          constitutes acceptance of the current terms. Material changes will be noted in the
          repository changelog.
        </p>

        <h2 className={SECTION}>9. Open source</h2>
        <p className={P}>
          Aegis Lite is fully open-source under Apache 2.0. You are free to inspect, fork, modify,
          and distribute the software under the terms of that license. Self-hosted deployments are
          governed only by the Apache 2.0 license, not these terms of use.
        </p>

        <div className="h-px mt-12 mb-8" style={{ background: 'rgba(255,255,255,0.06)' }} />
        <div className="flex items-center justify-between">
          <Link href="/privacy" className="text-xs text-gray-600 hover:text-gray-400 transition-colors">← Privacy Policy</Link>
          <Link href="/" className="text-xs text-gray-600 hover:text-gray-400 transition-colors">Back to Aegis Lite →</Link>
        </div>
      </div>
    </div>
  )
}
