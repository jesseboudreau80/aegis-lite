<div align="center">

<img src="https://img.shields.io/badge/Aegis_Lite-1.0.0-6366f1?style=for-the-badge&labelColor=0a0a0f" alt="version" />

# Aegis Lite

**Open-source AI governance layer for enterprise teams.**

Policy-before-inference · Real-time audit logging · Multi-provider routing · Self-hostable

[![License: Apache 2.0](https://img.shields.io/badge/License-Apache_2.0-3b82f6?style=flat-square)](LICENSE)
[![Python 3.11+](https://img.shields.io/badge/Python-3.11%2B-3b82f6?style=flat-square&logo=python&logoColor=white)](https://python.org)
[![Next.js 15](https://img.shields.io/badge/Next.js-15-black?style=flat-square&logo=nextdotjs)](https://nextjs.org)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.115-009688?style=flat-square&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![Issues](https://img.shields.io/github/issues/jesseboudreau80/aegis-lite?style=flat-square&color=7057ff)](https://github.com/jesseboudreau80/aegis-lite/issues)

[**Live Demo**](https://aegis-lite.jesseboudreau.com) · [**About**](https://aegis-lite.jesseboudreau.com/about) · [**Quick Start**](#quick-start) · [**Architecture**](#architecture) · [**Policy Engine**](#policy-engine) · [**Roadmap**](#roadmap)

</div>

---

## Why Aegis Lite exists

Most AI deployments have no governance layer. Teams connect employees directly to LLMs with no visibility into what's being sent, no enforcement of data policies, and no audit trail.

**Aegis Lite sits between your users and your AI providers** — evaluating every request through a deterministic policy engine before a single token reaches any model. It's not a wrapper. It's a control plane.

```
User prompt
    │
    ▼
┌─────────────────────────────────────────────────┐
│  Aegis Lite Policy Engine                        │
│                                                  │
│  1. Rate limit check                             │
│  2. Model access control (role-based)            │
│  3. Agent permission enforcement                 │
│  4. Data classification (public/internal/conf.)  │
│  5. PII detection + redaction                    │
│  6. Prompt injection scan                        │
│  7. Keyword blocklist                            │
│  8. Research provider restrictions               │
│  9. Tool grant verification                      │
│  10. Risk score threshold enforcement            │
└─────────────┬───────────────────────────────────┘
              │ allow / warn / modify / escalate / block
              ▼
        ┌─────────────┐
        │  AI Router  │  ← budget-aware, multi-provider
        └──────┬──────┘
               │
    ┌──────────┴──────────┐
    │                     │
OpenRouter              Perplexity
(Llama, GPT OSS,       (web-grounded
 Gemma — free)          research)
    │                     │
    └──────────┬──────────┘
               │
    ┌──────────┴──────────┐
    │    Response scan     │  ← post-inference policy check
    └──────────┬──────────┘
               │
    ┌──────────┴──────────┐
    │  Immutable AuditLog  │  ← cost, tokens, decision, trace
    └─────────────────────┘
```

---

## What's included

| Feature | Description | Status |
|---|---|---|
| **Policy Engine** | 10-rule deterministic chain. Zero LLM calls inside evaluation. | ✅ |
| **Governed Chat** | Streaming inference with real-time governance trace | ✅ |
| **Governed Agents** | Pre-built agents with model allowlists, budget limits, audit logs | ✅ |
| **Governed Research** | Web-grounded research (Perplexity) with pre-dispatch classification | ✅ |
| **Multi-provider Routing** | OpenRouter (free), Anthropic, OpenAI, Perplexity — budget-aware fallback | ✅ |
| **Audit Log** | Every request: model, cost, tokens, policy decision, risk score | ✅ |
| **Live Activity Feed** | SSE-based real-time governance event stream | ✅ |
| **Usage Ledger** | Per-user cost tracking, monthly budgets, admin override | ✅ |
| **AI System Registry** | Register AI systems with department, risk level, model policy | ✅ |
| **Multimodal Input** | Voice transcription + file attachments (governance-evaluated) | ✅ |
| **Onboarding Flow** | Sequential workspace orientation guide | ✅ |
| **Early Access Capture** | Waitlist email collection | ✅ |

---

## Screenshots

> **Live demo:** [aegis-lite.jesseboudreau.com](https://aegis-lite.jesseboudreau.com) — login with `demo@example.com` / `demo`

Screenshots are tracked in [`.github/assets/`](.github/assets/). The table below will be populated as assets are captured. See the [capture guide](.github/assets/README.md) for instructions.

| Governed Chat | Live Dashboard |
|:---:|:---:|
| *Streaming inference with real-time governance trace* | *Live governance control plane with SSE event feed* |

| Governance Enforcement | Audit Explorer |
|:---:|:---:|
| *Policy engine blocks PII before inference* | *Filterable audit log with cost and decision trail* |

**Screenshot-ready moments to capture:**
- Chat: send a message with an SSN pattern (e.g. `My SSN is 123-45-6789`) → red enforcement banner
- Chat: stream a normal response → shows governance trace with policy decision and token count
- Dashboard: after 5+ requests → shows live activity feed with real governance events
- Audit: with 10+ rows and detail panel open → shows full governance record

---

## Quick Start

### Prerequisites
- Python 3.11+
- Node.js 18+
- An [OpenRouter](https://openrouter.ai) API key (free tier available)

### 1. Clone and configure

```bash
git clone https://github.com/jesseboudreau80/aegis-lite.git
cd aegis-lite

# Backend
cp backend/.env.example backend/.env
# Edit backend/.env and add your OPENROUTER_API_KEY
# Generate SECRET_KEY: openssl rand -hex 32
```

### 2. Install dependencies

```bash
# Backend
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

# Frontend
cd ../frontend
npm install
```

### 3. Start the development servers

```bash
# Backend (in backend/)
uvicorn main:app --reload --port 8107

# Frontend (in frontend/)
API_URL=http://127.0.0.1:8107 npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

**Demo credentials:**
- Admin: `admin@example.com` / `demo`
- User: `demo@example.com` / `demo`

### Using the start script (production)

```bash
# Start both services
./start.sh

# Stop
./stop.sh
```

---

## Architecture

```
aegis-lite/
├── backend/
│   ├── main.py                    # FastAPI app, lifespan, CORS, JWT middleware
│   ├── models.py                  # SQLAlchemy ORM: User, AuditLog, GovernanceEvent, ...
│   ├── config/
│   │   ├── policy_config.py       # Rule thresholds, data tiers, model allowlists
│   │   ├── model_registry.py      # Single source of truth for all model metadata
│   │   └── settings.py            # Pydantic settings (reads from .env)
│   ├── services/
│   │   ├── policy_engine.py       # 10-rule deterministic evaluation chain
│   │   ├── ai_router.py           # Provider dispatch with policy integration
│   │   ├── routing_engine.py      # Budget-aware model selection
│   │   ├── cost_engine.py         # Per-token cost tracking
│   │   ├── trace_builder.py       # Execution trace for governance UI
│   │   └── providers/
│   │       ├── openrouter.py      # OpenRouter (streaming + non-streaming)
│   │       └── perplexity.py      # Perplexity (web-grounded research)
│   └── routes/
│       ├── chat.py                # POST /chat, POST /chat/stream (SSE)
│       ├── governance.py          # Activity feed, SSE stream, audit explorer
│       ├── research.py            # Web research with policy enforcement
│       ├── agents.py              # Agent CRUD + governed execution
│       └── ...
└── frontend/
    ├── app/
    │   ├── chat/page.tsx          # Streaming governed chat with multimodal input
    │   ├── dashboard/page.tsx     # Live governance control plane
    │   ├── governance/            # Audit, policies, AI registry
    │   └── ...
    └── components/
        ├── OnboardingGuide.tsx    # Sequential workspace orientation
        └── ...
```

---

## Policy Engine

The policy engine is **deterministic** — no LLM calls, no probabilistic decisions. Every request is evaluated through 10 ordered rule checks:

| # | Rule | Triggers |
|---|---|---|
| 1 | **Rate limit** | Per-user, per-model daily cap exceeded |
| 2 | **Model access** | Role-based model allowlist enforcement |
| 3 | **Agent permissions** | Agent model allowlist verification |
| 4 | **Data classification** | Content tier mismatch with provider policy |
| 5 | **PII detection** | SSN, credit card, email patterns in prompt |
| 6 | **Prompt injection** | Jailbreak, override, system prompt attacks |
| 7 | **Keyword blocklist** | Configurable topic restrictions |
| 8 | **Research restrictions** | Classification-based external dispatch blocking |
| 9 | **Tool grants** | Capability verification for agent tools |
| 10 | **Risk controls** | Cumulative risk score threshold (block ≥ 0.85) |

**Risk scoring:** 0.0–1.0 cumulative. `warn ≥ 0.25` · `escalate ≥ 0.60` · `block ≥ 0.85`

**Policy decisions:** `allow` → `warn` → `modify` → `escalate` → `block`

Every decision is logged to `GovernanceEvent` with the full rule trace, risk score, and policy version.

---

## Streaming Inference

Chat responses stream token-by-token via SSE. The governance metadata is emitted before inference begins:

```
POST /chat/stream

→  data: {"type":"meta","policy_decision":"allow","execution_trace":[...]}
→  data: {"type":"token","content":"Hello"}
→  data: {"type":"token","content":" there"}
→  ...
→  data: {"type":"done","message_id":"...","cost_info":{...},"execution_trace":[...]}
```

The frontend renders tokens incrementally with a typing cursor, showing live governance telemetry alongside the response.

---

## Environment Variables

See [`backend/.env.example`](backend/.env.example) for the full reference.

**Minimum required for real inference:**

```bash
SECRET_KEY=<openssl rand -hex 32>
OPENROUTER_API_KEY=<your key>    # free tier at openrouter.ai
```

**Optional providers:**

```bash
ANTHROPIC_API_KEY=               # Claude Sonnet / Opus
OPENAI_API_KEY=                  # GPT-4o / GPT-4o Mini
PERPLEXITY_API_KEY=              # Web-grounded research
```

When a key is not configured, Aegis falls back to free-tier OpenRouter models. No functionality is broken — only the specific provider is unavailable.

---

## API Reference

| Endpoint | Auth | Description |
|---|---|---|
| `POST /auth/login` | — | Password login, returns JWT |
| `POST /auth/magic-link` | — | Email magic link |
| `POST /chat` | JWT | Governed inference (blocking) |
| `POST /chat/stream` | JWT | Governed inference (SSE streaming) |
| `POST /research` | JWT | Web-grounded research |
| `GET /governance/activity` | JWT | Real-time activity feed |
| `GET /governance/stream` | `?token=` | SSE governance event stream |
| `GET /governance/audit` | Admin | Audit log explorer |
| `GET /status` | — | Public system status |
| `GET /health` | — | Liveness probe |

---

## Governance Philosophy

**Policy before inference.** Every AI request passes through the governance engine before any data leaves your infrastructure. The engine is deterministic — you can read the code and understand exactly what will be blocked.

**Immutable audit trail.** Every request creates an `AuditLog` record. These records cannot be modified. The governance control plane shows real data from real requests.

**Provider abstraction.** Users select "Governed Free Model" — not Llama or GPT. The infrastructure layer manages provider selection, fallback, and routing. This makes provider switching transparent.

**Self-hosted first.** Aegis Lite runs entirely on your infrastructure. No data leaves your environment unless you explicitly route to external AI providers. When external providers are used, Aegis enforces data classification rules before dispatch.

---

## Roadmap

| Feature | Status |
|---|---|
| Streaming governed inference | ✅ Shipped |
| File attachment governance | ✅ Shipped |
| Voice input (transcription) | ✅ Shipped |
| Live SSE governance feed | ✅ Shipped |
| Policy engine test suite | 🚧 In progress |
| Docker Compose production setup | 🚧 In progress |
| Agent orchestration (multi-step) | 📋 Planned |
| Governed vector search / RAG | 📋 Planned |
| Image/document OCR governance | 📋 Planned |
| SCIM provisioning | 📋 Planned |
| SAML/OIDC SSO | 📋 Planned |
| Webhook governance events | 📋 Planned |

---

## Contributing

Issues, pull requests, and feedback are welcome.

```bash
# Run backend tests
cd backend
pytest tests/ -v

# Format
ruff format .
ruff check .
```

See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

---

## License

Apache 2.0 — see [LICENSE](LICENSE).

---

<div align="center">

Built by [Jesse Boudreau](https://github.com/jesseboudreau80) · Extracted from the enterprise Aegis AI governance platform

[Live Demo](https://aegis-lite.jesseboudreau.com) · [Issues](https://github.com/jesseboudreau80/aegis-lite/issues) · [Discussions](https://github.com/jesseboudreau80/aegis-lite/discussions)

</div>
