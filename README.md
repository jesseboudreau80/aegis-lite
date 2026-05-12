<div align="center">

<img src="https://img.shields.io/badge/Aegis_Lite-1.0.0-6366f1?style=for-the-badge&labelColor=0a0a0f" alt="version" />

# Aegis Lite

**Open-source AI governance and orchestration workspace.**

Policy enforcement · Audit logging · Multi-model routing · Self-hostable

[![License: Apache 2.0](https://img.shields.io/badge/License-Apache_2.0-3b82f6?style=flat-square)](LICENSE)
[![Python 3.11+](https://img.shields.io/badge/Python-3.11%2B-3b82f6?style=flat-square&logo=python&logoColor=white)](https://python.org)
[![Next.js 15](https://img.shields.io/badge/Next.js-15-black?style=flat-square&logo=nextdotjs)](https://nextjs.org)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.115-009688?style=flat-square&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![Docker](https://img.shields.io/badge/Docker-ready-2496ED?style=flat-square&logo=docker&logoColor=white)](docker-compose.yml)
[![CI](https://img.shields.io/github/actions/workflow/status/jesseboudreau80/aegis-lite/backend-tests.yml?branch=main&style=flat-square&label=CI)](https://github.com/jesseboudreau80/aegis-lite/actions)
[![Issues](https://img.shields.io/github/issues/jesseboudreau80/aegis-lite?style=flat-square&color=7057ff)](https://github.com/jesseboudreau80/aegis-lite/issues)

[**Live Demo**](https://aegis-lite.jesseboudreau.com) · [**Setup Guide**](docs/SETUP.md) · [**Architecture**](docs/ARCHITECTURE.md) · [**Policy Engine**](docs/POLICY_ENGINE.md) · [**Roadmap**](docs/ROADMAP.md)

</div>

---

Aegis Lite gives teams a production-grade platform to govern AI usage in their organization — with a **deterministic policy engine** that evaluates every request through 10 ordered rule checks before a single token reaches any model.

```
User prompt → [Policy Engine] → [AI Router] → [Provider] → [Response scan] → User
                    ↓                  ↓
             GovernanceEvent      AuditLog
             (rule trace,         (model, cost,
              risk score,          tokens, policy
              policy version)      decision)
```

---

## What's included

| Feature | Description | Status |
|---------|-------------|--------|
| **Deterministic policy engine** | PII redaction, secrets scanning, injection defense, data classification — 10 rule chain | ✅ Phase 1 |
| **Multi-model routing** | Anthropic, OpenAI, OpenRouter (Mistral/Llama/Gemini), Perplexity with budget-aware fallback | ✅ |
| **Immutable audit log** | Every request logged with rule trace, risk score, and policy version | ✅ |
| **RBAC + budget controls** | Per-role model access, per-user monthly spend limits | ✅ |
| **Governance dashboard** | Policy decisions, risk analytics, audit explorer | ✅ |
| **Agent framework** | Create and run governed agents with model allowlists and spend limits | ✅ |
| **Research integration** | Perplexity-powered research with outbound data classification | ✅ |
| **AI System Registry** | Register, classify, and govern AI systems in your organization | ✅ |
| **Training gate** | Require users to complete governance training before AI access | ✅ |
| **Public status API** | `/status` endpoint with safe system metrics and demo mode | ✅ |
| **Demo mode** | `DEMO_MODE=true` for public showcase deployments | ✅ |

---

## Policy Engine

The policy engine is the core OSS differentiator. It evaluates **every** request **before** dispatch through 10 deterministic rules — no LLM calls inside the engine.

```
Request received
    │
    ├─ 1. Secrets detection     → BLOCK  if API keys, credentials, private keys
    ├─ 2. Model access control  → OVERRIDE or BLOCK based on role + dept
    ├─ 3. Agent permissions     → OVERRIDE model to agent's allowlist
    ├─ 4. Data classification   → AUTO-DETECT Public/Internal/Confidential/Restricted
    ├─ 5. PII detection         → REDACT emails, phones, SSNs, credit cards
    ├─ 6. Prompt injection      → ESCALATE on 21 jailbreak patterns (risk-scored)
    ├─ 7. Sensitive keywords    → WARN on restricted/confidential keywords
    ├─ 8. Research outbound     → BLOCK classified data to external search APIs
    ├─ 9. Tool grant check      → DENY unauthorized tool invocations
    └─ 10. Risk behavior        → INJECT governance notice, set audit level
         │
         ▼
    PolicyDecision { decision, risk_score, flags, rule_trace, policy_version }
         │
         ├─ allow    → dispatch to provider
         ├─ modify   → dispatch with redacted prompt
         ├─ warn     → dispatch + flag in governance log
         ├─ escalate → dispatch + human review notification
         └─ block    → HTTP 403, GovernanceEvent logged
```

**Risk scoring:** Each rule that fires adds a delta to a cumulative risk score (0.0–1.0). Thresholds: warn ≥ 0.25 · escalate ≥ 0.60 · block ≥ 0.85. Force-block flags override thresholds immediately.

See [docs/POLICY_ENGINE.md](docs/POLICY_ENGINE.md) for the full rule taxonomy and extension guide.

---

## Quickstart

### Docker (recommended)

```bash
git clone https://github.com/jesseboudreau80/aegis-lite.git
cd aegis-lite
cp .env.example .env          # edit: set SECRET_KEY + one AI provider key
docker compose up
```

Open [http://localhost:3000](http://localhost:3000). Sign in with `admin@example.com`.

> **Zero-config demo:** without any API keys, all models run in demo mode with simulated responses.

### Local development

```bash
# Backend
cd backend
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp ../.env.example .env && nano .env    # set LOCAL_DEV=true + SECRET_KEY
uvicorn main:app --reload --port 8100

# Frontend (new terminal)
cd frontend && npm install && npm run dev
```

---

## Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `SECRET_KEY` | — | 32+ char random string. Generate: `openssl rand -hex 32` |
| `ANTHROPIC_API_KEY` | — | Claude Opus + Sonnet models |
| `OPENAI_API_KEY` | — | GPT-4o + GPT-4o Mini models |
| `OPENROUTER_API_KEY` | — | Mistral, Llama, Gemini (includes free-tier models) |
| `PERPLEXITY_API_KEY` | — | Research page (web-grounded queries) |
| `DATABASE_URL` | `sqlite+aiosqlite:///./aegis_lite.db` | PostgreSQL for production |
| `DEMO_MODE` | `false` | Enable seeded public-safe demo data |
| `LOCAL_DEV` | `false` | Allow weak secrets in development |
| `AEGIS_EDITION` | `lite` | Edition identifier |

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    Next.js 15 Frontend                           │
│  ┌─────────┐ ┌────────┐ ┌──────────┐ ┌────────────┐ ┌───────┐  │
│  │  Chat   │ │ Agents │ │ Research │ │ Governance │ │ Audit │  │
│  └────┬────┘ └────┬───┘ └────┬─────┘ └─────┬──────┘ └───┬───┘  │
└───────┼───────────┼──────────┼─────────────┼────────────┼───────┘
        │           │  /api proxy (JWT)       │            │
┌───────▼───────────▼──────────▼─────────────▼────────────▼───────┐
│                      FastAPI Backend                              │
│                                                                   │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │                    Policy Engine (Phase 1)                  │  │
│  │  Secrets → Model Access → Classification → PII → Injection  │  │
│  │  → Keywords → Research → Tools → Risk Controls             │  │
│  └────────────────────┬───────────────────────────────────────┘  │
│                        │ PolicyDecision                           │
│  ┌─────────────────────▼──────────────────────────┐             │
│  │              AI Router + Routing Engine         │             │
│  │  Budget-aware routing · Provider selection      │             │
│  │  Model fallback · Cost tracking                 │             │
│  └─────────────┬────────────┬──────────┬───────────┘             │
│                │            │          │                          │
│  ┌─────────────▼──┐ ┌───────▼───┐ ┌───▼────────┐               │
│  │  Anthropic     │ │  OpenAI   │ │ OpenRouter │               │
│  │  Claude Opus   │ │  GPT-4o   │ │ Mistral    │               │
│  │  Claude Sonnet │ │  GPT-mini │ │ Llama 3.1  │               │
│  └────────────────┘ └───────────┘ │ Gemini     │               │
│                                    │ Perplexity │               │
│                                    └────────────┘               │
│                                                                   │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │                    Audit + Governance Layer                  │  │
│  │  AuditLog (every request) · GovernanceEvent (policy)        │  │
│  │  RateLimitEntry · User · Agent · AISystem · ResearchSession │  │
│  └───────────────────────────┬────────────────────────────────┘  │
└──────────────────────────────┼────────────────────────────────────┘
                               │
              ┌────────────────▼────────────────┐
              │   SQLite (dev) / PostgreSQL (prod)│
              └─────────────────────────────────-┘
```

---

## API Surface

The backend exposes a documented API at `http://localhost:8100/docs`.

Key public endpoints (no auth):

```
GET  /health           → liveness probe
GET  /status           → public system status + governance metrics
GET  /status/demo-events → synthetic governance event stream
GET  /models           → available AI models
```

Key authenticated endpoints:

```
POST /auth/login       → password login → JWT
POST /auth/magic-link  → magic-link request
GET  /auth/me          → validate JWT, return user
POST /chat             → governed AI chat
GET  /usage            → per-user cost + token tracking
GET  /governance/summary → policy decision aggregates (admin)
GET  /governance/audit   → paginated audit explorer (admin)
```

---

## What's not included (Enterprise)

| Feature | Lite | Enterprise |
|---------|------|-----------|
| SOC 2 control mapping + evidence | — | ✅ |
| Infrastructure ecosystem registry | — | ✅ |
| Governed action approval workflows | — | ✅ |
| Operator mode + runtime control | — | ✅ |
| Workspace continuity engine | — | ✅ |
| Webhook / Slack notifications | — | ✅ |
| Kubernetes deployment manifests | — | ✅ |
| Multi-tenant isolation | — | ✅ |

---

## Screenshots

> 📸 Screenshots of the live deployment at [aegis-lite.jesseboudreau.com](https://aegis-lite.jesseboudreau.com)

| Landing page | Governance dashboard |
|---|---|
| *Policy engine visualizer + live status panel* | *Metric cards + event stream + flag analytics* |

| Audit explorer | Chat interface |
|---|---|
| *Decision filter chips + split detail panel* | *Model selector + routing info + execution trace* |

---

## Contributing

Aegis Lite is built for the community. The highest-value contribution areas:

| Area | Entry points |
|------|-------------|
| **Policy rules** | `backend/config/policy_config.py` + `backend/services/policy_engine.py` |
| **Tests** | `backend/tests/` — issue [#1 (policy engine)](https://github.com/jesseboudreau80/aegis-lite/issues/1), [#10 (AI router)](https://github.com/jesseboudreau80/aegis-lite/issues/10) |
| **Frontend** | Governance dashboard, audit explorer, mobile layouts |
| **Providers** | New AI provider adapters — issue [#11](https://github.com/jesseboudreau80/aegis-lite/issues/11) |
| **Docs** | Deployment guides, `AGENT_SYSTEM.md` — issue [#5](https://github.com/jesseboudreau80/aegis-lite/issues/5), [#8](https://github.com/jesseboudreau80/aegis-lite/issues/8) |

See [**CONTRIBUTING.md**](CONTRIBUTING.md) for setup instructions and PR guidelines.
See [**good-first-issues**](https://github.com/jesseboudreau80/aegis-lite/labels/good-first-issue) for scoped, actionable work.

---

## Security

See [SECURITY.md](SECURITY.md) for the vulnerability disclosure process and production hardening checklist.

**Quick production checklist:**
- [ ] `SECRET_KEY` generated with `openssl rand -hex 32`
- [ ] `LOCAL_DEV=false` (default)
- [ ] PostgreSQL database
- [ ] Reverse proxy with HTTPS
- [ ] `CORS_ORIGINS` restricted to your domain
- [ ] `.env` not committed to version control

---

## License

Apache License 2.0 — see [LICENSE](LICENSE).

Built with [FastAPI](https://fastapi.tiangolo.com) · [Next.js](https://nextjs.org) · [SQLAlchemy](https://sqlalchemy.org) · [Tailwind CSS](https://tailwindcss.com)
