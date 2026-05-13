import axios, { AxiosInstance } from 'axios'

const PROXY_BASE = '/api'

export const STORAGE_KEY_EMAIL     = 'aegis_lite_user_email'
export const STORAGE_KEY_JWT       = 'aegis_lite_jwt'
export const STORAGE_KEY_TIMESTAMP = 'aegis_lite_auth_timestamp'

export const SESSION_TTL_MS = 8 * 60 * 60 * 1000  // 8 hours

const _client: AxiosInstance = axios.create({
  baseURL: PROXY_BASE,
  headers: { 'Content-Type': 'application/json' },
  timeout: 30000,
})

_client.interceptors.request.use((config) => {
  if (typeof window === 'undefined') return config

  const email = localStorage.getItem(STORAGE_KEY_EMAIL)
  const jwt   = localStorage.getItem(STORAGE_KEY_JWT)

  if (email) config.headers['X-User-Email']  = email
  if (jwt)   config.headers['Authorization'] = `Bearer ${jwt}`

  localStorage.setItem(STORAGE_KEY_TIMESTAMP, String(Date.now()))
  return config
})

export function initApiClient(userEmail: string, jwt?: string | null): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(STORAGE_KEY_EMAIL, userEmail)
  if (jwt) localStorage.setItem(STORAGE_KEY_JWT, jwt)
  localStorage.setItem(STORAGE_KEY_TIMESTAMP, String(Date.now()))
  document.cookie = 'aegis_session=authenticated; path=/'
}

export function clearApiClient(): void {
  if (typeof window === 'undefined') return
  localStorage.removeItem(STORAGE_KEY_EMAIL)
  localStorage.removeItem(STORAGE_KEY_JWT)
  localStorage.removeItem(STORAGE_KEY_TIMESTAMP)
  document.cookie = 'aegis_session=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT'
}

export function isSessionValid(): boolean {
  if (typeof window === 'undefined') return false
  const ts = localStorage.getItem(STORAGE_KEY_TIMESTAMP)
  if (!ts) return false
  return Date.now() - parseInt(ts, 10) < SESSION_TTL_MS
}

export function isJWTExpired(token: string): boolean {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]))
    return payload.exp * 1000 < Date.now()
  } catch {
    return true
  }
}

// ── Auth client (unauthenticated) ─────────────────────────────────────────────
const _authClient: AxiosInstance = axios.create({
  baseURL: PROXY_BASE,
  headers: { 'Content-Type': 'application/json' },
  timeout: 10000,
})

// ── API surface ────────────────────────────────────────────────────────────────
export const api = {
  // Auth
  requestMagicLink:  (email: string) => _authClient.post('/auth/magic-link', { email }),
  verifyToken:       (token: string) => _authClient.get(`/auth/verify?token=${token}`),
  passwordLogin:     (email: string, password: string) => _authClient.post('/auth/login', { email, password }),
  validateStoredJWT: (token: string) => _authClient.get(`/auth/me?token=${token}`),
  getMe:             () => _client.get('/users/me'),

  // Models
  getModels: () => _client.get('/models'),

  // Chat
  chat: (data: {
    message: string
    model: string
    conversation_id?: string | null
    file_content?: string
    file_name?: string
    system_id?: string | null
  }) => _client.post('/chat', data),

  // Conversations
  getConversations: () => _client.get('/conversations'),
  getMessages: (id: string) => _client.get(`/conversations/${id}/messages`),
  deleteConversation: (id: string) => _client.delete(`/conversations/${id}`),

  // Agents
  getAgents: (params?: { agent_type?: string }) => _client.get('/agents', { params }),
  getAgent: (id: string) => _client.get(`/agents/${id}`),
  createAgent: (data: unknown) => _client.post('/agents', data),
  updateAgent: (id: string, data: unknown) => _client.patch(`/agents/${id}`, data),
  deleteAgent: (id: string) => _client.delete(`/agents/${id}`),
  runAgent: (id: string, data: { message: string; model?: string }) => _client.post(`/agents/${id}/run`, data),

  // Research
  runResearch: (data: { query: string; research_type: string; search_recency?: string }) => _client.post('/research', data),
  getResearchSessions: () => _client.get('/research'),

  // Usage
  getUsage: () => _client.get('/usage'),
  getAdminUsage: (params?: { days?: number }) => _client.get('/usage/admin', { params }),

  // Governance
  getGovernanceSummary: (days?: number) => _client.get('/governance/summary', { params: { days } }),
  getGovernanceEvents: (params?: { page?: number; limit?: number; days?: number; severity?: string }) =>
    _client.get('/governance/events', { params }),
  getAuditLog: (params?: { page?: number; limit?: number; days?: number; model?: string; decision?: string; search?: string }) =>
    _client.get('/governance/audit', { params }),
  getAuditDetail: (id: string) => _client.get(`/governance/audit/${id}`),

  // Users (admin)
  getUsers: () => _client.get('/users'),
  updateBudget: (userId: string, budget: number) => _client.patch(`/users/${userId}/budget`, { monthly_budget_usd: budget }),
  resetUsage: (userId: string) => _client.post(`/users/${userId}/reset-usage`),
  markTrainingComplete: (userId: string) => _client.patch(`/users/${userId}/training`),

  // AI System Registry
  getSystems: () => _client.get('/registry'),
  createSystem: (data: unknown) => _client.post('/registry', data),
  updateSystem: (id: string, data: unknown) => _client.patch(`/registry/${id}`, data),

  // Training
  getTrainingStatus: () => _client.get('/training/status'),
  completeTraining: () => _client.post('/training/complete'),

  // Support
  startSupport: (message: string) => _client.post('/support', { message }),
  supportChat: (sessionId: string, message: string) => _client.post(`/support/${sessionId}/messages`, { message }),
  getRoutingMatrix: () => _client.get('/support/routing-matrix'),

  // Health & Status (public — no auth required)
  health:         () => _client.get('/health'),
  getStatus:      () => _client.get('/status'),
  getDemoEvents:  (count = 20) => _client.get(`/status/demo-events?count=${count}`),
}

export default _client
