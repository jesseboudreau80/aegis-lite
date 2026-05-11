# Architecture

Aegis Lite is a full-stack AI governance workspace with a clean separation between the policy enforcement layer, provider dispatch, and the audit trail.

## High-level overview

```
┌─────────────────────────────────────────────────┐
│              Next.js 15 Frontend                 │
│   (App Router · TypeScript · Tailwind · Framer) │
│                                                  │
│  Chat   Agents   Research   Governance   Audit   │
└──────────────────────┬──────────────────────────┘
                       │  /api/* proxy (Next.js)
┌──────────────────────▼──────────────────────────┐
│              FastAPI Backend                     │
│                                                  │
│  ┌─────────────────────────────────────────────┐│
│  │          Policy Engine (Phase 1)            ││
│  │  Secrets → PII → Injection → Classification ││
│  │  Model Access → Tool Gates → Risk Score     ││
│  └────────────────────┬────────────────────────┘│
│                        │                         │
│  ┌─────────────────────▼──────────────────────┐ │
│  │              AI Router                     │ │
│  │  Budget routing → Provider dispatch        │ │
│  └──────┬───────────────────────┬─────────────┘ │
│         │                       │               │
│  ┌──────▼──────┐    ┌──────────▼────────┐      │
│  │  Anthropic  │    │  OpenAI / OpenRt. │      │
│  │  (Claude)   │    │  Perplexity       │      │
│  └─────────────┘    └────────────────────┘      │
│                                                  │
│  ┌──────────────────────────────────────────────┐│
│  │          SQLite / PostgreSQL                ││
│  │  Users · Conversations · Agents · AuditLog  ││
│  │  GovernanceEvents · AISystemRegistry        ││
│  └──────────────────────────────────────────────┘│
└──────────────────────────────────────────────────┘
```

## Backend modules

### `services/policy_engine.py`
The core governance layer. Stateless, synchronous rule evaluator. Evaluates every request through 10 ordered rule checks and returns a `PolicyDecision` with decision, risk_score, flags, and rule_trace. Never calls an LLM.

### `services/ai_router.py`
Dispatch layer that sits between the policy engine and provider adapters. Applies policy decisions (model override, prompt redaction, system prompt injection) before calling the provider.

### `services/routing_engine.py`
Budget-aware model selection. Downgrades to free-tier models when budget is exhausted or per-request cost exceeds the ceiling.

### `config/policy_config.py`
Single source of truth for all governance rule constants. All thresholds, keyword lists, and regex patterns live here. No rule logic.

## Data flow for a chat request

```
User submits message
  ↓
check_rate_limit()          — per-model daily limit
  ↓
build_policy_context()      — pack user/model/prompt/source
  ↓
policy_engine.evaluate_request()   — 10 rules, risk score
  ↓  decision: block → HTTP 403 + GovernanceEvent
  ↓  decision: allow/modify → continue
routing_engine.select_model()      — budget-aware fallback
  ↓
ai_router._dispatch()              — provider call
  ↓
policy_engine.evaluate_response()  — PII/secrets scan
  ↓
increment_rate_limit(), update user.current_usage_usd
  ↓
Persist: Message, AuditLog, GovernanceEvent (if flagged)
  ↓
Return ChatResponse with routing_info, cost_info, policy_warning, execution_trace
```

## Authentication

JWT-based with HS256 signing. 24-hour token expiry. Magic-link flow supported for passwordless login.

`LOCAL_DEV=true` activates the `X-User-Email` bypass header — never enable in production.

## Edition system

`AEGIS_EDITION=lite` is the default. `config/lite_mode.py` exposes feature flags gating enterprise capabilities. Enterprise extensions can be added as optional modules that check `AEGIS_EDITION != "lite"` before activating.

## Frontend routing

All API calls are proxied through Next.js at `/api/*` to avoid CORS in development. The `next.config.ts` proxy target is controlled by `API_URL` env var.

Middleware enforces authentication on all non-public routes by checking the `aegis_session` cookie. JWT validation against the backend happens on initial page load via `AuthContext`.
