'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'
import AppNav from '@/components/AppNav'
import LogoutButton from '@/components/LogoutButton'
import { api } from '@/lib/api'
import { Agent } from '@/lib/types'

// ── Lightweight markdown renderer ─────────────────────────────────────────
function agentInline(raw: string): string {
  return raw
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/\*\*([^*\n]+)\*\*/g,'<strong>$1</strong>')
    .replace(/\*([^*\n]+)\*/g,'<em>$1</em>')
    .replace(/`([^`\n]+)`/g,'<code style="background:rgba(255,255,255,0.1);border-radius:3px;padding:0.1em 0.3em;font-size:0.85em;font-family:monospace">$1</code>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g,'<a href="$2" target="_blank" rel="noopener" style="color:#60a5fa;text-decoration:underline">$1</a>')
}

function renderAgentResponse(text: string): string {
  const lines = text.split('\n'); let html = ''; let i = 0
  while (i < lines.length) {
    const line = lines[i]
    if (line.startsWith('```')) {
      let code = ''; i++
      while (i < lines.length && !lines[i].startsWith('```')) { code += lines[i] + '\n'; i++ }; i++
      html += `<pre style="background:rgba(0,0,0,0.35);border:1px solid rgba(255,255,255,0.08);border-radius:8px;padding:0.75rem;overflow-x:auto;font-size:0.8em;font-family:monospace;line-height:1.5;margin:0.4rem 0">${code.trim().replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}</pre>`; continue
    }
    if (line.startsWith('|')) {
      const tbl: string[] = []
      while (i < lines.length && lines[i].startsWith('|')) { tbl.push(lines[i]); i++ }
      const isAlign = (l: string) => /^[\s|:-]+$/.test(l)
      const rows = tbl.filter(l => !isAlign(l)).map(l => l.split('|').slice(1,-1).map(c => c.trim()))
      if (rows.length) {
        const [head, ...body] = rows
        const ths = head.map(c => `<th style="text-align:left;padding:5px 9px;border-bottom:1px solid rgba(255,255,255,0.1);font-size:0.77em;font-weight:600;color:rgba(250,250,247,0.6)">${agentInline(c)}</th>`).join('')
        const trs = body.map(r => `<tr>${r.map(c => `<td style="padding:4px 9px;border-bottom:1px solid rgba(255,255,255,0.04);font-size:0.83em">${agentInline(c)}</td>`).join('')}</tr>`).join('')
        html += `<div style="overflow-x:auto;margin:0.5rem 0"><table style="width:100%;border-collapse:collapse;background:rgba(255,255,255,0.02);border-radius:6px"><thead><tr>${ths}</tr></thead><tbody>${trs}</tbody></table></div>`
      }
      continue
    }
    const h3=line.match(/^###\s+(.+)/); if(h3){html+=`<h3 style="font-size:0.92em;font-weight:700;margin:0.8rem 0 0.25rem;color:rgba(250,250,247,0.95)">${agentInline(h3[1])}</h3>`;i++;continue}
    const h2=line.match(/^##\s+(.+)/);  if(h2){html+=`<h2 style="font-size:1em;font-weight:700;margin:0.85rem 0 0.3rem;color:rgba(250,250,247,0.95)">${agentInline(h2[1])}</h2>`;i++;continue}
    if (/^[-*•]\s/.test(line)) {
      const items: string[] = []
      while (i < lines.length && /^[-*•]\s/.test(lines[i])) { items.push(lines[i].replace(/^[-*•]\s+/,'')); i++ }
      html += `<ul style="margin:0.3rem 0 0.4rem 1.1rem;padding:0">${items.map(it=>`<li style="margin-bottom:0.2rem">${agentInline(it)}</li>`).join('')}</ul>`; continue
    }
    if (/^\d+[.)]\s/.test(line)) {
      const items: string[] = []
      while (i < lines.length && /^\d+[.)]\s/.test(lines[i])) { items.push(lines[i].replace(/^\d+[.)]\s+/,'')); i++ }
      html += `<ol style="margin:0.3rem 0 0.4rem 1.1rem;padding:0">${items.map(it=>`<li style="margin-bottom:0.2rem">${agentInline(it)}</li>`).join('')}</ol>`; continue
    }
    if (line.trim()===''){html+='<div style="height:0.3rem"></div>';i++;continue}
    html += `<p style="margin:0 0 0.25rem">${agentInline(line)}</p>`; i++
  }
  return html
}

const RATE_LIMIT_MARKERS = ['rate limit', 'rate_limit', 'too many requests', 'try again later', 'quota exceeded']
function isRateLimitError(text: string): boolean {
  return RATE_LIMIT_MARKERS.some(m => text.toLowerCase().includes(m))
}

