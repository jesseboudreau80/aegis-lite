'use client'

import { useEffect, useRef, useState, useCallback } from 'react'

type Role = 'user' | 'assistant'

interface Meta { model: string; ms: number }
interface Message {
  role: Role
  content: string
  suggestions?: string[]
  meta?: Meta
}

const INITIAL_CHIPS = [
  'What is Aegis Lite?',
  'How does the policy engine work?',
  'I want to evaluate this for my company',
  'How do I contribute?',
  'How is this different from OpenAI guardrails?',
]

// Governance pipeline steps — shown in sequence while AI generates
const GOVERNANCE_STEPS = [
  { step: 1,  label: 'Secrets detection',        detail: 'Scanning for API keys, tokens, credentials' },
  { step: 2,  label: 'Model access check',        detail: 'Verifying tier permissions for this request' },
  { step: 3,  label: 'Agent permissions',         detail: 'Confirming scope and tool grants' },
  { step: 4,  label: 'Data classification',       detail: 'Classifying sensitivity of input content' },
  { step: 5,  label: 'PII detection',             detail: 'Scanning for names, emails, SSNs, IBAN…' },
  { step: 6,  label: 'Injection guard',           detail: 'Checking for prompt injection patterns' },
  { step: 7,  label: 'Sensitive keyword scan',    detail: 'Evaluating topic blocklist against policy' },
  { step: 8,  label: 'Outbound controls',         detail: 'Applying output filtering rules' },
  { step: 9,  label: 'Tool grant evaluation',     detail: 'Scoping function call permissions' },
  { step: 10, label: 'Risk scoring',              detail: 'Computing composite risk score → routing model' },
  { step: 10, label: 'Inference routing',         detail: 'Dispatching to governed provider…' },
]

const THINK_PHRASES = GOVERNANCE_STEPS.map(s => `Step ${s.step}/10 · ${s.label}`)

