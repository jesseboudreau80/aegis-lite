# Roadmap

This document outlines the planned direction for Aegis Lite. Priorities shift based on community feedback — open an issue or discussion to advocate for specific items.

Items marked **[community]** are high-value areas where PRs are especially welcome.

---

## v1.0 — Core Foundation ✅ *Released*

The initial public release. Establishes the governance substrate that all future work builds on.

- [x] Deterministic policy engine (Phase 1 — 10 rule chain)
- [x] PII detection and redaction (email, phone, SSN, credit card)
- [x] Secrets scanning and hard block (9 credential patterns)
- [x] Prompt injection defense (21 pattern classes)
- [x] Data classification with provider enforcement
- [x] Multi-model routing (Anthropic, OpenAI, OpenRouter, Perplexity)
- [x] Budget-aware model fallback
- [x] Structured audit log with rule traces
- [x] GovernanceEvent log with policy versioning
- [x] RBAC with role-based model access
- [x] Agent framework (builtin + user_created)
- [x] AI System Registry
- [x] Research integration with outbound classification
- [x] Training gate
- [x] Magic-link + password JWT authentication
- [x] Governance dashboard with audit explorer
- [x] Usage and cost tracking
- [ ] Docker Compose deployment
- [x] SQLite default, PostgreSQL-ready

---

## v1.1 — Stability & Observability *Current focus*

Hardening, test coverage, and making the deployment story solid.

- [ ] **[community]** Policy engine unit test suite (see issue #1)
- [ ] **[community]** AI router integration tests with mock providers (see issue #10)
- [ ] **[community]** IP-based rate limiting for auth endpoints (see issue #4)
- [ ] Backend CI passing on Python 3.11 and 3.12
- [ ] Frontend CI type-check and build passing
- [ ] Prometheus `/metrics` endpoint for operational monitoring (see issue #12)
- [ ] **[community]** Docker Compose profiles (`dev`, `prod`, `full`) (see issue #15)
- [ ] Dependency audit baseline (pip-audit + npm audit)
- [ ] Read-only policy config API endpoint (see issue #13)
- [ ] **[community]** IBAN PII detection rule (see issue #2)

---

## v1.2 — Dashboard & UX *Q3 2026*

Making the governance dashboard genuinely useful as an operational tool.

- [ ] **[community]** Audit event detail modal with rule trace visualization (see issue #3)
- [ ] Real-time governance event stream (WebSocket or polling) (see issue #6)
- [ ] **[community]** User management UI for admins (see issue #14)
- [ ] Governance report export (JSON + CSV) (see issue #9)
- [ ] Policy config live viewer in dashboard (see issue #13)
- [ ] **[community]** Mobile-responsive navigation and layouts (see issue #7)
- [ ] Dark/light theme toggle
- [ ] Risk score trend visualization (7/30/90 day sparklines)
- [ ] Per-model usage charts with time axis

---

## v1.3 — AI Provider Ecosystem *Q4 2026*

Expanding the provider surface and making routing more intelligent.

- [ ] **[community]** Additional OpenRouter free-tier models (see issue #11)
- [ ] Anthropic Claude Haiku model support
- [ ] Google Vertex AI provider adapter
- [ ] Azure OpenAI provider adapter
- [ ] Cohere provider adapter
- [ ] Provider latency tracking (95th percentile per model)
- [ ] Provider health monitoring (per-model error rate, timeout rate)
- [ ] Automatic provider failover (circuit breaker pattern)
- [ ] Model recommendation endpoint (given a prompt, suggest the right model tier)

---

## v1.4 — Notifications & Integrations *Q1 2027*

Connecting governance events to existing operational workflows.

- [ ] Webhook notifications for policy blocks and escalations
- [ ] Configurable notification channels (webhook, email, Slack-compatible)
- [ ] Event severity routing (critical → webhook, info → log only)
- [ ] SIEM export format (CEF/LEEF for Splunk/QRadar compatibility)
- [ ] Scheduled governance summary reports (daily/weekly email or webhook)
- [ ] API key authentication as alternative to JWT (for machine-to-machine use)

---

## v2.0 — Phase 2 Policy Engine *H1 2027*

Adding AI-assisted evaluation on top of the deterministic Phase 1 layer.

- [ ] Phase 2 evaluator: LLM-assisted policy assessment (gpt4o_mini for cost efficiency)
- [ ] Structured Phase 2 scoring: content quality, policy alignment, tone enforcement
- [ ] Phase 2 results merged with Phase 1 — never lower Phase 1 risk score
- [ ] Configurable Phase 2 model and system prompt
- [ ] Phase 2 evaluation cost tracked separately in audit log
- [ ] A/B testing framework for evaluating Phase 2 model configurations
- [ ] Human review queue for Phase 2 escalations

---

## v2.1 — Plugin Ecosystem *H2 2027*

Making Aegis Lite the governance substrate for other tools.

- [ ] Provider plugin interface (add new AI providers without touching core)
- [ ] Policy rule plugin interface (ship rules as external packages)
- [ ] Storage backend plugin (route audit events to S3, BigQuery, etc.)
- [ ] Auth provider plugin (SAML, OIDC, LDAP)
- [ ] SDK for embedding Aegis policy enforcement in other Python applications
- [ ] TypeScript SDK for frontend integration

---

## Enterprise Tier *(not open source)*

Features built on top of the OSS core for enterprise deployments:

| Feature | Description |
|---------|-------------|
| SOC 2 control mapping | Auto-maps governance events to SOC 2 controls |
| Compliance posture dashboard | Control coverage, evidence, audit readiness |
| Governed action approvals | Human-in-the-loop approval for high-risk AI actions |
| Infrastructure ecosystem registry | App registry, health monitoring, topology |
| Operator mode | Runtime control, service management, workspace continuity |
| Multi-tenant isolation | Org-level data separation with tenant-scoped policies |
| Kubernetes manifests | Helm chart, horizontal pod autoscaler |
| Managed cloud deployment | Hosted Aegis Lite with SLA |
| Premium support | Direct access to maintainers |

---

## What drives prioritization

1. **Security issues** — addressed in any release, no wait
2. **Breaking bugs** — fixed in patch releases
3. **Items with community PRs** — moved up when a contributor is actively working on them
4. **Issues with many 👍 reactions** — taken as signal of community demand

To influence the roadmap: react to existing issues, open new ones, or comment in [Discussions](https://github.com/jesseboudreau80/aegis-lite/discussions).