// ── Agent Pantheon ────────────────────────────────────────────────────────
// cx/cy = center position as % of the 3:2 arena container
// src = '' until the new medallion icon is ready
const V = '?v=3'  // bump to bust cache after icon updates
const PANTHEON: Record<string, {
  src: string; cx: string; cy: string; size: string;
  color: string; glow: string; cardBg: string; title: string; floatDelay: string;
}> = {
  'support-assistant': {
    src: `/agents/athena.webp${V}`, cx: '37%', cy: '72%', size: '7%',
    color: '#f59e0b', glow: 'rgba(245,158,11,0.55)', cardBg: 'rgba(245,158,11,0.07)',
    title: 'Wisdom · Support', floatDelay: '0s',
  },
  'flow': {
    src: `/agents/apollo.webp${V}`, cx: '63%', cy: '72%', size: '7%',
    color: '#eab308', glow: 'rgba(234,179,8,0.55)', cardBg: 'rgba(234,179,8,0.07)',
    title: 'Order · Workflow', floatDelay: '1.2s',
  },
  'decksmith': {
    src: `/agents/hermes.webp${V}`, cx: '8%', cy: '55%', size: '7%',
    color: '#06b6d4', glow: 'rgba(6,182,212,0.55)', cardBg: 'rgba(6,182,212,0.07)',
    title: 'Messenger · Comms', floatDelay: '0.6s',
  },
  'sop-builder': {
    src: `/agents/hephaestus.webp${V}`, cx: '28%', cy: '38%', size: '7%',
    color: '#f97316', glow: 'rgba(249,115,22,0.55)', cardBg: 'rgba(249,115,22,0.07)',
    title: 'The Forge', floatDelay: '1.8s',
  },
  'research-analyst': {
    src: `/agents/urania.webp${V}`, cx: '72%', cy: '38%', size: '7%',
    color: '#a78bfa', glow: 'rgba(167,139,250,0.55)', cardBg: 'rgba(167,139,250,0.07)',
    title: 'Stars · Intel', floatDelay: '2.4s',
  },
  'argos': {
    src: `/agents/argos.webp${V}`, cx: '92%', cy: '55%', size: '7%',
    color: '#22c55e', glow: 'rgba(34,197,94,0.55)', cardBg: 'rgba(34,197,94,0.07)',
    title: 'All-Seeing · Audit', floatDelay: '3.0s',
  },
}

// ── Coming Soon — next gods to be deployed ────────────────────────────────
const COMING_SOON = [
  {
    name: 'Ares',
    color: '#ef4444', glow: 'rgba(239,68,68,0.5)',
    title: 'Security · Incident Response',
    desc: 'Detects threats, escalates breaches, and coordinates incident response across your security stack.',
  },
  {
    name: 'Zeus',
    color: '#6366f1', glow: 'rgba(99,102,241,0.5)',
    title: 'Executive · Board Briefings',
    desc: 'Synthesizes complex operations data into concise C-suite summaries and board-ready narratives.',
  },
  {
    name: 'Iris',
    color: '#14b8a6', glow: 'rgba(20,184,166,0.5)',
    title: 'Communications · Email',
    desc: 'Drafts internal memos, announcements, and stakeholder emails in your organization\'s voice.',
  },
  {
    name: 'Dike',
    color: '#e2e8f0', glow: 'rgba(226,232,240,0.4)',
    title: 'Legal · Compliance Review',
    desc: 'Scans documents for regulatory exposure, policy gaps, and legal risk before anything ships.',
  },
  {
    name: 'Mnemosyne',
    color: '#818cf8', glow: 'rgba(129,140,248,0.5)',
    title: 'Memory · Knowledge Retrieval',
    desc: 'Searches, connects, and synthesizes across your entire document library using governed RAG.',
  },
  {
    name: 'Helios',
    color: '#fb923c', glow: 'rgba(251,146,60,0.5)',
    title: 'Analytics · Business Intelligence',
    desc: 'Turns raw metrics and reports into clear business narratives with actionable recommendations.',
  },
]

// ── Standby — icons being created ────────────────────────────────────────
const STANDBY = [
  { slug: 'nemesis', name: 'Nemesis', color: '#f43f5e', glow: 'rgba(244,63,94,0.5)', title: 'Retribution · Security' },
]

// ── Demo prompts — pre-built per agent for instant prospect experience ────
const DEMO_PROMPTS: Record<string, { label: string; prompt: string }[]> = {
  'support-assistant': [
    { label: 'New hire onboarding', prompt: 'I just joined the company and need to know how to get access to the HR portal, set up direct deposit, and schedule my benefits enrollment meeting. Where do I start?' },
    { label: 'IT access issue', prompt: 'My laptop VPN keeps disconnecting every 20 minutes and IT hasn\'t responded in 2 days. This is blocking me from the production database. Can you help escalate this?' },
    { label: 'Expense policy', prompt: 'I attended a client dinner last week that cost $340. What\'s the expense policy and how do I submit this for reimbursement?' },
  ],
  'sop-builder': [
    { label: 'Employee offboarding SOP', prompt: 'Build a Standard Operating Procedure for employee offboarding. We need to cover IT access revocation, equipment return, final paycheck, and knowledge transfer.' },
    { label: 'Incident response SOP', prompt: 'Create an SOP for how our team handles a customer data breach. Include detection, containment, notification steps, and post-incident review.' },
    { label: 'Vendor onboarding SOP', prompt: 'Build an SOP for onboarding a new software vendor — covering security review, contract sign-off, IT provisioning, and employee communication.' },
  ],
  'decksmith': [
    { label: 'Q1 board update', prompt: 'Create a slide deck outline for our Q1 board meeting. Audience is the board of directors. Tone is professional. 8 slides covering revenue, product progress, headcount, and strategic risks.' },
    { label: 'AI governance pitch', prompt: 'Build a 6-slide executive pitch for why we need an AI governance layer before we expand AI usage across the company. Audience: CFO and CTO.' },
    { label: 'Product launch deck', prompt: 'Outline a 10-slide deck to announce our new enterprise product to existing customers. Include problem, solution, differentiation, pricing, and next steps.' },
  ],
  'flow': [
    { label: 'Hiring approval workflow', prompt: 'Design a workflow for getting a new hire approved. Starts when a hiring manager submits a request, ends when the offer letter is sent. Include finance, HR, and executive approvals.' },
    { label: 'Content approval chain', prompt: 'Create a workflow for approving marketing content before it goes live. Covers blog posts, social media, and press releases. Include legal review for anything with product claims.' },
    { label: 'System status brief', prompt: 'I\'m using Aegis Lite to govern AI in my organization. Give me a structured overview of what an AI governance workflow looks like — from user request to model response to audit log.' },
  ],
  'research-analyst': [
    { label: 'AI governance landscape', prompt: 'Quick Brief: What are the top 5 emerging AI governance regulations organizations need to prepare for in 2025-2026?' },
    { label: 'Competitor analysis', prompt: 'Deep Analysis: Compare the top 4 enterprise AI governance platforms — their strengths, weaknesses, pricing models, and which company profiles they\'re best suited for.' },
    { label: 'Market entry research', prompt: 'Quick Brief: What are the biggest obstacles companies face when adopting AI in regulated industries like finance, healthcare, and legal?' },
  ],
  'argos': [
    { label: 'Activity summary', prompt: 'Summarize all agent activity in this system over the last 24 hours. Highlight any policy violations, blocked requests, or unusual patterns.' },
    { label: 'Risk signals', prompt: 'What are the top risk signals I should be watching in an AI governance system? Show me what anomalies would look like and how to interpret them.' },
    { label: 'Governance explainer', prompt: 'A request was blocked by the policy engine. Walk me through how to investigate why it was blocked, what the audit log would show, and how to review the policy that triggered.' },
  ],
}

