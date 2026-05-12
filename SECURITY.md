# Security Policy

## Supported versions

Security updates are applied to the latest version on `main`. Older releases are not patched separately.

| Branch | Supported |
|--------|-----------|
| `main` | ✅ Yes |
| `develop` | Pre-release only |

---

## Reporting a vulnerability

**Please do not open a public GitHub issue for security vulnerabilities.**

Private disclosure: **jesse.boudreau.dev@gmail.com**

Include in your report:
- A description of the vulnerability and its impact
- Steps to reproduce (proof of concept if applicable)
- The affected component (backend route, policy engine, auth middleware, etc.)
- Any suggested mitigations

**Response timeline:**
- Acknowledgement within 48 hours
- Initial assessment within 5 business days
- Fix timeline communicated within 7 business days

We practice coordinated disclosure. We'll work with you on an appropriate timeline before any public disclosure, typically 90 days from initial report.

---

## Scope

**In scope — please report:**

| Category | Examples |
|----------|---------|
| Authentication bypass | JWT forgery, X-User-Email bypass in non-dev mode, session fixation |
| Policy engine bypass | Prompts that should be blocked but reach the model |
| Audit log tampering | Ability to delete or modify governance events |
| Authorization flaws | User escalating to admin, accessing other users' data |
| Injection vulnerabilities | SQL injection, command injection in backend routes |
| Secrets in responses | API responses exposing tokens, keys, or credentials |
| CORS / CSRF | Cross-origin request forgery against authenticated endpoints |

**Out of scope:**
- Vulnerabilities in third-party AI providers (report to them directly)
- Self-inflicted misconfigurations (`LOCAL_DEV=true` in production, weak `SECRET_KEY`)
- Rate limiting exhaustion without proof of harm
- Theoretical vulnerabilities without a working exploit path
- Issues requiring physical access to the server

---

## Production hardening checklist

Before deploying Aegis Lite to a production environment:

**Authentication**
- [ ] `SECRET_KEY` is a strong random value: `openssl rand -hex 32`
- [ ] `LOCAL_DEV=false` (default — never enable in production)
- [ ] Magic-link tokens are single-use and expire in 60 minutes

**Network**
- [ ] Backend is behind a reverse proxy (nginx, Caddy) — never expose uvicorn directly
- [ ] HTTPS enforced — the reverse proxy should redirect HTTP → HTTPS
- [ ] `CORS_ORIGINS` restricted to your actual frontend domain(s)

**Database**
- [ ] PostgreSQL for production (SQLite has no access controls at the file level)
- [ ] Database user has minimum required permissions
- [ ] Backups enabled and tested

**Secrets**
- [ ] `.env` is not committed to version control (verify with `git log --all -- backend/.env`)
- [ ] API keys rotated regularly
- [ ] No secrets in environment variable names or values visible in process listings

**Monitoring**
- [ ] Application logs forwarded to a log aggregator
- [ ] Health endpoint `/health` monitored externally
- [ ] Governance event log reviewed periodically for anomalies

---

## Security model

Aegis Lite's security model has two layers:

**Layer 1 — Platform security:** Authentication (JWT), authorization (RBAC), input validation, rate limiting. Standard web security practices. The `LOCAL_DEV` bypass header (`X-User-Email`) is the most likely misconfiguration risk — it is intentionally disabled by default and should never be enabled in production.

**Layer 2 — AI governance security:** The policy engine. This is not a replacement for Layer 1 — it's an additional control specifically for AI request/response content. The policy engine protects against PII exfiltration, credential leakage, prompt injection, and data classification violations at the AI layer.

Neither layer compensates for the other. A deployment with strong AI governance but weak authentication is still vulnerable to unauthorized access. A deployment with strong authentication but no policy engine has no protection against AI-layer threats.

---

## Dependency scanning

We recommend running `pip audit` (backend) and `npm audit` (frontend) before deploying. Known vulnerable dependencies are tracked in GitHub Dependabot alerts.
