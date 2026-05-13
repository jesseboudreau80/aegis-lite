# Contributing to Aegis Lite

Thank you for contributing. Aegis Lite is an open-source AI governance platform and the community shapes what it becomes. This guide covers everything needed to contribute effectively.

---

## Quick start

```bash
git clone https://github.com/jesseboudreau80/aegis-lite.git
cd aegis-lite

# Backend
cd backend
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp ../.env.example .env  # set LOCAL_DEV=true for development
LOCAL_DEV=true uvicorn main:app --reload --port 8107

# Frontend (new terminal)
cd frontend && npm install && npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Sign in with `admin@example.com`.

---

## Where to start

| Want to... | Go here |
|-----------|---------|
| Report a bug | [Bug report template](.github/ISSUE_TEMPLATE/bug_report.md) |
| Propose a feature | [Feature request template](.github/ISSUE_TEMPLATE/feature_request.md) |
| Add a policy rule | [Policy rule request template](.github/ISSUE_TEMPLATE/policy_rule_request.md) |
| Submit a security detection | [Security rule submission](.github/ISSUE_TEMPLATE/security_rule_submission.md) |
| Fix a doc error | [Documentation improvement](.github/ISSUE_TEMPLATE/documentation_improvement.md) |
| Find good first work | [Issues labeled `good-first-issue`](https://github.com/jesseboudreau80/aegis-lite/labels/good-first-issue) |

Starter issues are documented in `docs/github-issues/` with full technical context, acceptance criteria, and implementation hints.

---

## Pull request workflow

1. Fork the repository and create a branch from `main`:
   ```bash
   git checkout -b feat/your-feature-name
   ```

2. Make your changes. Keep each PR focused on one concern.

3. Run the test suite:
   ```bash
   cd backend && LOCAL_DEV=true PYTHONPATH=. pytest tests/
   ```

4. Run the frontend type check:
   ```bash
   cd frontend && npm run build
   ```

5. Open a PR with:
   - A clear title (imperative mood: "Add IBAN detection rule", not "Added")
   - A description explaining **why**, not just what changed
   - Reference to the issue being closed (`Closes #123`)

---

## What makes a good contribution

**Policy engine rules:** The highest-value contribution area. Add constants to `policy_config.py`, the method to `policy_engine.py`, and tests in `tests/`. Include a rationale comment — policy changes should be as traceable as the decisions they govern.

**Frontend improvements:** The governance dashboard, audit explorer, and chat interface all have room for visual and UX polish. Match the existing dark-theme design system (see `globals.css` for utility classes).

**Tests:** The policy engine and AI router have minimal test coverage. Property-based tests and integration tests with mock providers are especially valuable.

**Documentation:** Clear docs lower the barrier for new users and contributors. `docs/AGENT_SYSTEM.md` doesn't exist yet. Deployment guides (Railway, Fly.io) are missing.

**Deployment guides:** Real-world deployment experience from contributors is more valuable than theoretical documentation.

---

## Code conventions

**Python (backend)**
- FastAPI for routes, SQLAlchemy async for DB, Pydantic v2 for validation
- No comments that describe what code does — only why (non-obvious constraints, workarounds)
- All policy constants in `config/policy_config.py`, never inline
- Route handlers should be thin — business logic belongs in services

**TypeScript (frontend)**
- Next.js 15 App Router, TypeScript strict mode
- Tailwind v4 + custom CSS classes from `globals.css` — avoid inline styles where a utility class exists
- No `any` types without a comment explaining why
- Components should handle loading and empty states explicitly

**Git**
- Commit messages: imperative, concise, focused on the why
- One logical change per commit — avoid mixing formatting changes with logic changes
- Never commit `.env`, `*.db`, `*.dump`, or secrets of any kind

---

## Policy rule contributions

Policy rules require special care — they run on every AI request in production.

**When adding a rule:**
1. Add constants to `backend/config/policy_config.py` (never inline in the engine)
2. Add the detection method to `backend/services/policy_engine.py`
3. Call the method in the appropriate evaluation chain
4. Add unit tests with: (a) content that should trigger, (b) content that should not, (c) edge cases
5. Add a comment in `policy_config.py` explaining the threat the rule addresses

**False positive risk:** Every rule that adds `pii_detected` or `sensitive_keywords_detected` will appear in every user's audit log when it fires. Rules that fire too broadly create noise that degrades the signal value of the audit trail.

**Risk delta calibration:**
- `0.10–0.20` — informational flags (data classification hints, agent overrides)
- `0.20–0.35` — PII and sensitive keyword detection
- `0.60–0.80` — high-confidence injection or classification violation
- `0.95–1.0` — hard block (secrets detected, restricted data to external provider)

---

## What belongs in Lite vs. Enterprise

Aegis Lite is the open core. The following are in scope for community contributions:

**In scope:**
- Policy engine rules and detection improvements
- Model provider integrations (new providers via OpenAI-compatible API)
- Governance dashboard visualizations
- Deployment documentation and tooling
- Test coverage
- Authentication improvements (OAuth, SSO stubs)
- API improvements (export, filtering, pagination)

**Out of scope (enterprise tier):**
- SOC 2 control mapping and evidence collection
- Infrastructure ecosystem registry
- Governed action approval workflows
- Cloudflare / tunnel integration
- Kubernetes deployment manifests
- Multi-tenant isolation

If you're unsure, open an issue to discuss before investing time in a PR.

---

## Community

- **Issues:** for bugs, feature requests, and policy rule requests
- **Discussions:** for broader questions, deployment help, and design proposals
- **Security disclosures:** see [SECURITY.md](SECURITY.md) — use private disclosure, not public issues

All community members are expected to follow the [Code of Conduct](CODE_OF_CONDUCT.md).

By contributing, you agree that your contributions will be licensed under the Apache License 2.0.
