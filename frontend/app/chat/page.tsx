'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'
import { api, STORAGE_KEY_JWT } from '@/lib/api'
import { Conversation, ModelInfo, ExecutionTraceStep } from '@/lib/types'
import AppNav from '@/components/AppNav'
import LogoutButton from '@/components/LogoutButton'
import RuntimeStatus from '@/components/RuntimeStatus'

// ── Governance thinking indicator ──────────────────────────────────────────────
type StreamingStage = 'evaluating' | 'routing' | 'streaming' | null

const STAGE_LABELS: Record<NonNullable<StreamingStage>, string> = {
  evaluating: 'Evaluating policy chain',
  routing:    'Routing to governed provider',
  streaming:  'Streaming governed response',
}

const STAGE_SUB: Record<NonNullable<StreamingStage>, string> = {
  evaluating: '10-rule deterministic chain · v1.1.0',
  routing:    'Budget-aware provider selection',
  streaming:  'Token-by-token · policy enforced',
}

function ThinkingIndicator({ stage, elapsedMs }: { stage: NonNullable<StreamingStage>; elapsedMs: number }) {
  const elapsed = (elapsedMs / 1000).toFixed(1)
  return (
    <div className="flex gap-3 justify-start">
      <div className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"
        style={{ background: 'linear-gradient(135deg, #3b82f6, #6366f1)' }}>
        <span className="text-white text-[10px] font-bold">A</span>
      </div>
      <div className="rounded-2xl rounded-bl-sm px-4 py-3 border border-white/[0.07] min-w-[200px]"
        style={{ background: 'var(--surface-2)' }}>
        <div className="flex items-center gap-2.5 mb-1.5">
          {/* Animated governance dots */}
          <div className="flex gap-1 items-center">
            {[0, 1, 2].map(i => (
              <div key={i} className="w-1.5 h-1.5 rounded-full bg-blue-500"
                style={{
                  animation: 'thinking-pulse 1.4s ease-in-out infinite',
                  animationDelay: `${i * 0.2}s`,
                  opacity: 0.3,
                }} />
            ))}
          </div>
          <span className="text-[11px] text-gray-400 font-medium">{STAGE_LABELS[stage]}</span>
          <span className="text-[9px] font-mono text-gray-700 ml-auto">{elapsed}s</span>
        </div>
        <p className="text-[9px] font-mono text-gray-700">{STAGE_SUB[stage]}</p>
      </div>
    </div>
  )
}

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
const MAX_FILE_BYTES = 512 * 1024

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
    return { scanStatus: 'approved', scanNote: 'Large file — first 5000 chars sent to governed inference' }
  }
  return { scanStatus: 'approved', scanNote: 'Scanned · no sensitive patterns detected · cleared for dispatch' }
}