function agentTierLabel(model: string): string {
  if (model.includes('opus'))    return 'Premium · restricted to admin'
  if (model.includes('sonnet'))  return 'Standard · governed'
  if (model.includes('gpt-4o-mini') || model.includes('gpt4o_mini')) return 'Budget · governed'
  if (model.includes('mistral') || model.includes('llama') || model.includes('gemini')) return 'Free tier · governed'
  return 'Governed inference'
}

// ── Agent icon — circular medallion display ───────────────────────────────
function AgentIcon({ src, name, color, size, glow, animated }: {
  src: string; name: string; color: string; size: number; glow: string; animated?: boolean
}) {
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%', overflow: 'hidden',
      border: `1.5px solid ${color}45`,
      background: src ? 'transparent' : `radial-gradient(circle at 38% 38%, ${color}28, rgba(0,0,0,0.85))`,
      boxShadow: animated ? `0 0 16px 3px ${glow}, inset 0 0 12px rgba(0,0,0,0.5)` : `0 0 8px 1px ${glow}, inset 0 0 8px rgba(0,0,0,0.5)`,
      flexShrink: 0,
    }}>
      {src ? (
        <img src={src} alt={name} style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center' }} />
      ) : (
        <div style={{
          width: '100%', height: '100%',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: size * 0.35, fontWeight: 700, color,
          textShadow: `0 0 16px ${color}`,
          opacity: 0.85,
          fontFamily: 'var(--font-geist-mono)',
        }}>
          {name[0]}
        </div>
      )}
    </div>
  )
}

// ── God Card — responsive sidebar/mobile card ────────────────────────────
function GodCard({ agent, isSelected, isRunning, onClick }: {
  agent: Agent; isSelected: boolean; isRunning: boolean; onClick: () => void
}) {
  const cfg = PANTHEON[agent.slug]
  const color  = cfg?.color  || '#6b7280'
  const cardBg = cfg?.cardBg || 'rgba(255,255,255,0.04)'

  const iconBorder = `1.5px solid ${isSelected ? color + '70' : color + '28'}`
  const iconBg     = cfg?.src ? 'transparent' : `radial-gradient(circle at 38% 38%, ${color}28, rgba(0,0,0,0.85))`

  function AgentAvatar({ size }: { size: number }) {
    return (
      <div style={{ position: 'relative', flexShrink: 0 }}>
        <div style={{
          width: size, height: size, borderRadius: '50%', overflow: 'hidden',
          border: iconBorder, background: iconBg,
          boxShadow: isSelected ? `0 0 16px 3px ${color}35` : `0 0 6px 1px ${color}12`,
          transition: 'all 0.25s',
        }}>
          {cfg?.src ? (
            <img src={cfg.src} alt={agent.name}
              style={{
                width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center',
                filter: `brightness(${isSelected ? 1.1 : 0.82}) saturate(1.2)`,
                transition: 'filter 0.25s',
              }} />
          ) : (
            <div style={{
              width: '100%', height: '100%',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: size * 0.36, fontWeight: 700, color,
              opacity: isSelected ? 0.9 : 0.55,
              fontFamily: 'var(--font-geist-mono)',
            }}>
              {agent.name[0]}
            </div>
          )}
        </div>
        {isSelected && isRunning && (
          <div style={{
            position: 'absolute', bottom: 1, right: 1,
            width: size > 44 ? 10 : 8, height: size > 44 ? 10 : 8, borderRadius: '50%',
            background: color,
            animation: 'pulse-dot 0.9s ease-in-out infinite',
            border: '2px solid var(--surface-2)',
          }} />
        )}
      </div>
    )
  }

  return (
    <button
      onClick={onClick}
      className="w-full text-left transition-all cursor-pointer border-b border-white/[0.03]"
      style={{
        borderLeft: `2px solid ${isSelected ? color : 'transparent'}`,
        background: isSelected ? cardBg : 'transparent',
      }}
    >
      {/* ── Mobile card (full-width, touch-sized) ────────────────────── */}
      <div className="flex md:hidden items-center gap-4 px-4 py-4">
        <AgentAvatar size={56} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: 15, fontWeight: 700, lineHeight: 1.2, color: isSelected ? '#f9fafb' : '#e5e7eb' }}>
            {agent.name}
          </p>
          {cfg?.title && (
            <p style={{
              fontSize: 9, marginTop: 3, letterSpacing: '0.07em', color,
              opacity: isSelected ? 0.9 : 0.65,
              fontFamily: 'var(--font-geist-mono)', textTransform: 'uppercase',
            }}>
              {cfg.title}
            </p>
          )}
          {agent.description && (
            <p style={{
              fontSize: 12, marginTop: 5, lineHeight: 1.4, color: '#6b7280',
              overflow: 'hidden', display: '-webkit-box',
              WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
            }}>
              {agent.description}
            </p>
          )}
        </div>
        {isSelected && isRunning ? (
          <svg className="w-4 h-4 flex-shrink-0 animate-spin" style={{ color }} fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        ) : (
          <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
            style={{ color: isSelected ? color : '#374151' }}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        )}
      </div>

      {/* ── Desktop sidebar card (compact) ───────────────────────────── */}
      <div className="hidden md:flex items-center gap-2.5 py-2 transition-all"
        style={{ paddingLeft: isSelected ? 10 : 12, paddingRight: 10 }}>
        <AgentAvatar size={42} />
        <div style={{ minWidth: 0, flex: 1 }}>
          <p style={{
            fontSize: 12, fontWeight: 700, lineHeight: 1.2,
            color: isSelected ? '#f9fafb' : '#d1d5db', transition: 'color 0.2s',
          }}>
            {agent.name}
          </p>
          {cfg?.title && (
            <p style={{
              fontSize: 8, marginTop: 2, letterSpacing: '0.06em', color,
              opacity: isSelected ? 0.9 : 0.55,
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
              fontFamily: 'var(--font-geist-mono)', textTransform: 'uppercase',
            }}>
              {cfg.title}
            </p>
          )}
          {agent.description && (
            <p style={{
              fontSize: 10, marginTop: 3, lineHeight: 1.35,
              color: isSelected ? '#9ca3af' : '#6b7280',
              overflow: 'hidden', display: '-webkit-box',
              WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
            }}>
              {agent.description}
            </p>
          )}
        </div>
        {isSelected && isRunning && (
          <svg className="w-3 h-3 flex-shrink-0 animate-spin" style={{ color }} fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        )}
      </div>
    </button>
  )
}

