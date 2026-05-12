# Aegis Lite

**Open-source AI governance and orchestration workspace.**

Aegis Lite gives teams a production-grade platform to control, secure, and observe AI usage — with a deterministic policy engine, multi-model routing, structured audit logging, and a governance dashboard — all self-hostable via Docker.

[![License](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](LICENSE)
[![Python](https://img.shields.io/badge/python-3.11%2B-blue)](https://python.org)
[![Next.js](https://img.shields.io/badge/Next.js-16-black)](https://nextjs.org)

---

## What's included

| Feature | Description |
|---|---|
| **Multi-model LLM gateway** | Route to Anthropic, OpenAI, or OpenRouter with unified cost tracking |
| **Deterministic policy engine** | PII redaction, secrets scanning, prompt injection defense, data classification |
| **Structured audit log** | Immutable governance event log for every AI request and response |
| **RBAC + budget controls** | Per-role model access, per-user monthly spend limits |
| **Governance dashboard** | Policy decisions, risk flags, execution traces |
| **Agent framework** | Create, version, and execute governed custom agents |
| **Research integration** | Perplexity-powered research with outbound data classification |
| **Usage & cost tracking** | Token counts, cost-per-request, budget burn visualizations |
| **Training gate** | Require users to complete training before AI access is granted |
| **AI System Registry** | Register and govern AI systems in your organization |
| **SQLite default** | Zero-ops local deployment; drop-in PostgreSQL for production |

## What's not included (Enterprise)

- SOC 2 compliance automation
- Infrastructure ecosystem registry
- Governed action approval workflows
- Operator mode with runtime control
- Workspace continuity engine
- Slack/webhook notifications
- Kubernetes deployment manifests

---

## Quickstart

### Docker (recommended)

```bash
git clone https://github.com/jesseboudreau80/aegis-lite.git
cd aegis-lite
cp .env.example .env
# Edit .env and add at least one API key
docker compose up
```

Open [http://localhost:3000](http://localhost:3000) — log in with `admin@example.com`.

## Deploy

- [Deploy on Railway](docs/deploy/RAILWAY.md) — managed PostgreSQL, HTTPS, and separate backend/frontend services.

### Local development

**Backend:**
```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp ../.env.example .env   # edit with your keys
uvicorn main:app --reload --port 8100
```

**Frontend:**
```bash
cd frontend
npm install
npm run dev
```

---

## Configuration

All configuration is via environment variables. Copy `.env.example` to `.env` and fill in:

| Variable | Required | Description |
|---|---|---|
| `SECRET_KEY` | Yes | 32+ char random string (`openssl rand -hex 32`) |
| `ANTHROPIC_API_KEY` | One of these | Enables Claude models |
| `OPENAI_API_KEY` | One of these | Enables GPT-4o models |
| `OPENROUTER_API_KEY` | One of these | Enables Mistral, Llama, Gemini, Kimi |
| `PERPLEXITY_API_KEY` | Optional | Enables Research page |
| `DATABASE_URL` | Optional | Defaults to SQLite; set PostgreSQL URL for production |
| `AEGIS_EDITION` | Optional | Defaults to `lite` |

---

## Architecture

```
┌─────────────────────────────────────────────────┐
│                  Next.js Frontend                │
│  Chat · Dashboard · Agents · Governance · Audit  │
└────────────────────┬────────────────────────────┘
                     │ /api proxy
┌────────────────────▼────────────────────────────┐
│                 FastAPI Backend                  │
│                                                  │
│  ┌──────────────┐  ┌──────────────┐             │
│  │ Policy Engine│  │ AI Router    │             │
│  │ (Phase 1)    │  │ + Routing    │             │
│  └──────┬───────┘  └──────┬───────┘             │
│         │                 │                      │
│  ┌──────▼─────────────────▼───────┐             │
│  │         Audit Log              │             │
│  └────────────────────────────────┘             │
└─────────────────────────────────────────────────┘
         │              │              │
    Anthropic        OpenAI      OpenRouter
```

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for the full design.

---

## Policy Engine

The policy engine is the core OSS differentiator. It evaluates every request deterministically before it reaches a model:

1. **Data classification** — auto-detects confidential/restricted content
2. **PII detection & redaction** — emails, phone numbers, SSNs, credit cards
3. **Secrets scanning** — API keys, passwords, private keys (hard block)
4. **Prompt injection defense** — jailbreak pattern detection
5. **Model access control** — per-role allowlists, department blocklists
6. **Budget enforcement** — blocks when monthly spend limit is reached

See [docs/POLICY_ENGINE.md](docs/POLICY_ENGINE.md) for the full rule taxonomy.

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). All contributions are welcome.

## Security

See [SECURITY.md](SECURITY.md) for the vulnerability disclosure process.

## License

Apache License 2.0 — see [LICENSE](LICENSE).
