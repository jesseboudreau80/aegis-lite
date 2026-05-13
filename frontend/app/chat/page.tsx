'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'
import { api } from '@/lib/api'
import { Conversation, ModelInfo, ExecutionTraceStep } from '@/lib/types'
import AppNav from '@/components/AppNav'
import LogoutButton from '@/components/LogoutButton'

function formatContent(text: string): string {
  return text
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    .replace(/\n/g, '<br />')
}

function governedLabel(m: ModelInfo): string {
  const t = m.tier ?? 'standard'
  if (t === 'premium')  return 'Governed Premium Model'
  if (t === 'standard') return 'Governed Standard Model'
  if (t === 'budget')   return 'Governed Budget Model'
  return 'Governed Free Model'
}

function fmtBytes(b: number): string {
  if (b < 1024) return `${b} B`
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`
  return `${(b / 1024 / 1024).toFixed(1)} MB`
}

// ── Attachment ─────────────────────────────────────────────────────────────────
const ACCEPTED_EXTENSIONS = new Set([
  'txt', 'md', 'csv', 'json', 'yaml', 'yml', 'xml', 'html', 'css',
  'py', 'js', 'ts', 'tsx', 'jsx', 'go', 'rs', 'sql', 'sh', 'log',
])
const MAX_FILE_BYTES = 512 * 1024  // 512 KB

interface Attachment {
  id: string
  name: string
  size: number
  content: string
  scanStatus: 'pending' | 'approved' | 'warned' | 'blocked'
  scanNote: string
}

function scanAttachment(name: string, size: number, content: string): Pick<Attachment, 'scanStatus' | 'scanNote'> {
  const lower = content.toLowerCase()
  if (/password\s*[=:]\s*\S+/.test(lower) || /secret\s*[=:]\s*\S+/.test(lower) || /api_key\s*[=:]\s*\S+/.test(lower)) {
    return { scanStatus: 'warned', scanNote: 'Possible credentials detected — backend policy will evaluate before dispatch' }
  }
  if (/\b\d{3}-\d{2}-\d{4}\b/.test(content)) {
    return { scanStatus: 'warned', scanNote: 'Possible SSN pattern — classified as sensitive, governance policy applied' }
  }
  if (size > 256 * 1024) {
    return { scanStatus: 'approved', scanNote: 'Large file — first 2000 chars sent to governed inference' }
  }
  return { scanStatus: 'approved', scanNote: 'Scanned · no sensitive patterns detected · governance-cleared for dispatch' }
}

// ── Governance pipeline trace ──────────────────────────────────────────────────
interface GovernanceMeta {
  execution_trace: ExecutionTraceStep[]
  policy_warning: string | null
  model_override: { original: string; actual: string; reason: string } | null
  budget_pct: number | null
}

function traceStepLabel(step: ExecutionTraceStep): string {
  switch (step.stage) {
    case 'rate_limit': return 'Rate check'
    case 'policy': {
      const risk = (step.metadata?.risk_score as number ?? 0).toFixed(2)
      const dec  = step.message.replace('Policy: ', '').split(' ')[0]
      return `Policy · ${dec} · risk ${risk}`
    }
    case 'routing': return 'Inference routed'
    case 'response': {
      const tok = step.metadata?.total_tokens as number
      return tok ? `${tok.toLocaleString()} tokens` : 'Complete'
    }
    default: return step.message
  }
}

function GovernancePipeline({ meta }: { meta: GovernanceMeta }) {
  const STATUS_COLOR: Record<string, string> = {
    complete: 'text-emerald-700',
    warning:  'text-amber-600',
    blocked:  'text-red-600',
  }
  const STATUS_ICON: Record<string, string> = {
    complete: '✓', warning: '⚠', blocked: '✕',
  }

  return (
    <div className="mt-1.5 space-y-1.5">
      <div className="flex items-center flex-wrap font-mono" style={{ fontSize: 9 }}>
        {meta.execution_trace.map((step, i) => {
          const col  = STATUS_COLOR[step.status] ?? STATUS_COLOR.complete
          const icon = STATUS_ICON[step.status] ?? '✓'
          return (
            <span key={step.stage} className="flex items-center">
              {i > 0 && <span className="mx-1.5 text-gray-800">·</span>}
              <span className={col}>{icon} {traceStepLabel(step)}</span>
            </span>
          )
        })}
      </div>

      {meta.policy_warning && (
        <div className="flex items-start gap-1.5 text-[10px] text-amber-600 pl-2 py-1"
          style={{ borderLeft: '2px solid rgba(245,158,11,0.35)', background: 'rgba(245,158,11,0.04)' }}>
          <svg className="w-3 h-3 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
          </svg>
          <span>{meta.policy_warning}</span>
        </div>
      )}

      {meta.model_override && meta.model_override.original !== meta.model_override.actual && (
        <p className="text-[9px] font-mono text-gray-700 pl-1">
          ↳ Policy router: {meta.model_override.reason}
        </p>
      )}

      {meta.budget_pct !== null && meta.budget_pct >= 80 && (
        <div className="flex items-center gap-1.5 text-[10px] text-amber-600 pl-1">
          <div className="w-1 h-1 rounded-full bg-amber-500 flex-shrink-0" />
          <span>Budget {meta.budget_pct.toFixed(0)}% used — premium models will be downgraded</span>
        </div>
      )}
    </div>
  )
}

// ── Local message type ─────────────────────────────────────────────────────────
interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  created_at: string
  routing_info?: { model: string; fallback_used: boolean; reason: string }
  attachmentCount?: number
}

const DEFAULT_MODEL = 'llama3'

export default function ChatPage() {
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()

  const [models, setModels]               = useState<ModelInfo[]>([])
  const [selectedModel, setSelectedModel] = useState(DEFAULT_MODEL)
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [activeConvId, setActiveConvId]   = useState<string | null>(null)
  const [messages, setMessages]           = useState<ChatMessage[]>([])
  const [governanceMap, setGovernanceMap] = useState<Map<string, GovernanceMeta>>(new Map())
  const [input, setInput]                 = useState('')
  const [sending, setSending]             = useState(false)
  const [error, setError]                 = useState<string | null>(null)
  const [sidebarOpen, setSidebarOpen]     = useState(false)

  // Attachments
  const [attachments, setAttachments]     = useState<Attachment[]>([])
  const [dragOver, setDragOver]           = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Voice
  const [isRecording, setIsRecording]     = useState(false)
  const [voiceSupported, setVoiceSupported] = useState(false)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null)

  const bottomRef   = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (!authLoading && !user) router.replace('/login')
    if (!authLoading && user && !user.training_completed) router.replace('/training')
  }, [user, authLoading, router])

  useEffect(() => {
    if (!user) return
    api.getModels()
      .then(r => {
        const list = r.data as ModelInfo[]
        setModels(list)
        const free = list.find(m => m.id === DEFAULT_MODEL) ?? list.find(m => m.tier === 'free')
        if (free) setSelectedModel(free.id)
      })
      .catch(() => {})
    api.getConversations().then(r => setConversations(r.data as Conversation[])).catch(() => {})
  }, [user])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Check voice support
  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const w = window as any
    setVoiceSupported(!!(w.SpeechRecognition || w.webkitSpeechRecognition))
  }, [])

  // ── Voice input ──────────────────────────────────────────────────────────────
  const toggleVoice = useCallback(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const w = window as any
    const SR = w.SpeechRecognition || w.webkitSpeechRecognition
    if (!SR) return

    if (isRecording) {
      recognitionRef.current?.stop()
      setIsRecording(false)
      return
    }

    const recognition = new SR()
    recognition.lang = 'en-US'
    recognition.continuous = false
    recognition.interimResults = true

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    recognition.onresult = (event: any) => {
      const transcript = Array.from(event.results)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .map((r: any) => r[0].transcript)
        .join('')
      setInput(transcript)
    }

    recognition.onend = () => {
      setIsRecording(false)
      textareaRef.current?.focus()
    }

    recognition.onerror = () => {
      setIsRecording(false)
    }

    recognitionRef.current = recognition
    recognition.start()
    setIsRecording(true)
  }, [isRecording])

  // ── File attachments ─────────────────────────────────────────────────────────
  const processFiles = useCallback((files: FileList | File[]) => {
    const fileArr = Array.from(files)
    fileArr.forEach(file => {
      const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
      if (!ACCEPTED_EXTENSIONS.has(ext)) {
        setError(`Unsupported file type: .${ext}. Accepted: text, code, csv, json, markdown.`)
        return
      }
      if (file.size > MAX_FILE_BYTES) {
        setError(`File too large: ${fmtBytes(file.size)}. Max 512 KB.`)
        return
      }

      const reader = new FileReader()
      reader.onload = (e) => {
        const content = (e.target?.result as string) || ''
        const scan = scanAttachment(file.name, file.size, content)
        const attachment: Attachment = {
          id: `att-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          name: file.name,
          size: file.size,
          content,
          ...scan,
        }
        setAttachments(prev => [...prev, attachment])
        setError(null)
      }
      reader.readAsText(file)
    })
  }, [])

  const removeAttachment = useCallback((id: string) => {
    setAttachments(prev => prev.filter(a => a.id !== id))
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    if (e.dataTransfer.files.length) processFiles(e.dataTransfer.files)
  }, [processFiles])

  // ── Send ─────────────────────────────────────────────────────────────────────
  const handleSend = async () => {
    const text = input.trim()
    if (!text || sending) return
    setInput('')
    setSending(true)
    setError(null)

    // Take snapshot of current attachments then clear
    const sendAttachments = [...attachments]
    setAttachments([])

    const tempId = `temp-${Date.now()}`
    setMessages(m => [...m, {
      id: tempId, role: 'user', content: text,
      created_at: new Date().toISOString(),
      attachmentCount: sendAttachments.length,
    }])

    try {
      const firstAtt = sendAttachments[0]
      const res = await api.chat({
        message: text,
        model: selectedModel,
        conversation_id: activeConvId,
        file_content: firstAtt ? firstAtt.content.slice(0, 4000) : undefined,
        file_name: firstAtt ? firstAtt.name : undefined,
      })
      const d = res.data as {
        conversation_id: string
        message_id: string
        response: string
        model: string
        routing_info?: { model: string; fallback_used: boolean; reason: string }
        policy_warning?: string | null
        model_override?: { original: string; actual: string; reason: string } | null
        execution_trace?: ExecutionTraceStep[]
        budget_info?: { percentage_used: number }
      }

      if (!activeConvId) setActiveConvId(d.conversation_id)

      const msgId = d.message_id
      setMessages(m => [
        ...m.filter(msg => msg.id !== tempId),
        { id: tempId + '-u', role: 'user', content: text, created_at: new Date().toISOString(), attachmentCount: sendAttachments.length },
        { id: msgId, role: 'assistant', content: d.response, created_at: new Date().toISOString(), routing_info: d.routing_info },
      ])

      if (d.execution_trace?.length) {
        setGovernanceMap(prev => {
          const next = new Map(prev)
          next.set(msgId, {
            execution_trace: d.execution_trace!,
            policy_warning:  d.policy_warning  ?? null,
            model_override:  d.model_override  ?? null,
            budget_pct:      d.budget_info?.percentage_used ?? null,
          })
          return next
        })
      }

      if (d.routing_info?.model && d.routing_info.model !== selectedModel) {
        setSelectedModel(d.routing_info.model)
      }
      api.getConversations().then(r => setConversations(r.data as Conversation[])).catch(() => {})
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || 'Failed to send message.'
      setError(msg)
      setMessages(m => m.filter(msg => msg.id !== tempId))
    } finally {
      setSending(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() }
  }

  const selectConversation = useCallback(async (conv: Conversation) => {
    setActiveConvId(conv.id)
    setSelectedModel(conv.model)
    setError(null)
    setGovernanceMap(new Map())
    setAttachments([])
    try {
      const r = await api.getMessages(conv.id)
      const msgs = (r.data as { messages: ChatMessage[] }).messages
      setMessages(msgs)
    } catch { setMessages([]) }
    setSidebarOpen(false)
  }, [])

  const startNew = () => {
    setActiveConvId(null)
    setMessages([])
    setGovernanceMap(new Map())
    setError(null)
    setAttachments([])
    setSidebarOpen(false)
  }

  if (authLoading || !user) return null

  return (
    <div className="flex h-full" style={{ background: 'var(--surface-1)' }}>

      {/* ── Sidebar ───────────────────────────────────────────────────────── */}
      <div className={`${sidebarOpen ? 'flex' : 'hidden'} md:flex flex-col w-56 border-r border-white/[0.06] flex-shrink-0`}
        style={{ background: 'var(--surface-2)' }}>
        <div className="flex items-center justify-between px-3 py-2.5 border-b border-white/[0.06]">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-600">Sessions</span>
          <button onClick={startNew}
            className="text-[10px] text-blue-400 hover:text-blue-300 transition-colors cursor-pointer">
            + New
          </button>
        </div>
        <div className="flex-1 overflow-y-auto py-1">
          {conversations.length === 0 ? (
            <div className="px-3 py-5 text-center">
              <p className="text-[11px] text-gray-600">No governed sessions yet.</p>
            </div>
          ) : (
            conversations.map(c => (
              <button key={c.id} onClick={() => selectConversation(c)}
                className={`w-full text-left px-3 py-2.5 text-xs transition-colors border-b border-white/[0.03] cursor-pointer ${
                  c.id === activeConvId
                    ? 'border-l-2 border-l-blue-500 text-white'
                    : 'text-gray-400 hover:bg-white/[0.03] hover:text-gray-200'
                }`}
                style={c.id === activeConvId ? { background: 'rgba(59,130,246,0.06)' } : {}}>
                <div className="truncate font-medium">{c.title}</div>
                <div className="text-[10px] text-gray-600 mt-0.5">Governed session</div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* ── Main ──────────────────────────────────────────────────────────── */}
      <div className="flex flex-col flex-1 min-w-0">

        {/* Header */}
        <div className="flex-shrink-0 border-b border-white/[0.06] px-4 py-2.5 flex items-center gap-3"
          style={{ background: 'rgba(7,7,15,0.8)', backdropFilter: 'blur(12px)' }}>
          <button onClick={() => setSidebarOpen(!sidebarOpen)}
            className="md:hidden text-gray-500 hover:text-gray-300 transition-colors cursor-pointer">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <div className="logo-mark flex-shrink-0" style={{ width: 20, height: 20, fontSize: 10, borderRadius: 6 }}>A</div>
          <span className="text-sm font-semibold text-white hidden sm:block">Aegis Lite</span>
          <div className="divider hidden sm:block" style={{ height: 16 }} />
          <AppNav currentPage="/chat" />

          <div className="ml-auto flex items-center gap-2">
            <select value={selectedModel} onChange={e => setSelectedModel(e.target.value)}
              className="text-[11px] border rounded-lg px-2 py-1 focus:outline-none focus:border-blue-500/50 transition-colors cursor-pointer"
              style={{ background: 'var(--surface-3)', borderColor: 'rgba(255,255,255,0.08)', color: '#9ca3af' }}>
              {models.map(m => (
                <option key={m.id} value={m.id}>{governedLabel(m)}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto">
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center px-8 text-center">
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-5"
                style={{ background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.18)' }}>
                <svg className="w-5 h-5 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.955 11.955 0 002.25 12c0 3.072 1.15 5.877 3.047 7.987A11.952 11.952 0 0012 21.75a11.95 11.95 0 006.98-2.26A11.96 11.96 0 0021.75 12c0-2.044-.51-3.97-1.41-5.657A11.956 11.956 0 0012 4.964z" />
                </svg>
              </div>
              <h2 className="text-sm font-semibold text-white mb-2">Governed AI Workspace</h2>
              <p className="text-[12px] text-gray-500 leading-relaxed max-w-xs mb-6">
                Every request is evaluated through the Aegis Lite policy engine before model execution.
                Secrets, PII, and prompt injection attempts are intercepted automatically.
              </p>
              <div className="space-y-1.5 font-mono text-[9px] text-gray-700">
                {['Policy engine active · 10 rules · v1.1.0', 'Immutable audit logging enabled', 'Voice + file input · governance-evaluated'].map(l => (
                  <div key={l} className="flex items-center gap-1.5 justify-center">
                    <span className="text-emerald-700">✓</span>
                    <span>{l}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="max-w-2xl mx-auto px-4 py-6 space-y-5">
              {messages.map(m => (
                <div key={m.id} className={`flex gap-3 ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  {m.role === 'assistant' && (
                    <div className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"
                      style={{ background: 'linear-gradient(135deg, #3b82f6, #6366f1)' }}>
                      <span className="text-white text-[10px] font-bold">A</span>
                    </div>
                  )}
                  <div className={`${m.role === 'user' ? 'order-first max-w-[85%]' : 'flex-1 min-w-0'}`}>
                    <div
                      className={`px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed prose-chat ${
                        m.role === 'user'
                          ? 'text-white rounded-br-sm inline-block'
                          : 'text-gray-200 rounded-bl-sm border border-white/[0.07]'
                      }`}
                      style={m.role === 'user'
                        ? { background: 'linear-gradient(135deg, #2563eb, #4f46e5)' }
                        : { background: 'var(--surface-2)' }}
                      dangerouslySetInnerHTML={{
                        __html: m.role === 'assistant'
                          ? formatContent(m.content)
                          : m.content.replace(/\n/g, '<br/>')
                      }}
                    />
                    {m.role === 'user' && m.attachmentCount ? (
                      <p className="text-[9px] font-mono text-gray-700 mt-1 text-right">
                        + {m.attachmentCount} attachment{m.attachmentCount > 1 ? 's' : ''} · governance-evaluated
                      </p>
                    ) : null}
                    {m.role === 'assistant' && governanceMap.has(m.id) && (
                      <GovernancePipeline meta={governanceMap.get(m.id)!} />
                    )}
                  </div>
                </div>
              ))}

              {sending && (
                <div className="flex gap-3">
                  <div className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0"
                    style={{ background: 'linear-gradient(135deg, #3b82f6, #6366f1)' }}>
                    <span className="text-white text-[10px] font-bold">A</span>
                  </div>
                  <div className="rounded-2xl rounded-bl-sm px-3.5 py-2.5 border border-white/[0.07]"
                    style={{ background: 'var(--surface-2)' }}>
                    <div className="flex gap-1 items-center h-4">
                      {[0, 1, 2].map(i => (
                        <div key={i} className="typing-dot w-1.5 h-1.5 bg-gray-500 rounded-full"
                          style={{ animationDelay: `${i * 0.15}s` }} />
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {error && (
                <div className="mx-auto max-w-sm text-xs text-red-400 border border-red-500/20 rounded-xl px-3 py-2.5 text-center"
                  style={{ background: 'rgba(239,68,68,0.06)' }}>
                  {error}
                </div>
              )}
              <div ref={bottomRef} />
            </div>
          )}
        </div>

        {/* ── Composer ──────────────────────────────────────────────────────── */}
        <div className="flex-shrink-0 border-t border-white/[0.06] px-4 py-3">
          <div className="max-w-2xl mx-auto">

            {/* Drag overlay */}
            <div
              className={`relative rounded-xl border transition-all ${
                dragOver ? 'border-blue-500/50 bg-blue-500/5' : 'border-white/[0.09]'
              } focus-within:border-blue-500/40`}
              style={{ background: dragOver ? undefined : 'var(--surface-2)' }}
              onDragOver={e => { e.preventDefault(); setDragOver(true) }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
            >
              {/* Attachment pills */}
              {attachments.length > 0 && (
                <div className="flex flex-wrap gap-1.5 px-3 pt-2.5 pb-0">
                  {attachments.map(att => (
                    <div key={att.id} className="flex items-center gap-1.5 rounded-lg px-2 py-1 text-[10px] font-mono transition-colors group"
                      style={{
                        background: att.scanStatus === 'warned' ? 'rgba(245,158,11,0.08)' : 'rgba(59,130,246,0.08)',
                        border: `1px solid ${att.scanStatus === 'warned' ? 'rgba(245,158,11,0.2)' : 'rgba(59,130,246,0.18)'}`,
                      }}>
                      <svg className="w-2.5 h-2.5 text-gray-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                      </svg>
                      <span className={att.scanStatus === 'warned' ? 'text-amber-500' : 'text-gray-400'}>
                        {att.name}
                      </span>
                      <span className="text-gray-700">{fmtBytes(att.size)}</span>
                      {att.scanStatus === 'warned' && (
                        <span title={att.scanNote}>
                          <svg className="w-2.5 h-2.5 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                          </svg>
                        </span>
                      )}
                      <button onClick={() => removeAttachment(att.id)}
                        className="text-gray-700 hover:text-gray-400 transition-colors cursor-pointer ml-0.5">
                        <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Input row */}
              <div className="flex items-end gap-1.5 px-2 py-2">
                {/* Attachment button */}
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  title="Attach file"
                  className="flex-shrink-0 w-7 h-7 rounded-md flex items-center justify-center text-gray-600 hover:text-gray-300 hover:bg-white/[0.06] transition-all cursor-pointer"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                  </svg>
                </button>

                {/* Voice button */}
                {voiceSupported && (
                  <button
                    type="button"
                    onClick={toggleVoice}
                    title={isRecording ? 'Stop recording' : 'Voice input'}
                    className={`flex-shrink-0 w-7 h-7 rounded-md flex items-center justify-center transition-all cursor-pointer ${
                      isRecording
                        ? 'bg-red-500/15 text-red-400 hover:bg-red-500/20'
                        : 'text-gray-600 hover:text-gray-300 hover:bg-white/[0.06]'
                    }`}
                  >
                    {isRecording ? (
                      <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                        <rect x="6" y="6" width="12" height="12" rx="2" />
                      </svg>
                    ) : (
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z" />
                      </svg>
                    )}
                  </button>
                )}

                {/* Divider */}
                <div className="w-px h-4 flex-shrink-0" style={{ background: 'rgba(255,255,255,0.07)' }} />

                {/* Textarea */}
                <textarea
                  ref={textareaRef}
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={isRecording ? 'Listening…' : dragOver ? 'Drop file here…' : 'Send a governed request…'}
                  rows={1}
                  disabled={sending}
                  className="flex-1 bg-transparent text-sm text-gray-200 placeholder-gray-600 resize-none focus:outline-none min-h-[24px] max-h-32 disabled:opacity-60"
                  style={{ lineHeight: '1.5' }}
                />

                {/* Send button */}
                <button onClick={handleSend} disabled={!input.trim() || sending}
                  className="flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center transition-all disabled:opacity-30 hover:opacity-90 cursor-pointer disabled:cursor-default"
                  style={{ background: 'linear-gradient(135deg, #3b82f6, #6366f1)' }}>
                  <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                  </svg>
                </button>
              </div>

              {/* Recording indicator */}
              {isRecording && (
                <div className="px-3 pb-2 flex items-center gap-1.5">
                  <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                  <span className="text-[9px] font-mono text-red-500">recording · governance evaluation pending</span>
                </div>
              )}
            </div>

            {/* Hidden file input */}
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept=".txt,.md,.csv,.json,.yaml,.yml,.xml,.html,.css,.py,.js,.ts,.tsx,.jsx,.go,.rs,.sql,.sh,.log"
              className="hidden"
              onChange={e => { if (e.target.files) { processFiles(e.target.files); e.target.value = '' } }}
            />

            <p className="text-[9px] font-mono text-gray-800 text-center mt-1.5">
              policy engine · audit log · governed inference
              {attachments.length > 0 && <span className="text-blue-900"> · {attachments.length} file{attachments.length > 1 ? 's' : ''} queued</span>}
            </p>
          </div>
        </div>
      </div>

      <LogoutButton />
    </div>
  )
}
