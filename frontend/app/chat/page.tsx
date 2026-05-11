'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'
import { api } from '@/lib/api'
import { Conversation, Message, ModelInfo } from '@/lib/types'
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

export default function ChatPage() {
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()

  const [models, setModels]                 = useState<ModelInfo[]>([])
  const [selectedModel, setSelectedModel]   = useState('claude_sonnet')
  const [conversations, setConversations]   = useState<Conversation[]>([])
  const [activeConvId, setActiveConvId]     = useState<string | null>(null)
  const [messages, setMessages]             = useState<Message[]>([])
  const [input, setInput]                   = useState('')
  const [sending, setSending]               = useState(false)
  const [error, setError]                   = useState<string | null>(null)
  const [sidebarOpen, setSidebarOpen]       = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (!authLoading && !user) router.replace('/login')
    if (!authLoading && user && !user.training_completed) router.replace('/training')
  }, [user, authLoading, router])

  useEffect(() => {
    if (!user) return
    api.getModels().then(r => setModels(r.data as ModelInfo[])).catch(() => {})
    api.getConversations().then(r => setConversations(r.data as Conversation[])).catch(() => {})
  }, [user])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const selectConversation = useCallback(async (conv: Conversation) => {
    setActiveConvId(conv.id)
    setSelectedModel(conv.model)
    setError(null)
    try {
      const r = await api.getMessages(conv.id)
      setMessages((r.data as { messages: Message[] }).messages)
    } catch { setMessages([]) }
    setSidebarOpen(false)
  }, [])

  const startNew = () => {
    setActiveConvId(null)
    setMessages([])
    setError(null)
    setSidebarOpen(false)
  }

  const handleSend = async () => {
    const text = input.trim()
    if (!text || sending) return
    setInput('')
    setSending(true)
    setError(null)

    const tempId = `temp-${Date.now()}`
    setMessages(m => [...m, { id: tempId, role: 'user', content: text, created_at: new Date().toISOString() }])

    try {
      const res = await api.chat({ message: text, model: selectedModel, conversation_id: activeConvId })
      const d = res.data as {
        conversation_id: string; message_id: string; response: string; model: string
        cost_info: unknown; budget_info: unknown; policy_warning?: string
        routing_info?: { model: string; fallback_used: boolean; reason: string }
      }
      if (!activeConvId) setActiveConvId(d.conversation_id)
      setMessages(m => [
        ...m.filter(msg => msg.id !== tempId),
        { id: tempId + '-u', role: 'user', content: text, created_at: new Date().toISOString() },
        {
          id: d.message_id, role: 'assistant', content: d.response, created_at: new Date().toISOString(),
          routing_info: d.routing_info ? { model: d.routing_info.model, fallback_used: d.routing_info.fallback_used, reason: d.routing_info.reason } : undefined,
        },
      ])
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

  if (authLoading || !user) return null

  const modelInfo = models.find(m => m.id === selectedModel)

  return (
    <div className="flex h-full bg-gray-950">
      {/* Sidebar */}
      <div className={`${sidebarOpen ? 'flex' : 'hidden'} md:flex flex-col w-56 border-r border-gray-800 bg-gray-950 flex-shrink-0`}>
        <div className="flex items-center justify-between px-3 py-2.5 border-b border-gray-800">
          <span className="text-xs font-semibold text-gray-400">Conversations</span>
          <button onClick={startNew} className="text-[10px] text-blue-400 hover:text-blue-300">+ New</button>
        </div>
        <div className="flex-1 overflow-y-auto py-1">
          {conversations.length === 0 ? (
            <p className="px-3 py-4 text-xs text-gray-600">No conversations yet.</p>
          ) : (
            conversations.map(c => (
              <button
                key={c.id}
                onClick={() => selectConversation(c)}
                className={`w-full text-left px-3 py-2 text-xs transition-colors ${
                  c.id === activeConvId ? 'bg-gray-800 text-white' : 'text-gray-400 hover:bg-gray-900 hover:text-gray-200'
                }`}
              >
                <div className="truncate font-medium">{c.title}</div>
                <div className="text-gray-600 text-[10px]">{c.model}</div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Main */}
      <div className="flex flex-col flex-1 min-w-0">
        {/* Header */}
        <div className="flex-shrink-0 border-b border-gray-800 px-4 py-2.5 flex items-center gap-3">
          <button onClick={() => setSidebarOpen(!sidebarOpen)} className="md:hidden text-gray-500 hover:text-gray-300">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <div className="flex items-center gap-1.5">
            <div className="w-5 h-5 rounded bg-blue-600 flex items-center justify-center text-xs font-bold text-white">A</div>
            <span className="text-sm font-semibold text-white hidden sm:block">Aegis Lite</span>
          </div>
          <div className="w-px h-4 bg-gray-800 hidden sm:block" />
          <AppNav currentPage="/chat" />

          {/* Model selector */}
          <div className="ml-auto flex items-center gap-2">
            <select
              value={selectedModel}
              onChange={e => setSelectedModel(e.target.value)}
              className="text-xs bg-gray-900 border border-gray-700 text-gray-300 rounded-lg px-2 py-1 focus:outline-none focus:border-blue-600"
            >
              {models.map(m => (
                <option key={m.id} value={m.id}>{m.display_name}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto">
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center px-4">
              <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center mb-4">
                <span className="text-white font-bold text-lg">A</span>
              </div>
              <h2 className="text-base font-semibold text-white mb-1">Aegis Lite Chat</h2>
              <p className="text-xs text-gray-500 mb-1">
                {modelInfo ? modelInfo.display_name : selectedModel}
              </p>
              {modelInfo?.warning && (
                <p className="text-[10px] text-yellow-500 bg-yellow-900/20 px-2 py-1 rounded mt-1">{modelInfo.warning}</p>
              )}
            </div>
          ) : (
            <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
              {messages.map(m => (
                <div key={m.id} className={`flex gap-3 ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  {m.role === 'assistant' && (
                    <div className="w-6 h-6 rounded-full bg-blue-600 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <span className="text-white text-[10px] font-bold">A</span>
                    </div>
                  )}
                  <div className={`max-w-[85%] ${m.role === 'user' ? 'order-first' : ''}`}>
                    <div
                      className={`px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed prose-chat ${
                        m.role === 'user'
                          ? 'bg-blue-600 text-white rounded-br-sm'
                          : 'bg-gray-900 text-gray-200 border border-gray-800 rounded-bl-sm'
                      }`}
                      dangerouslySetInnerHTML={{ __html: m.role === 'assistant' ? formatContent(m.content) : m.content.replace(/\n/g, '<br/>') }}
                    />
                    {m.routing_info?.fallback_used && (
                      <p className="text-[10px] text-yellow-500 mt-1">Routed to {m.routing_info.model}: {m.routing_info.reason}</p>
                    )}
                  </div>
                </div>
              ))}
              {sending && (
                <div className="flex gap-3">
                  <div className="w-6 h-6 rounded-full bg-blue-600 flex items-center justify-center flex-shrink-0">
                    <span className="text-white text-[10px] font-bold">A</span>
                  </div>
                  <div className="bg-gray-900 border border-gray-800 rounded-2xl rounded-bl-sm px-3.5 py-2.5">
                    <div className="flex gap-1">
                      {[0, 1, 2].map(i => (
                        <div key={i} className="w-1.5 h-1.5 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
                      ))}
                    </div>
                  </div>
                </div>
              )}
              {error && (
                <div className="mx-auto max-w-sm text-xs text-red-400 bg-red-900/20 border border-red-700/30 rounded-lg px-3 py-2 text-center">
                  {error}
                </div>
              )}
              <div ref={bottomRef} />
            </div>
          )}
        </div>

        {/* Input */}
        <div className="flex-shrink-0 border-t border-gray-800 px-4 py-3">
          <div className="max-w-2xl mx-auto">
            <div className="flex items-end gap-2 bg-gray-900 border border-gray-700 rounded-xl px-3 py-2 focus-within:border-blue-600 transition-colors">
              <textarea
                ref={textareaRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Message Aegis…"
                rows={1}
                disabled={sending}
                className="flex-1 bg-transparent text-sm text-gray-200 placeholder-gray-600 resize-none focus:outline-none min-h-[24px] max-h-32"
                style={{ lineHeight: '1.5' }}
              />
              <button
                onClick={handleSend}
                disabled={!input.trim() || sending}
                className="flex-shrink-0 w-7 h-7 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-40 flex items-center justify-center transition-colors"
              >
                <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
              </button>
            </div>
            <p className="text-[10px] text-gray-600 text-center mt-1.5">
              All messages are governed by the Aegis policy engine and logged to the audit trail.
            </p>
          </div>
        </div>
      </div>
      <LogoutButton />
    </div>
  )
}
