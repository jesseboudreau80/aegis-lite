# Changelog

All notable changes to Aegis Lite are documented here.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).
Aegis Lite follows [Semantic Versioning](https://semver.org/).

---

## [Unreleased]

### Added
- GitHub Actions CI: backend tests, frontend build, security scan workflows
- `.github/PULL_REQUEST_TEMPLATE.md` with policy engine and security checklists
- 15 detailed starter issues in `docs/github-issues/`
- `scripts/setup_github_labels.sh` — one-command GitHub label creation
- `scripts/create_github_issues.sh` — bulk issue creation from markdown files
- `docs/ROADMAP.md` — versioned roadmap through v2.1 and enterprise tier
- `docs/OPEN_SOURCE_LAUNCH_CHECKLIST.md` — pre-launch verification checklist
- `.github/FUNDING.yml`
- `.github/ISSUE_TEMPLATE/config.yml` — disables blank issues, surfaces security disclosure path

### Changed
- Landing page: animated policy engine visualizer, gradient hero, feature cards with SVG icons
- Login page: split-panel layout with live policy trace preview on the left panel
- Governance dashboard: metric cards with icons, flag bar chart, live event stream section
- Audit explorer: decision filter chips, split detail panel, inline event detail view
- `UsageDashboard`: SVG budget ring gauge, animated progress bars, model cost breakdown
- `AISystemOverview`: status pulse dots, risk badges, empty state with registry link
- Dashboard: quick-links row, governance prompt for admins
- Training: icon steps, gradient step progress bar
- `AppNav`: glassmorphism active state, divider between user/admin sections
- `LogoutButton`: glassmorphism style with backdrop blur
- `globals.css`: complete design system — skeleton shimmer, fade-up animations, badge classes, stat typography, progress tracks, card surfaces, logo-mark, data-table utilities
- `CONTRIBUTING.md`: full rewrite with setup guide, PR workflow, policy contribution standards
- `SECURITY.md`: scope table, hardening checklist, two-layer security model
- `CODE_OF_CONDUCT.md`: Contributor Covenant adapted for project

---

## [1.0.0] — 2026-05-11

Initial public release.

### Added

**Backend**
- FastAPI application with SQLAlchemy async, aiosqlite/asyncpg support
- 15 ORM models: User, Conversation, Message, AuditLog, RateLimitEntry, Agent, AgentVersion, AgentExecution, ResearchSession, ResearchReport, Citation, SupportSession, SupportMessage, SupportRoutingMatrix, SupportRoutingDecision, SupportFeedback, GovernanceEvent, AISystem
- Deterministic policy engine (Phase 1):
  - Secrets detection (9 credential patterns) → hard block
  - PII detection and redaction (email, phone, SSN, credit card)
  - Prompt injection defense (21 pattern classes)
  - Data classification with provider enforcement
  - Role-based model access control with graceful fallback
  - Agent permission enforcement (model allowlist)
  - Tool grant enforcement
  - Research outbound classification blocking
  - Risk behavior controls (system prompt injection, audit level)
- Multi-model AI routing: Anthropic Claude, OpenAI GPT-4o, OpenRouter (Mistral, Llama, Gemini), Perplexity
- Budget-aware routing engine with free-tier fallback
- GovernanceEvent audit log with rule traces and policy versioning
- JWT authentication (HS256, 24h expiry)
- Magic-link login (single-use tokens, 60min expiry)
- Password login with lockout after 5 failures
- RBAC: `admin` and `user` roles
- Per-user monthly budget enforcement
- Daily per-model rate limiting
- Agent framework (builtin and user_created types)
- AI System Registry (risk classification, lifecycle management)
- Perplexity research integration with outbound data classification
- Training gate (required before AI access)
- Support routing assistant with keyword-based department matching
- Usage and cost tracking per user and model
- Edition framework (`AEGIS_EDITION=lite`)
- Demo seed on startup (admin@example.com, demo@example.com, 5 builtin agents)

**Frontend**
- Next.js 15 App Router, TypeScript, Tailwind v4
- Pages: Landing, Login (password + magic-link), Training, Dashboard, Chat, Agents, Research, Governance, Audit, Policies, AI Registry
- JWT session management with 15-minute activity timeout
- Animated policy engine visualizer (landing page)
- Governance dashboard with metric cards and event stream
- Audit explorer with paginated table and detail panel
- Chat with model selector, conversation history, routing info
- Agent runner with builtin and custom agent support
- Usage dashboard with budget ring gauge and model breakdown
- AI System Registry admin UI

**Infrastructure**
- Docker Compose (backend + frontend with health checks)
- Multi-stage Dockerfiles (backend Python slim, frontend Next.js standalone)
- SQLite default, PostgreSQL-ready
- `scripts/start.sh` for local development
- `scripts/seed_demo.py` for manual seeding
- Apache 2.0 license

**Documentation**
- `docs/ARCHITECTURE.md` — system topology and data flow
- `docs/POLICY_ENGINE.md` — rule taxonomy, risk scoring, extension guide
- `docs/SETUP.md` — local and Docker setup guide
- `README.md` — project overview, quickstart, feature table
- `CONTRIBUTING.md` — contribution guide
- `SECURITY.md` — disclosure process and hardening checklist
- `CODE_OF_CONDUCT.md` — Contributor Covenant

[Unreleased]: https://github.com/jesseboudreau80/aegis-lite/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/jesseboudreau80/aegis-lite/releases/tag/v1.0.0
