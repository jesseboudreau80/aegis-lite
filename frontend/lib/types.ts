// ── Core gateway types ─────────────────────────────────────────────────────────

export interface User {
  id: string
  name: string
  email: string
  role: 'admin' | 'user'
  monthly_budget_usd: number
  current_usage_usd: number
  training_completed: boolean
}

export interface Conversation {
  id: string
  title: string
  model: string
  created_at: string
  updated_at: string
}

export interface RoutingInfo {
  model: string
  fallback_used: boolean
  reason: string
}

export interface ExecutionTraceStep {
  stage: string
  message: string
  status: 'complete' | 'warning' | 'blocked'
  metadata?: Record<string, unknown>
}

export interface SystemInfo {
  id: string
  name: string
  department: string
  risk_level: string
  status: string
}

export interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  created_at: string
  cost_info?: CostInfo
  budget_info?: BudgetInfo
  routing_info?: RoutingInfo
  execution_trace?: ExecutionTraceStep[]
  system_info?: SystemInfo
  policy_decision?: 'allowed' | 'warned' | 'blocked' | 'escalated'
}

export interface CostInfo {
  model: string
  input_tokens: number
  output_tokens: number
  total_tokens: number
  cost_usd: number
}

export interface BudgetInfo {
  current_usage: number
  monthly_budget: number
  remaining: number
  percentage_used: number
}

export interface ModelInfo {
  id: string
  display_name: string
  description?: string
  provider: string
  tier?: 'premium' | 'standard' | 'budget' | 'free'
  cost_level: 'Very Low' | 'Low' | 'Medium' | 'High'
  latency_level?: 'Fast' | 'Medium' | 'Slow'
  quality_level?: 'Highest' | 'High' | 'Good' | 'Basic'
  best_for: string
  warning: string | null
  costs: {
    input: number
    output: number
  }
}

// ── Agent types ────────────────────────────────────────────────────────────────

export interface Agent {
  id: string
  slug: string
  name: string
  description: string
  system_prompt: string
  model: string
  agent_type: 'builtin' | 'user_created'
  allowed_models: string[] | null
  budget_limit_usd: number | null
  is_active: boolean
  created_by: string | null
  created_at: string
}

// ── Governance types ───────────────────────────────────────────────────────────

export interface GovernanceEvent {
  id: string
  timestamp: string
  event_type: string
  actor_email: string | null
  severity: 'info' | 'warning' | 'critical'
  payload: Record<string, unknown>
}

export interface GovernanceSummary {
  window_days: number
  total_flagged_events: number
  blocked: number
  escalated: number
  modified_or_warned: number
  avg_risk_score: number
  top_flags: { flag: string; count: number }[]
}

// ── AI System Registry ─────────────────────────────────────────────────────────

export interface AISystem {
  id: string
  name: string
  description: string | null
  department: string | null
  risk_level: 'low' | 'medium' | 'high' | 'critical'
  status: 'draft' | 'active' | 'deprecated'
  data_classification: string
  model_used: string | null
  created_at: string
}

// ── Usage types ────────────────────────────────────────────────────────────────

export interface UsageByModel {
  model: string
  request_count: number
  total_cost_usd: number
  total_input_tokens: number
  total_output_tokens: number
}

export interface UsageData {
  user: { id: string; name: string; email: string; role: string }
  budget: {
    monthly_budget_usd: number
    current_usage_usd: number
    remaining_usd: number
    percentage_used: number
  }
  usage_by_model: UsageByModel[]
}