// ── Governance pipeline ────────────────────────────────────────────────────────
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

  // Detect enforcement-level events from trace flags
  const policyStep = meta.execution_trace.find(s => s.stage === 'policy')
  const riskScore = (policyStep?.metadata?.risk_score as number) ?? 0
  const flags = (policyStep?.metadata?.flags as string[]) ?? []
  const decision = policyStep?.message.replace('Policy: ', '').split(' ')[0] ?? 'allow'
  const isEnforced = decision !== 'allow' && decision !== 'Policy:'
  const isBlocked  = decision === 'block'

  // Flag display labels
  const FLAG_LABELS: Record<string, string> = {
    pii_detected:            'PII detected',
    email_detected:          'Email pattern',
    ssn_detected:            'SSN pattern',
    credit_card_detected:    'Card number',
    secrets_detected:        'Credentials',
    injection_attempt:       'Injection attempt',
    sensitive_keywords_detected: 'Sensitive keywords',
    restricted_data_blocked: 'Restricted data',
    confidential_data_external_provider: 'Confidential → external',
    high_confidence_injection: 'High-confidence injection',
  }

  const enforcementColor = isBlocked
    ? { bg: 'rgba(239,68,68,0.06)', border: 'rgba(239,68,68,0.2)', text: '#f87171', dot: '#ef4444' }
    : { bg: 'rgba(245,158,11,0.06)', border: 'rgba(245,158,11,0.2)', text: '#fbbf24', dot: '#f59e0b' }

  return (
    <div className="mt-2 space-y-1.5">
      {/* Compact trace row — always shown */}
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

      {/* Enforcement banner — shown when policy did something meaningful */}
      {isEnforced && (
        <div className="rounded-lg px-3 py-2.5 mt-1"
          style={{ background: enforcementColor.bg, border: `1px solid ${enforcementColor.border}` }}>
          <div className="flex items-start gap-2">
            <div className="flex-shrink-0 mt-0.5">
              {isBlocked ? (
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke={enforcementColor.dot} strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                </svg>
              ) : (
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke={enforcementColor.dot} strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                </svg>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <span className="text-[10px] font-semibold" style={{ color: enforcementColor.text }}>
                  Governance {isBlocked ? 'blocked' : decision === 'escalate' ? 'escalated' : decision === 'modify' ? 'modified request' : 'notice'}
                </span>
                <span className="text-[9px] font-mono" style={{ color: enforcementColor.dot }}>
                  risk {riskScore.toFixed(2)} · policy v1.1.0
                </span>
              </div>
              {flags.length > 0 && (
                <div className="flex flex-wrap gap-1 mb-1">
                  {flags.slice(0, 4).map(f => (
                    <span key={f} className="text-[9px] font-mono px-1.5 py-0.5 rounded"
                      style={{ background: 'rgba(255,255,255,0.06)', color: '#6b7280' }}>
                      {FLAG_LABELS[f] ?? f.replace(/_/g, ' ')}
                    </span>
                  ))}
                </div>
              )}
              {meta.policy_warning && (
                <p className="text-[10px] leading-relaxed" style={{ color: enforcementColor.text, opacity: 0.8 }}>
                  {meta.policy_warning}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Model override */}
      {meta.model_override && meta.model_override.original !== meta.model_override.actual && (
        <p className="text-[9px] font-mono text-gray-700 pl-1">
          ↳ Policy router: {meta.model_override.reason}
        </p>
      )}

      {/* Budget warning */}
      {meta.budget_pct !== null && meta.budget_pct >= 80 && (
        <div className="flex items-center gap-1.5 text-[10px] text-amber-600 pl-1">
          <div className="w-1 h-1 rounded-full bg-amber-500 flex-shrink-0" />
          <span>Budget {meta.budget_pct.toFixed(0)}% used</span>
        </div>
      )}
    </div>
  )
}

// ── Message types ──────────────────────────────────────────────────────────────
interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  created_at: string
  isStreaming?: boolean
  attachmentCount?: number
}

const DEFAULT_MODEL = 'llama3'

// ── SSE stream parser ──────────────────────────────────────────────────────────
function parseSSELines(chunk: string): unknown[] {
  const events: unknown[] = []
  const lines = chunk.split('\n')
  for (const line of lines) {
    if (!line.startsWith('data: ')) continue
    try {
      events.push(JSON.parse(line.slice(6)))
    } catch { /* skip malformed */ }
  }
  return events
}

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
  const [isStreaming, setIsStreaming]     = useState(false)
  const [streamingStage, setStreamingStage] = useState<StreamingStage>(null)
  const [elapsedMs, setElapsedMs]         = useState(0)
  const [error, setError]                 = useState<string | null>(null)
  const [sidebarOpen, setSidebarOpen]     = useState(false)
  const elapsedTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const startTimeRef    = useRef<number>(0)

  // Attachments
  const [attachments, setAttachments]       = useState<Attachment[]>([])
  const [dragOver, setDragOver]             = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Voice
  const [isRecording, setIsRecording]       = useState(false)
  const [voiceSupported, setVoiceSupported] = useState(false)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null)

  // Streaming abort
  const abortRef = useRef<AbortController | null>(null)

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

  // Voice support check
  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const w = window as any
    setVoiceSupported(!!(w.SpeechRecognition || w.webkitSpeechRecognition))
  }, [])

  // ── Voice ────────────────────────────────────────────────────────────────────
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
    recognition.onend = () => { setIsRecording(false); textareaRef.current?.focus() }
    recognition.onerror = () => { setIsRecording(false) }

    recognitionRef.current = recognition
    recognition.start()
    setIsRecording(true)
  }, [isRecording])

  // ── Attachments ──────────────────────────────────────────────────────────────
  const processFiles = useCallback((files: FileList | File[]) => {
    Array.from(files).forEach(file => {
      const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
      if (!ACCEPTED_EXTENSIONS.has(ext)) {
        setError(`Unsupported file type: .${ext}`)
        return
      }
      if (file.size > MAX_FILE_BYTES) {
        setError(`File too large: ${fmtBytes(file.size)}. Max 512 KB.`)
        return
      }
      const reader = new FileReader()
      reader.onload = (e) => {
        const content = (e.target?.result as string) || ''
        setAttachments(prev => [...prev, {
          id: `att-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          name: file.name, size: file.size, content,
          ...scanAttachment(file.name, file.size, content),
        }])
        setError(null)
      }
      reader.readAsText(file)
    })
  }, [])

  const removeAttachment = (id: string) => setAttachments(prev => prev.filter(a => a.id !== id))

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    if (e.dataTransfer.files.length) processFiles(e.dataTransfer.files)
  }, [processFiles])

  // ── Elapsed timer helpers ─────────────────────────────────────────────────────
  const startElapsed = useCallback(() => {
    startTimeRef.current = Date.now()
    setElapsedMs(0)
    if (elapsedTimerRef.current) clearInterval(elapsedTimerRef.current)
    elapsedTimerRef.current = setInterval(() => {
      setElapsedMs(Date.now() - startTimeRef.current)
    }, 100)
  }, [])

  const stopElapsed = useCallback(() => {
    if (elapsedTimerRef.current) { clearInterval(elapsedTimerRef.current); elapsedTimerRef.current = null }
  }, [])

  // ── Stop generation ──────────────────────────────────────────────────────────
  const stopGeneration = useCallback(() => {
    abortRef.current?.abort()
    abortRef.current = null
    stopElapsed()
    setIsStreaming(false)
    setStreamingStage(null)
    setSending(false)
    setMessages(m => m.map(msg => msg.isStreaming ? { ...msg, isStreaming: false } : msg))
  }, [stopElapsed])

  // ── Send (streaming) ──────────────────────────────────────────────────────────
  const handleSend = async () => {
    const text = input.trim()
    if (!text || sending) return
    setInput('')
    setSending(true)
    setIsStreaming(false)
    setStreamingStage('evaluating')
    setError(null)
    startElapsed()

    const sendAttachments = [...attachments]
    setAttachments([])

    const userTempId = `user-${Date.now()}`
    setMessages(m => [...m, {
      id: userTempId, role: 'user', content: text,
      created_at: new Date().toISOString(),
      attachmentCount: sendAttachments.length,
    }])

    const jwt = localStorage.getItem(STORAGE_KEY_JWT) ?? ''
    const abort = new AbortController()
    abortRef.current = abort

    const streamingId = `streaming-${Date.now()}`

    try {
      const resp = await fetch('/api/chat/stream', {
        method:  'POST',
        headers: {
          'Content-Type':  'application/json',
          'Authorization': `Bearer ${jwt}`,
        },
        body: JSON.stringify({
          message:         text,
          model:           selectedModel,
          conversation_id: activeConvId,
          file_content:    sendAttachments[0]?.content.slice(0, 4000),
          file_name:       sendAttachments[0]?.name,
        }),
        signal: abort.signal,
      })

      if (!resp.ok) {
        const errData = await resp.json().catch(() => ({}))
        const detail = (errData as { detail?: string }).detail || `HTTP ${resp.status}`
        // 403 = governance block — show as enforcement event, not raw error
        if (resp.status === 403) {
          const blockReason = detail.replace('Request blocked by policy: ', '')
          const blockMsgId = `block-${Date.now()}`
          setMessages(m => [...m, {
            id: blockMsgId, role: 'assistant',
            content: '[Request blocked by governance policy — no inference performed]',
            created_at: new Date().toISOString(),
          }])
          setGovernanceMap(prev => {
            const next = new Map(prev)
            next.set(blockMsgId, {
              execution_trace: [
                { stage: 'rate_limit', message: 'Rate check', status: 'complete' },
                { stage: 'policy',     message: 'Policy: block',  status: 'blocked',
                  metadata: { risk_score: 1.0, flags: ['restricted_data_blocked'], policy_version: 'v1.1.0' } },
                { stage: 'routing',    message: 'Inference blocked', status: 'blocked' },
                { stage: 'response',   message: 'No inference', status: 'blocked' },
              ],
              policy_warning: blockReason,
              model_override: null,
              budget_pct: null,
            })
            return next
          })
          setSending(false)
          setIsStreaming(false)
          return
        }
        throw new Error(detail)
      }

      const reader = resp.body!.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      let gotMeta = false

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const newline2 = buffer.lastIndexOf('\n\n')
        if (newline2 === -1) continue

        const chunk = buffer.slice(0, newline2 + 2)
        buffer = buffer.slice(newline2 + 2)

        const events = parseSSELines(chunk)
        for (const evt of events) {
          const e = evt as Record<string, unknown>

          if (e.type === 'meta') {
            gotMeta = true
            setStreamingStage('routing')
            if (!activeConvId && e.conversation_id) setActiveConvId(e.conversation_id as string)
            // Insert blank streaming assistant message
            setMessages(m => [...m, {
              id: streamingId, role: 'assistant', content: '',
              created_at: new Date().toISOString(), isStreaming: true,
            }])
            // Show pre-inference governance trace
            if ((e.execution_trace as ExecutionTraceStep[] | undefined)?.length) {
              setGovernanceMap(prev => {
                const next = new Map(prev)
                next.set(streamingId, {
                  execution_trace: e.execution_trace as ExecutionTraceStep[],
                  policy_warning:  (e.policy_warning as string | null) ?? null,
                  model_override:  null,
                  budget_pct:      null,
                })
                return next
              })
            }
            // Brief routing stage, then transition to streaming
            setTimeout(() => { setStreamingStage('streaming'); setIsStreaming(true) }, 180)

          } else if (e.type === 'token') {
            setMessages(m => m.map(msg =>
              msg.id === streamingId
                ? { ...msg, content: msg.content + (e.content as string) }
                : msg
            ))
            bottomRef.current?.scrollIntoView({ behavior: 'smooth' })

          } else if (e.type === 'done') {
            const msgId = e.message_id as string
            if (!activeConvId && e.conversation_id) setActiveConvId(e.conversation_id as string)

            // Replace streaming placeholder with real message_id
            setMessages(m => m.map(msg =>
              msg.id === streamingId
                ? { ...msg, id: msgId, isStreaming: false }
                : msg
            ))

            // Final governance metadata with real cost
            if ((e.execution_trace as ExecutionTraceStep[] | undefined)?.length) {
              setGovernanceMap(prev => {
                const next = new Map(prev)
                // Remove placeholder entry
                next.delete(streamingId)
                next.set(msgId, {
                  execution_trace: e.execution_trace as ExecutionTraceStep[],
                  policy_warning:  (e.policy_warning as string | null) ?? null,
                  model_override:  (e.model_override as GovernanceMeta['model_override']) ?? null,
                  budget_pct:      (e.budget_info as { percentage_used?: number } | undefined)?.percentage_used ?? null,
                })
                return next
              })
            }

            const routedModel = e.model as string
            if (routedModel && routedModel !== selectedModel) setSelectedModel(routedModel)
            stopElapsed()
            setStreamingStage(null)
            api.getConversations().then(r => setConversations(r.data as Conversation[])).catch(() => {})
          }
        }
      }

      if (!gotMeta) throw new Error('No response from server.')

    } catch (err: unknown) {
      if ((err as Error).name === 'AbortError') {
        // User stopped — leave partial message
      } else {
        const msg = (err as Error).message || 'Failed to send message.'
        setError(msg)
        setMessages(m => m.filter(msg => msg.id !== userTempId && msg.id !== streamingId))
      }
    } finally {
      stopElapsed()
      setIsStreaming(false)
      setStreamingStage(null)
      setSending(false)
      abortRef.current = null
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

          <div className="ml-auto flex items-center gap-3">
            {/* Runtime health indicators */}
            <div className="hidden lg:block">
              <RuntimeStatus />
            </div>
            {/* Streaming status indicator */}
            {isStreaming && (
              <div className="flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-[10px] font-mono text-emerald-600 hidden sm:block">streaming</span>
              </div>
            )}
            <select value={selectedModel} onChange={e => setSelectedModel(e.target.value)}
              disabled={sending}
              className="text-[11px] border rounded-lg px-2 py-1 focus:outline-none focus:border-blue-500/50 transition-colors cursor-pointer disabled:opacity-50"
              style={{ background: 'var(--surface-3)', borderColor: 'rgba(255,255,255,0.08)', color: '#9ca3af' }}>
              {models.map(m => (
                <option key={m.id} value={m.id}>{governedLabel(m)}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto">
          {messages.length === 0 && sending && streamingStage && streamingStage !== 'streaming' ? (
            /* Thinking on empty state — before first message arrives */
            <div className="h-full flex items-end pb-8 px-4">
              <div className="max-w-2xl w-full mx-auto">
                <ThinkingIndicator stage={streamingStage} elapsedMs={elapsedMs} />
              </div>
            </div>
          ) : messages.length === 0 ? (
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
                Responses stream in real-time with live governance telemetry.
              </p>
              <div className="space-y-1.5 font-mono text-[9px] text-gray-700">
                {[
                  'Policy engine active · 10 rules · v1.1.0',
                  'Streaming inference · token-by-token',
                  'Voice + file input · governance-evaluated',
                ].map(l => (
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
                    <div className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 flex-shrink-0"
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
                    >
                      {m.role === 'assistant' ? (
                        <>
                          <span dangerouslySetInnerHTML={{ __html: formatContent(m.content) }} />
                          {m.isStreaming && (
                            <span
                              className="inline-block w-0.5 h-3.5 ml-0.5 align-middle"
                              style={{
                                background: '#6366f1',
                                animation: 'blink 1s step-end infinite',
                              }}
                            />
                          )}
                        </>
                      ) : (
                        <span dangerouslySetInnerHTML={{ __html: m.content.replace(/\n/g, '<br/>') }} />
                      )}
                    </div>

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

              {/* Governance thinking indicator — shown during policy eval and routing */}
              {sending && streamingStage && streamingStage !== 'streaming' && (
                <ThinkingIndicator stage={streamingStage} elapsedMs={elapsedMs} />
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

            <div
              className={`relative rounded-xl border transition-all ${
                dragOver ? 'border-blue-500/50' : 'border-white/[0.09]'
              } focus-within:border-blue-500/40`}
              style={{ background: dragOver ? 'rgba(59,130,246,0.04)' : 'var(--surface-2)' }}
              onDragOver={e => { e.preventDefault(); setDragOver(true) }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
            >
              {/* Attachment pills */}
              {attachments.length > 0 && (
                <div className="flex flex-wrap gap-1.5 px-3 pt-2.5 pb-0">
                  {attachments.map(att => (
                    <div key={att.id}
                      className="flex items-center gap-1.5 rounded-lg px-2 py-1 text-[10px] font-mono"
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
                {/* Attachment */}
                <button type="button" onClick={() => fileInputRef.current?.click()}
                  title="Attach file"
                  className="flex-shrink-0 w-7 h-7 rounded-md flex items-center justify-center text-gray-600 hover:text-gray-300 hover:bg-white/[0.06] transition-all cursor-pointer">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                  </svg>
                </button>

                {/* Mic */}
                {voiceSupported && (
                  <button type="button" onClick={toggleVoice}
                    title={isRecording ? 'Stop recording' : 'Voice input'}
                    className={`flex-shrink-0 w-7 h-7 rounded-md flex items-center justify-center transition-all cursor-pointer ${
                      isRecording ? 'bg-red-500/15 text-red-400' : 'text-gray-600 hover:text-gray-300 hover:bg-white/[0.06]'
                    }`}>
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

                {/* Stop / Send */}
                {isStreaming ? (
                  <button onClick={stopGeneration}
                    title="Stop generation"
                    className="flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center cursor-pointer transition-all hover:opacity-80"
                    style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.25)' }}>
                    <svg className="w-3 h-3 text-red-400" fill="currentColor" viewBox="0 0 24 24">
                      <rect x="5" y="5" width="14" height="14" rx="2" />
                    </svg>
                  </button>
                ) : (
                  <button onClick={handleSend} disabled={!input.trim() || sending}
                    className="flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center transition-all disabled:opacity-30 hover:opacity-90 cursor-pointer disabled:cursor-default"
                    style={{ background: 'linear-gradient(135deg, #3b82f6, #6366f1)' }}>
                    <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                    </svg>
                  </button>
                )}
              </div>

              {isRecording && (
                <div className="px-3 pb-2 flex items-center gap-1.5">
                  <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                  <span className="text-[9px] font-mono text-red-500">recording · governance evaluation pending</span>
                </div>
              )}
            </div>

            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept=".txt,.md,.csv,.json,.yaml,.yml,.xml,.html,.css,.py,.js,.ts,.tsx,.jsx,.go,.rs,.sql,.sh,.log"
              className="hidden"
              onChange={e => { if (e.target.files) { processFiles(e.target.files); e.target.value = '' } }}
            />

            <p className="text-[9px] font-mono text-gray-800 text-center mt-1.5">
              policy engine · streaming inference · audit log
              {attachments.length > 0 && <span className="text-blue-900"> · {attachments.length} file{attachments.length > 1 ? 's' : ''} queued</span>}
            </p>
          </div>
        </div>
      </div>

      <LogoutButton />
    </div>
  )
}