export default function AgentsPage() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const [agents, setAgents]           = useState<Agent[]>([])
  const [loadingData, setLoadingData] = useState(true)
  const [selected, setSelected]       = useState<Agent | null>(null)
  const [message, setMessage]         = useState('')
  const [running, setRunning]         = useState(false)
  const [response, setResponse]       = useState('')
  const [runError, setRunError]       = useState('')
  const [showCreate, setShowCreate]   = useState(false)
  const [creating, setCreating]       = useState(false)
  const [createError, setCreateError] = useState('')
  const [form, setForm]               = useState({ name: '', description: '', system_prompt: '', model: 'llama3' })

  useEffect(() => {
    if (!loading && !user) router.replace('/login')
    if (!loading && user && !user.training_completed) router.replace('/training')
  }, [user, loading, router])

  useEffect(() => {
    if (!user) return
    api.getAgents()
      .then(r => setAgents(r.data as Agent[]))
      .catch(() => {})
      .finally(() => setLoadingData(false))
  }, [user])

  const handleRun = async () => {
    if (!selected || !message.trim()) return
    setRunning(true); setResponse(''); setRunError('')
    try {
      const res = await api.runAgent(selected.id, { message })
      const d = res.data as { response: string }
      if (isRateLimitError(d.response)) { setRunError('rate_limit') }
      else { setResponse(d.response); setMessage('') }
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || 'Execution failed.'
      setRunError(msg)
    } finally { setRunning(false) }
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault(); setCreating(true); setCreateError('')
    try {
      await api.createAgent(form)
      const r = await api.getAgents()
      setAgents(r.data as Agent[])
      setShowCreate(false)
      setForm({ name: '', description: '', system_prompt: '', model: 'llama3' })
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
        || 'Failed to create agent.'
      setCreateError(msg)
    } finally { setCreating(false) }
  }

  if (loading || !user) return null

  const builtin = agents.filter(a => a.agent_type === 'builtin')
  const custom  = agents.filter(a => a.agent_type === 'user_created')
  const selectedCfg = selected ? PANTHEON[selected.slug] : null

  return (
    <div className="flex flex-col h-full" style={{ background: 'var(--surface-1)' }}>

      {/* ── Top nav ─────────────────────────────────────────────────────── */}
      <div className="flex-shrink-0 border-b border-white/[0.06] px-4 py-2.5 flex items-center gap-3"
        style={{ background: 'rgba(7,7,15,0.8)', backdropFilter: 'blur(12px)' }}>
        <div className="logo-mark flex-shrink-0">A</div>
        <span className="text-sm font-semibold hidden sm:block" style={{ color: '#e8c44a', letterSpacing: '0.01em' }}>Aegis Lite</span>
        <div className="divider hidden sm:block" style={{ height: 16 }} />
        <AppNav currentPage="/agents" />
        <button
          onClick={() => setShowCreate(!showCreate)}
          className="ml-auto px-3 py-1.5 text-xs font-semibold rounded-lg transition-all hover:opacity-90 cursor-pointer"
          style={{ background: 'linear-gradient(135deg, #b8860b 0%, #e8c44a 50%, #b8860b 100%)', color: '#1a0e00', letterSpacing: '0.02em' }}>
          + Agent
        </button>
      </div>

      <div className="flex flex-1 min-h-0">

        {/* ── Sidebar ──────────────────────────────────────────────────── */}
        <div
          className={`${selected ? 'hidden md:flex' : 'flex'} flex-col md:border-r border-white/[0.06] overflow-y-auto w-full md:w-[236px] md:min-w-[236px]`}
          style={{ flexShrink: 0, background: 'var(--surface-2)' }}
        >
          {/* Create form */}
          {showCreate && (
            <form onSubmit={handleCreate} className="p-3 border-b border-white/[0.06] space-y-2"
              style={{ background: 'var(--surface-3)' }}>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">New Governed Agent</p>
              {[
                { key: 'name', label: 'Name', placeholder: 'My Agent' },
                { key: 'description', label: 'Description', placeholder: 'What does it do?' },
                { key: 'system_prompt', label: 'System Prompt', placeholder: 'You are a governed assistant…' },
              ].map(({ key, label, placeholder }) => (
                <div key={key}>
                  <label className="text-[10px] text-gray-600 block mb-1">{label}</label>
                  <input
                    value={form[key as keyof typeof form]}
                    onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                    placeholder={placeholder} required
                    className="w-full px-2.5 py-1.5 rounded-lg text-xs text-gray-200 placeholder-gray-600 focus:outline-none transition-colors"
                    style={{ background: 'var(--surface-2)', border: '1px solid rgba(255,255,255,0.08)' }}
                  />
                </div>
              ))}
              {createError && <p className="text-[10px] text-red-400 px-1">{createError}</p>}
              <div className="flex gap-2 pt-1">
                <button type="submit" disabled={creating}
                  className="flex-1 py-1.5 text-white text-xs font-semibold rounded-lg disabled:opacity-50 hover:opacity-90 cursor-pointer"
                  style={{ background: 'linear-gradient(135deg, #3b82f6, #6366f1)' }}>
                  {creating ? 'Creating…' : 'Create agent'}
                </button>
                <button type="button" onClick={() => { setShowCreate(false); setCreateError('') }}
                  className="px-3 text-gray-500 hover:text-gray-300 text-xs transition-colors cursor-pointer">
                  Cancel
                </button>
              </div>
            </form>
          )}

          {loadingData ? (
            <div className="p-3 space-y-2">
              {[1,2,3,4,5,6].map(i => (
                <div key={i} className="flex items-center gap-2.5">
                  <div className="skeleton" style={{ width: 42, height: 42, borderRadius: '50%' }} />
                  <div className="flex-1 space-y-1.5">
                    <div className="skeleton h-3" style={{ width: '60%' }} />
                    <div className="skeleton h-2" style={{ width: '80%' }} />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <>
              {builtin.length > 0 && (
                <div>
                  <div className="px-4 md:px-3 py-3 md:py-2 flex items-center gap-2 border-b border-white/[0.04]">
                    <span className="text-[10px] md:text-[9px] text-gray-600 uppercase tracking-widest font-semibold">Pantheon</span>
                    <span className="text-[10px] md:text-[9px] text-gray-700 ml-auto">{builtin.length} active</span>
                  </div>
                  {builtin.map(a => (
                    <GodCard key={a.id} agent={a}
                      isSelected={selected?.id === a.id}
                      isRunning={running && selected?.id === a.id}
                      onClick={() => { setSelected(a); setResponse(''); setRunError('') }}
                    />
                  ))}
                </div>
              )}
              {custom.length > 0 && (
                <div>
                  <p className="px-3 py-2 text-[9px] text-gray-600 uppercase tracking-widest font-semibold border-b border-white/[0.04] border-t border-white/[0.04] mt-1">
                    Custom
                  </p>
                  {custom.map(a => (
                    <button key={a.id}
                      onClick={() => { setSelected(a); setResponse(''); setRunError('') }}
                      className={`w-full text-left px-3 py-2.5 border-b border-white/[0.03] transition-colors cursor-pointer text-xs ${
                        selected?.id === a.id ? 'text-gray-200' : 'text-gray-500 hover:bg-white/[0.03]'
                      }`}
                      style={selected?.id === a.id ? { background: 'rgba(59,130,246,0.06)', borderLeft: '2px solid #3b82f6', paddingLeft: 10 } : {}}>
                      <p className="font-medium">{a.name}</p>
                      <p className="text-[10px] text-gray-600 mt-0.5 truncate">{a.description}</p>
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        {/* ── Main panel ───────────────────────────────────────────────── */}
        <div className={`${selected ? 'flex' : 'hidden md:flex'} flex-1 flex-col min-w-0`}>
          {!selected ? (

            /* ── Command Nexus arena ─────────────────────────────────── */
            <div className="flex-1 relative overflow-hidden flex items-center justify-center"
              style={{ background: '#05050d' }}>

              {/* 3:2 arena — matches image aspect ratio exactly (no crop) */}
              <div className="relative" style={{ width: '100%', aspectRatio: '3/2', maxHeight: '100%' }}>

                <img src="/agents/arena.webp?v=2" alt="" aria-hidden="true"
                  style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center' }} />

                {/* Edge vignette */}
                <div style={{
                  position: 'absolute', inset: 0, pointerEvents: 'none',
                  background: 'radial-gradient(ellipse at 50% 50%, transparent 40%, rgba(5,5,13,0.55) 100%)',
                }} />

                {/* Agent medallions — centered at cx/cy */}
                {builtin.map(agent => {
                  const cfg = PANTHEON[agent.slug]
                  if (!cfg) return null
                  return (
                    <div key={agent.id}
                      onClick={() => { setSelected(agent); setResponse(''); setRunError('') }}
                      style={{
                        position: 'absolute',
                        left: cfg.cx, top: cfg.cy,
                        transform: 'translate(-50%, -50%)',
                        width: cfg.size,
                        cursor: 'pointer',
                        zIndex: 3,
                      }}>

                      {/* Name bubble above icon */}
                      <div style={{
                        position: 'absolute',
                        bottom: 'calc(100% + 7px)',
                        left: '50%', transform: 'translateX(-50%)',
                        display: 'flex', alignItems: 'center', gap: 4,
                        padding: '3px 8px', borderRadius: 8,
                        background: 'rgba(5,5,13,0.85)',
                        border: `1px solid ${cfg.color}40`,
                        backdropFilter: 'blur(12px)',
                        whiteSpace: 'nowrap',
                        pointerEvents: 'none', zIndex: 4,
                      }}>
                        <div style={{
                          width: 4, height: 4, borderRadius: '50%', background: cfg.color,
                          animation: 'pulse-dot 2.2s ease-in-out infinite', flexShrink: 0,
                        }} />
                        <span style={{
                          fontSize: 8, fontWeight: 700, color: cfg.color,
                          letterSpacing: '0.07em', fontFamily: 'var(--font-geist-mono)',
                        }}>
                          {agent.name.toUpperCase()}
                        </span>
                        {/* Pointer */}
                        <div style={{
                          position: 'absolute', bottom: -4, left: '50%', transform: 'translateX(-50%)',
                          width: 0, height: 0,
                          borderLeft: '4px solid transparent', borderRight: '4px solid transparent',
                          borderTop: `4px solid ${cfg.color}40`,
                        }} />
                      </div>

                      {/* Glow beneath icon */}
                      <div style={{
                        position: 'absolute', top: '50%', left: '50%',
                        transform: 'translate(-50%, -50%)',
                        width: '160%', height: '160%',
                        borderRadius: '50%',
                        background: cfg.glow, filter: 'blur(18px)',
                        animation: 'holo-glow-pulse 3s ease-in-out infinite',
                        animationDelay: cfg.floatDelay,
                        zIndex: -1,
                      }} />

                      {/* Circular medallion */}
                      <div
                        style={{
                          width: '100%', aspectRatio: '1/1', borderRadius: '50%', overflow: 'hidden',
                          border: `1.5px solid ${cfg.color}40`,
                          background: cfg.src ? 'transparent' : `radial-gradient(circle at 38% 38%, ${cfg.color}28, rgba(0,0,0,0.88))`,
                          boxShadow: `0 0 22px 4px ${cfg.glow}, inset 0 0 14px rgba(0,0,0,0.6)`,
                          animation: 'holo-float 4.5s ease-in-out infinite',
                          animationDelay: cfg.floatDelay,
                          transition: 'box-shadow 0.3s',
                        }}
                        className="medallion-hover"
                      >
                        {cfg.src ? (
                          <img src={cfg.src} alt={agent.name}
                            style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center' }} />
                        ) : (
                          <div style={{
                            width: '100%', height: '100%',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: '2.2em', fontWeight: 700, color: cfg.color,
                            textShadow: `0 0 18px ${cfg.color}`,
                            opacity: 0.85, fontFamily: 'var(--font-geist-mono)',
                          }}>
                            {agent.name[0]}
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}

                {/* Status badge — top right */}
                <div style={{
                  position: 'absolute', top: '4%', right: '3%',
                  display: 'flex', alignItems: 'center', gap: 5,
                  padding: '3px 9px', borderRadius: 7,
                  background: 'rgba(0,0,0,0.6)', border: '1px solid rgba(255,255,255,0.07)',
                  backdropFilter: 'blur(8px)',
                }}>
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 pulse-dot" />
                  <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.35)', fontFamily: 'var(--font-geist-mono)' }}>
                    COMMAND NEXUS · {builtin.length} ACTIVE
                  </span>
                </div>

                {/* Instruction — bottom center */}
                <div style={{
                  position: 'absolute', bottom: '4%', left: '50%', transform: 'translateX(-50%)',
                  whiteSpace: 'nowrap',
                }}>
                  <p style={{ fontSize: 9, color: 'rgba(255,255,255,0.2)', fontFamily: 'var(--font-geist-mono)', letterSpacing: '0.06em' }}>
                    SELECT AN AGENT TO INVOKE
                  </p>
                </div>

                {/* ── Coming Soon panel — bottom strip ──────────────── */}
                <div style={{
                  position: 'absolute', bottom: 0, left: 0, right: 0,
                  background: 'rgba(3,3,10,0.88)',
                  borderTop: '1px solid rgba(255,255,255,0.05)',
                  backdropFilter: 'blur(14px)',
                  padding: '8px 16px',
                  display: 'flex', alignItems: 'center', gap: 12,
                }}>
                  {/* Label */}
                  <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 2, marginRight: 4 }}>
                    <span style={{ fontSize: 7, fontWeight: 700, color: 'rgba(255,255,255,0.22)', fontFamily: 'var(--font-geist-mono)', letterSpacing: '0.14em' }}>COMING</span>
                    <span style={{ fontSize: 7, fontWeight: 700, color: 'rgba(255,255,255,0.22)', fontFamily: 'var(--font-geist-mono)', letterSpacing: '0.14em' }}>SOON</span>
                  </div>
                  <div style={{ width: 1, height: 36, background: 'rgba(255,255,255,0.06)', flexShrink: 0 }} />

                  {/* Coming soon agents */}
                  <div style={{ display: 'flex', gap: 8, flex: 1, alignItems: 'center', overflowX: 'auto' }}>
                    {COMING_SOON.map(cs => (
                      <div key={cs.name}
                        title={`${cs.name} — ${cs.desc}`}
                        style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 7,
                          padding: '4px 10px 4px 5px',
                          background: 'rgba(255,255,255,0.03)',
                          border: `1px solid ${cs.color}18`,
                          borderRadius: 8,
                          cursor: 'default',
                        }}>
                        {/* Placeholder circle */}
                        <div style={{
                          width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
                          border: `1px solid ${cs.color}30`,
                          background: `radial-gradient(circle at 38% 38%, ${cs.color}22, rgba(0,0,0,0.7))`,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 10, fontWeight: 700, color: cs.color, opacity: 0.7,
                          fontFamily: 'var(--font-geist-mono)',
                        }}>
                          {cs.name[0]}
                        </div>
                        <div style={{ minWidth: 0 }}>
                          <p style={{ fontSize: 10, fontWeight: 600, color: 'rgba(255,255,255,0.5)', lineHeight: 1 }}>{cs.name}</p>
                          <p style={{ fontSize: 7.5, color: cs.color, opacity: 0.6, marginTop: 1.5, letterSpacing: '0.04em', fontFamily: 'var(--font-geist-mono)', whiteSpace: 'nowrap' }}>{cs.title.split(' · ')[0].toUpperCase()}</p>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Standby icons (Nemesis etc) at far right */}
                  {STANDBY.length > 0 && (
                    <>
                      <div style={{ width: 1, height: 36, background: 'rgba(255,255,255,0.05)', flexShrink: 0 }} />
                      <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 1 }}>
                        <span style={{ fontSize: 6, color: 'rgba(255,255,255,0.15)', fontFamily: 'var(--font-geist-mono)', letterSpacing: '0.1em' }}>STANDBY</span>
                        <div style={{ display: 'flex', gap: 5 }}>
                          {STANDBY.map(b => (
                            <div key={b.slug} title={b.name} style={{
                              width: 24, height: 24, borderRadius: '50%',
                              border: `1px solid ${b.color}20`,
                              background: `radial-gradient(circle at 38% 38%, ${b.color}15, rgba(0,0,0,0.7))`,
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              fontSize: 8, fontWeight: 700, color: b.color, opacity: 0.4,
                              fontFamily: 'var(--font-geist-mono)',
                            }}>{b.name[0]}</div>
                          ))}
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>

          ) : (

            /* ── Agent selected — strip + run panel ──────────────────── */
            <>
              {/* Compact arena strip */}
              {selectedCfg && (
                <div className="flex-shrink-0" style={{ height: 'clamp(80px, 14vw, 110px)', position: 'relative', overflow: 'hidden', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                  <img src="/agents/arena.webp?v=2" alt="" aria-hidden="true"
                    style={{
                      position: 'absolute', inset: 0, width: '100%', height: '100%',
                      objectFit: 'cover', objectPosition: 'center 55%',
                      filter: 'blur(2px) brightness(0.3) saturate(0.7)',
                    }} />
                  <div style={{
                    position: 'absolute', inset: 0,
                    background: 'linear-gradient(to right, rgba(5,5,13,0.95) 0%, rgba(5,5,13,0.5) 40%, rgba(5,5,13,0.15) 70%, rgba(5,5,13,0.65) 100%)',
                  }} />

                  {/* Glow orb */}
                  <div style={{
                    position: 'absolute', top: '50%', left: 22,
                    transform: 'translateY(-50%)',
                    width: 90, height: 90, borderRadius: '50%',
                    background: selectedCfg.glow, filter: 'blur(24px)',
                    animation: 'holo-glow-pulse 2.5s ease-in-out infinite',
                  }} />

                  <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', padding: '0 16px', gap: 14 }}>

                    {/* Mobile back */}
                    <button onClick={() => setSelected(null)}
                      className="md:hidden flex-shrink-0 text-gray-500 hover:text-gray-300 transition-colors cursor-pointer">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                      </svg>
                    </button>

                    {/* Large circular icon — 56px mobile / 78px desktop */}
                    <div style={{
                      animation: running ? 'holo-float 1.8s ease-in-out infinite' : 'holo-float 5s ease-in-out infinite',
                      flexShrink: 0,
                    }}>
                      <span className="md:hidden">
                        <AgentIcon src={selectedCfg.src} name={selected.name} color={selectedCfg.color} glow={selectedCfg.glow} size={56} animated />
                      </span>
                      <span className="hidden md:inline">
                        <AgentIcon src={selectedCfg.src} name={selected.name} color={selectedCfg.color} glow={selectedCfg.glow} size={78} animated />
                      </span>
                    </div>

                    {/* Name + meta */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <h2 style={{ fontSize: 19, fontWeight: 700, color: '#f9fafb', lineHeight: 1.1 }}>{selected.name}</h2>
                        {selected.agent_type === 'builtin' && (
                          <span className="badge badge-info" style={{ fontSize: 8 }}>Built-in</span>
                        )}
                        {running && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                            <div style={{ width: 6, height: 6, borderRadius: '50%', background: selectedCfg.color, animation: 'pulse-dot 0.8s ease-in-out infinite' }} />
                            <span style={{ fontSize: 8, color: selectedCfg.color, fontFamily: 'var(--font-geist-mono)', letterSpacing: '0.08em' }}>ACTIVE</span>
                          </div>
                        )}
                      </div>
                      <p style={{ fontSize: 10, color: selectedCfg.color, letterSpacing: '0.05em', fontFamily: 'var(--font-geist-mono)', marginTop: 3 }}>
                        {selectedCfg.title}
                      </p>
                      <div className="hidden sm:flex" style={{ alignItems: 'center', gap: 12, marginTop: 6, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 10, color: '#4b5563', display: 'flex', alignItems: 'center', gap: 4 }}>
                          <svg className="w-3 h-3 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.955 11.955 0 002.25 12c0 3.072 1.15 5.877 3.047 7.987A11.952 11.952 0 0012 21.75a11.95 11.95 0 006.98-2.26A11.96 11.96 0 0021.75 12c0-2.044-.51-3.97-1.41-5.657A11.956 11.956 0 0012 4.964z" />
                          </svg>
                          {agentTierLabel(selected.model)}
                        </span>
                        {selected.budget_limit_usd && (
                          <span style={{ fontSize: 10, color: '#4b5563' }}>${selected.budget_limit_usd} / run</span>
                        )}
                        <span style={{ fontSize: 10, color: '#4b5563' }}>Audit logging</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Response area */}
              <div className="flex-1 overflow-y-auto p-4 md:p-5">
                {!response && !runError && !running && (
                  <div className="flex flex-col gap-5 h-full">
                    {/* Description */}
                    <p className="text-sm text-gray-400 leading-relaxed">{selected.description}</p>

                    {/* Demo prompts */}
                    {DEMO_PROMPTS[selected.slug] && (
                      <div>
                        <p className="text-[9px] text-gray-600 uppercase tracking-widest font-semibold mb-3" style={{ fontFamily: 'var(--font-geist-mono)' }}>
                          Try a demo
                        </p>
                        <div className="flex flex-col gap-2">
                          {DEMO_PROMPTS[selected.slug].map(d => (
                            <button
                              key={d.label}
                              onClick={() => { setMessage(d.prompt) }}
                              className="text-left px-4 py-3 rounded-xl border transition-all cursor-pointer group"
                              style={{
                                background: 'rgba(255,255,255,0.02)',
                                border: '1px solid rgba(255,255,255,0.07)',
                              }}
                              onMouseEnter={e => (e.currentTarget.style.borderColor = selectedCfg?.color + '45' || 'rgba(255,255,255,0.15)')}
                              onMouseLeave={e => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.07)')}
                            >
                              <p className="text-xs font-semibold mb-1" style={{ color: selectedCfg?.color || '#e8c44a' }}>{d.label}</p>
                              <p className="text-[11px] text-gray-500 leading-relaxed line-clamp-2">{d.prompt}</p>
                            </button>
                          ))}
                        </div>
                        <p className="text-[10px] text-gray-700 mt-3">Click a prompt above to pre-fill, or type your own below.</p>
                      </div>
                    )}

                    {!DEMO_PROMPTS[selected.slug] && (
                      <div className="flex-1 flex items-center justify-center">
                        <p className="text-[11px] text-gray-700">Send a message below to invoke {selected.name}.</p>
                      </div>
                    )}
                  </div>
                )}
                {running && (
                  <div className="flex items-center gap-3 px-4 py-3 rounded-xl border border-white/[0.06]"
                    style={{ background: 'var(--surface-2)' }}>
                    <svg className="w-4 h-4 text-blue-400 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    <span className="text-[11px] text-gray-500">Policy engine evaluating request…</span>
                  </div>
                )}
                {runError === 'rate_limit' && (
                  <div className="px-4 py-4 rounded-xl border border-amber-500/20 space-y-2"
                    style={{ background: 'rgba(245,158,11,0.05)' }}>
                    <p className="text-xs font-semibold text-amber-400">Free model rate limit reached</p>
                    <p className="text-[11px] text-gray-400 leading-relaxed">
                      The free-tier inference model hit its per-minute limit. Wait 30–60 seconds and try again.
                    </p>
                    <p className="text-[11px] text-gray-500">
                      Jesse offers <a href="https://jesseboudreau.com/agent" target="_blank" rel="noopener" className="text-blue-400 hover:underline">rate-limited API access</a> as part of Aegis enterprise consulting.
                    </p>
                  </div>
                )}
                {runError && runError !== 'rate_limit' && (
                  <div className="px-4 py-3 rounded-xl border border-red-500/20 text-xs text-red-400"
                    style={{ background: 'rgba(239,68,68,0.06)' }}>
                    {runError}
                  </div>
                )}
                {response && !runError && (
                  <div className="rounded-xl border border-white/[0.06] p-5" style={{ background: 'var(--surface-2)' }}>
                    <p className="text-[9px] text-gray-600 uppercase tracking-widest mb-3 font-semibold">Governed Response</p>
                    <div className="text-sm text-gray-200 leading-relaxed"
                      dangerouslySetInnerHTML={{ __html: renderAgentResponse(response) }} />
                  </div>
                )}
              </div>

              {/* Input */}
              <div className="border-t border-white/[0.06] p-3 md:p-4 flex-shrink-0">
                <div className="flex gap-2">
                  <textarea
                    value={message}
                    onChange={e => setMessage(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleRun() } }}
                    placeholder={`Send a request to ${selected.name}…`}
                    rows={3} disabled={running}
                    className="flex-1 px-3 py-2.5 rounded-lg text-sm text-gray-200 placeholder-gray-600 resize-none focus:outline-none disabled:opacity-50 transition-colors"
                    style={{ background: 'var(--surface-2)', border: '1px solid rgba(255,255,255,0.08)' }}
                  />
                  <button onClick={handleRun} disabled={!message.trim() || running}
                    className="px-4 py-2 text-white text-sm font-semibold rounded-lg transition-all disabled:opacity-30 hover:opacity-90 cursor-pointer disabled:cursor-default"
                    style={{ background: 'linear-gradient(135deg, #3b82f6, #6366f1)' }}>
                    {running ? (
                      <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                    ) : 'Run'}
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      <LogoutButton />
    </div>
  )
}