// ── Markdown renderer ──────────────────────────────────────────────────────────
function parseInline(text: string) {
  return text
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener" style="color:#60a5fa;text-decoration:underline;text-underline-offset:2px">$1</a>')
    .replace(/`([^`]+)`/g, '<code style="background:rgba(255,255,255,0.08);padding:0.1em 0.3em;border-radius:3px;font-size:0.85em;font-family:monospace;color:#86efac">$1</code>')
}

function renderMd(text: string): string {
  const lines = text.split('\n')
  const out: string[] = []
  let inUl = false
  for (const raw of lines) {
    const line = raw.trimEnd()
    if (/^[-*•]\s+/.test(line)) {
      if (!inUl) { out.push('<ul style="margin:0.4rem 0 0.4rem 1rem;padding:0">'); inUl = true }
      out.push(`<li style="margin-bottom:0.2rem">${parseInline(line.replace(/^[-*•]\s+/, ''))}</li>`)
    } else {
      if (inUl) { out.push('</ul>'); inUl = false }
      if (line === '') out.push('<div style="height:0.3rem"></div>')
      else out.push(`<p style="margin:0 0 0.3rem">${parseInline(line)}</p>`)
    }
  }
  if (inUl) out.push('</ul>')
  return out.join('')
}

// ── Parse [SUGGEST: Q1 | Q2] out of text ──────────────────────────────────────
function parseSuggestions(text: string): { clean: string; suggestions: string[] } {
  const match = text.match(/\[SUGGEST:\s*(.+?)\]/)
  if (!match) return { clean: text, suggestions: [] }
  const suggestions = match[1].split('|').map(s => s.trim()).filter(Boolean)
  const clean = text.replace(/\[SUGGEST:.*?\]/g, '').trim()
  return { clean, suggestions }
}

// ── Telemetry bar ──────────────────────────────────────────────────────────────
function MetaBar({ meta }: { meta: Meta }) {
  return (
    <div className="flex items-center gap-2 mt-1.5 px-1" style={{ opacity: 0.45 }}>
      <svg className="w-3 h-3 flex-shrink-0" style={{ color: '#6366f1' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15M14.25 3.104c.251.023.501.05.75.082M19.8 15l-1.8 1.8m0 0l-1.8 1.8m1.8-1.8v-1.8m0 1.8h1.8" />
      </svg>
      <span style={{ fontFamily: 'var(--font-geist-mono)', fontSize: 10, color: '#9ca3af' }}>
        {meta.model}
      </span>
      <span style={{ fontSize: 10, color: '#6b7280' }}>·</span>
      <span style={{ fontFamily: 'var(--font-geist-mono)', fontSize: 10, color: '#9ca3af' }}>
        {meta.ms < 1000 ? `${meta.ms}ms` : `${(meta.ms / 1000).toFixed(1)}s`}
      </span>
    </div>
  )
}

// ── Follow-up chip row ─────────────────────────────────────────────────────────
function SuggestionChips({ chips, onPick }: { chips: string[]; onPick: (s: string) => void }) {
  if (!chips.length) return null
  return (
    <div className="flex flex-col gap-1 mt-2">
      {chips.map(c => (
        <button key={c} onClick={() => onPick(c)}
          className="text-left text-[11px] px-3 py-1.5 rounded-lg transition-all cursor-pointer"
          style={{
            background: 'rgba(99,102,241,0.07)',
            border: '1px solid rgba(99,102,241,0.18)',
            color: 'rgba(250,250,247,0.55)',
          }}
          onMouseEnter={e => { (e.target as HTMLElement).style.color = 'rgba(250,250,247,0.9)'; (e.target as HTMLElement).style.borderColor = 'rgba(99,102,241,0.4)' }}
          onMouseLeave={e => { (e.target as HTMLElement).style.color = 'rgba(250,250,247,0.55)'; (e.target as HTMLElement).style.borderColor = 'rgba(99,102,241,0.18)' }}>
          ↳ {c}
        </button>
      ))}
    </div>
  )
}

// ── Main widget ────────────────────────────────────────────────────────────────
export default function AssistantWidget() {
  const [open, setOpen]           = useState(false)
  const [mounted, setMounted]     = useState(false)
  const [messages, setMessages]   = useState<Message[]>([])
  const [input, setInput]         = useState('')
  const [streaming, setStreaming] = useState(false)
  const [showLead, setShowLead]   = useState(false)
  const [leadDone, setLeadDone]   = useState(false)
  const [leadName, setLeadName]   = useState('')
  const [leadEmail, setLeadEmail] = useState('')
  const [leadOrg, setLeadOrg]     = useState('')
  const [leadIntent, setLeadIntent] = useState('')
  const [thinkIdx, setThinkIdx]   = useState(0)
  const msgEndRef    = useRef<HTMLDivElement>(null)
  const inputRef     = useRef<HTMLTextAreaElement>(null)
  const historyRef   = useRef<Message[]>([])
  const thinkTimer   = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    setMounted(true)
    // Auto-open for first-time visitors; respect explicit close on return visits
    if (!localStorage.getItem('aegis-widget-dismissed')) setOpen(true)
  }, [])
  useEffect(() => { if (open) setTimeout(() => inputRef.current?.focus(), 80) }, [open])
  useEffect(() => { msgEndRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages, streaming])

  useEffect(() => {
    if (streaming) {
      setThinkIdx(Math.floor(Math.random() * THINK_PHRASES.length))
      thinkTimer.current = setInterval(() => {
        setThinkIdx(i => (i + 1) % THINK_PHRASES.length)
      }, 1800)
    } else {
      if (thinkTimer.current) { clearInterval(thinkTimer.current); thinkTimer.current = null }
    }
    return () => { if (thinkTimer.current) clearInterval(thinkTimer.current) }
  }, [streaming])

  const send = useCallback(async (text: string) => {
    const trimmed = text.trim()
    if (!trimmed || streaming) return

    const userMsg: Message = { role: 'user', content: trimmed }
    // Clear suggestions from previous assistant messages so chips don't linger
    const cleared = historyRef.current.map(m =>
      m.role === 'assistant' ? { ...m, suggestions: [] } : m
    )
    const next = [...cleared, userMsg]
    historyRef.current = next
    setMessages([...next])
    setInput('')
    setStreaming(true)

    let fullText = ''
    let signalLead = false
    let receivedMeta: Meta | null = null

    try {
      const resp = await fetch('/api/assistant/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: next.map(m => ({ role: m.role, content: m.content })) }),
      })

      const reader = resp.body!.getReader()
      const decoder = new TextDecoder()
      let buf = ''
      const assistantMsg: Message = { role: 'assistant', content: '' }
      historyRef.current = [...next, assistantMsg]
      setMessages([...next, assistantMsg])

      while (true) {
        const { value, done } = await reader.read()
        if (done) break
        buf += decoder.decode(value, { stream: true })
        const lines = buf.split('\n')
        buf = lines.pop()!

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          const raw = line.slice(6).trim()
          if (raw === '[DONE]') continue
          try {
            const chunk = JSON.parse(raw)
            if (chunk._meta) {
              receivedMeta = chunk._meta as Meta
              continue
            }
            if (chunk.t) fullText += chunk.t
          } catch {}
        }

        if (fullText.includes('[SHOW_LEAD_FORM]')) signalLead = true
        const { clean } = parseSuggestions(fullText.replace(/\[SHOW_LEAD_FORM\]/g, ''))

        const live: Message = { role: 'assistant', content: clean }
        historyRef.current = [...next, live]
        setMessages([...next, live])
      }

      // Final render with suggestions + meta
      const cleanFull = fullText.replace(/\[SHOW_LEAD_FORM\]/g, '').trim()
      const { clean: finalContent, suggestions } = parseSuggestions(cleanFull)
      const finalMsg: Message = {
        role: 'assistant',
        content: finalContent,
        suggestions,
        meta: receivedMeta ?? undefined,
      }
      historyRef.current = [...next, finalMsg]
      setMessages([...next, finalMsg])

      if (signalLead) setShowLead(true)
    } catch {
      const errMsg: Message = { role: 'assistant', content: 'Something went wrong. Email Jesse at jesse.boudreau.dev@gmail.com' }
      historyRef.current = [...next, errMsg]
      setMessages([...next, errMsg])
    }

    setStreaming(false)
  }, [streaming])

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(input) }
  }

  const submitLead = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!leadEmail.trim()) return
    try {
      await fetch('/api/assistant/lead', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: leadName, email: leadEmail, org: leadOrg, intent: leadIntent }),
      })
      setLeadDone(true)
    } catch {}
  }

  if (!mounted) return null

  const hasMessages = messages.length > 0

  return (
    <>
      {/* ── Floating trigger ── */}
      {!open && (
        <button onClick={() => setOpen(true)}
          title="Ask a question about Aegis Lite"
          className="fixed bottom-4 right-4 z-40 hidden md:flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-xs font-medium text-white transition-all hover:scale-105 cursor-pointer"
          style={{
            background: 'linear-gradient(135deg, rgba(59,130,246,0.85), rgba(99,102,241,0.85))',
            border: '1px solid rgba(99,102,241,0.3)',
            backdropFilter: 'blur(8px)',
            boxShadow: '0 4px 20px rgba(99,102,241,0.25)',
          }}>
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
          Ask a question
        </button>
      )}

      {/* ── Chat panel ── */}
      {open && (
        <div className="fixed bottom-4 right-4 z-50 hidden md:flex flex-col rounded-2xl overflow-hidden"
          style={{
            width: 'min(400px, calc(100vw - 2rem))',
            height: 'min(580px, calc(100dvh - 80px))',
            background: 'rgba(7,7,15,0.97)',
            border: '1px solid rgba(255,255,255,0.09)',
            backdropFilter: 'blur(20px)',
            boxShadow: '0 24px 80px rgba(0,0,0,0.6)',
          }}>

          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 flex-shrink-0"
            style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            <div className="flex items-center gap-2.5">
              <div className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{ background: 'linear-gradient(135deg, #3b82f6, #6366f1)', fontSize: 11, fontWeight: 700, color: '#fff' }}>
                A
              </div>
              <div>
                <p className="text-xs font-semibold text-white leading-none">Aegis Assistant</p>
                <p className="text-[10px] text-gray-600 mt-0.5">Ask anything about Aegis Lite</p>
              </div>
            </div>
            <button onClick={() => { setOpen(false); localStorage.setItem('aegis-widget-dismissed', '1') }}
              className="w-6 h-6 flex items-center justify-center rounded-md text-gray-600 hover:text-gray-300 hover:bg-white/[0.07] transition-all cursor-pointer">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3"
            style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(255,255,255,0.07) transparent' }}>

            {/* Empty state */}
            {!hasMessages && (
              <div className="text-center pt-4 pb-2">
                <div className="w-10 h-10 rounded-xl mx-auto mb-3 flex items-center justify-center"
                  style={{ background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.2)' }}>
                  <svg className="w-5 h-5 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 2L3 7v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V7l-9-5z" />
                  </svg>
                </div>
                <p className="text-xs text-gray-400 font-medium mb-1">Aegis Lite Assistant</p>
                <p className="text-[11px] text-gray-600 leading-relaxed max-w-[220px] mx-auto mb-4">
                  Ask me how this works, how to contribute, or whether it fits your team.
                </p>
                <div className="flex flex-col gap-1.5">
                  {INITIAL_CHIPS.map(c => (
                    <button key={c} onClick={() => send(c)}
                      className="text-[11px] text-left px-3 py-2 rounded-lg transition-all cursor-pointer"
                      style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', color: 'rgba(250,250,247,0.5)' }}
                      onMouseEnter={e => { (e.target as HTMLElement).style.color = 'rgba(250,250,247,0.9)'; (e.target as HTMLElement).style.borderColor = 'rgba(99,102,241,0.3)' }}
                      onMouseLeave={e => { (e.target as HTMLElement).style.color = 'rgba(250,250,247,0.5)'; (e.target as HTMLElement).style.borderColor = 'rgba(255,255,255,0.07)' }}>
                      {c}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Message list */}
            {messages.map((msg, i) => (
              <div key={i}>
                <div className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div
                    className="max-w-[88%] rounded-xl px-3.5 py-2.5 text-[12px] leading-relaxed"
                    style={msg.role === 'user' ? {
                      background: 'rgba(99,102,241,0.15)',
                      border: '1px solid rgba(99,102,241,0.2)',
                      color: 'rgba(250,250,247,0.88)',
                      borderBottomRightRadius: 4,
                    } : {
                      background: 'rgba(255,255,255,0.035)',
                      border: '1px solid rgba(255,255,255,0.07)',
                      color: 'rgba(250,250,247,0.82)',
                      borderBottomLeftRadius: 4,
                      borderLeft: '2px solid rgba(59,130,246,0.45)',
                    }}
                    dangerouslySetInnerHTML={{
                      __html: msg.role === 'assistant'
                        ? renderMd(msg.content || '…')
                        : msg.content.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'),
                    }}
                  />
                </div>

                {/* Telemetry + suggestions (assistant only, after streaming done) */}
                {msg.role === 'assistant' && (msg.meta || msg.suggestions?.length) && (
                  <div className="mt-1">
                    {msg.meta && <MetaBar meta={msg.meta} />}
                    {msg.suggestions?.length ? (
                      <SuggestionChips chips={msg.suggestions} onPick={s => send(s)} />
                    ) : null}
                  </div>
                )}
              </div>
            ))}

            {/* Governance pipeline indicator */}
            {streaming && messages.length > 0 && messages[messages.length - 1].role === 'user' && (
              <div className="flex justify-start">
                <div className="px-3.5 py-2.5 rounded-xl"
                  style={{
                    background: 'rgba(255,255,255,0.025)',
                    border: '1px solid rgba(255,255,255,0.07)',
                    borderLeft: '2px solid rgba(59,130,246,0.5)',
                    borderBottomLeftRadius: 4,
                    maxWidth: '88%',
                    minWidth: 220,
                  }}>
                  <div style={{ fontSize: 9, fontFamily: 'var(--font-geist-mono)', color: 'rgba(250,250,247,0.3)', letterSpacing: '0.06em', marginBottom: 4 }}>
                    AEGIS POLICY ENGINE · 10-RULE CHAIN
                  </div>
                  <div style={{ fontSize: 11, color: 'rgba(99,162,255,0.8)', fontWeight: 500 }}>
                    {THINK_PHRASES[thinkIdx]}
                  </div>
                  <div style={{ fontSize: 10, fontStyle: 'italic', color: 'rgba(250,250,247,0.28)', marginTop: 2 }}>
                    {GOVERNANCE_STEPS[thinkIdx]?.detail ?? 'Running policy checks…'}
                  </div>
                </div>
              </div>
            )}

            {/* Lead form */}
            {showLead && (
              <div className="rounded-xl p-3.5 mt-1"
                style={{ background: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.18)' }}>
                {leadDone ? (
                  <p className="text-[11px] text-blue-400 text-center py-1">
                    ✓ Jesse will be in touch within 24 hours.
                  </p>
                ) : (
                  <>
                    <p className="text-[11px] font-semibold text-blue-400 mb-2.5 flex items-center gap-1.5">
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zM22 6l-10 7L2 6" />
                      </svg>
                      Connect with Jesse
                    </p>
                    <form onSubmit={submitLead} className="space-y-1.5">
                      {[
                        { value: leadName,  setter: setLeadName,  placeholder: 'Your name',     type: 'text',  req: false },
                        { value: leadEmail, setter: setLeadEmail, placeholder: 'Email *',       type: 'email', req: true  },
                        { value: leadOrg,   setter: setLeadOrg,   placeholder: 'Company / Org', type: 'text',  req: false },
                      ].map(({ value, setter, placeholder, type, req }) => (
                        <input key={placeholder} type={type} required={req} value={value}
                          onChange={e => setter(e.target.value)} placeholder={placeholder}
                          className="w-full rounded-lg px-3 py-2 text-[11px] outline-none"
                          style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(250,250,247,0.9)' }}
                          onFocus={e => (e.target.style.borderColor = 'rgba(59,130,246,0.4)')}
                          onBlur={e => (e.target.style.borderColor = 'rgba(255,255,255,0.1)')}
                        />
                      ))}
                      <textarea value={leadIntent} onChange={e => setLeadIntent(e.target.value)}
                        placeholder="What are you evaluating this for?" rows={2}
                        className="w-full rounded-lg px-3 py-2 text-[11px] outline-none resize-none"
                        style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(250,250,247,0.9)' }}
                        onFocus={e => (e.target.style.borderColor = 'rgba(59,130,246,0.4)')}
                        onBlur={e => (e.target.style.borderColor = 'rgba(255,255,255,0.1)')}
                      />
                      <button type="submit"
                        className="w-full py-2 text-[11px] font-semibold text-white rounded-lg hover:opacity-90 cursor-pointer"
                        style={{ background: 'linear-gradient(135deg, #3b82f6, #6366f1)' }}>
                        Send to Jesse →
                      </button>
                    </form>
                  </>
                )}
              </div>
            )}

            <div ref={msgEndRef} />
          </div>

          {/* Persistent CTA */}
          {hasMessages && !showLead && (
            <div className="flex-shrink-0 px-3 pt-2 pb-1">
              <button onClick={() => setShowLead(true)}
                className="w-full py-2 text-[11px] font-medium rounded-lg transition-all cursor-pointer hover:opacity-90"
                style={{
                  background: 'rgba(59,130,246,0.07)',
                  border: '1px solid rgba(59,130,246,0.2)',
                  color: 'rgba(147,197,253,0.7)',
                }}>
                Talk to Jesse →
              </button>
            </div>
          )}

          {/* Input */}
          <div className="flex-shrink-0 p-3" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
            <div className="flex gap-2 items-end">
              <textarea ref={inputRef} value={input}
                onChange={e => {
                  setInput(e.target.value)
                  e.target.style.height = 'auto'
                  e.target.style.height = Math.min(e.target.scrollHeight, 100) + 'px'
                }}
                onKeyDown={handleKey}
                disabled={streaming}
                placeholder="Ask about Aegis Lite…"
                rows={1}
                className="flex-1 rounded-xl px-3 py-2 text-[12px] resize-none outline-none"
                style={{
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  color: 'rgba(250,250,247,0.9)',
                  minHeight: 36,
                  maxHeight: 100,
                }}
                onFocus={e => (e.target.style.borderColor = 'rgba(59,130,246,0.4)')}
                onBlur={e => (e.target.style.borderColor = 'rgba(255,255,255,0.1)')}
              />
              <button onClick={() => send(input)} disabled={streaming || !input.trim()}
                className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 transition-all hover:scale-105 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed disabled:scale-100"
                style={{ background: 'linear-gradient(135deg, #3b82f6, #6366f1)' }}>
                <svg className="w-3.5 h-3.5 text-white" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
                </svg>
              </button>
            </div>
            <p className="text-[9px] text-gray-700 text-center mt-1.5">
              AI may make mistakes ·{' '}
              <a href="https://jesseboudreau.com/agent" target="_blank" rel="noopener"
                className="hover:text-gray-500 transition-colors">
                jesseboudreau.com/agent
              </a>
            </p>
          </div>
        </div>
      )}

      <style>{`
        @keyframes fadePhrase {
          0% { opacity: 0; }
          10% { opacity: 1; }
          85% { opacity: 1; }
          100% { opacity: 0; }
        }
      `}</style>
    </>
  )
}
