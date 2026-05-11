# Security Policy

## Reporting a vulnerability

Please **do not** open a public GitHub issue for security vulnerabilities.

Email: **jesse.boudreau.dev@gmail.com**

Include:
- A description of the vulnerability
- Steps to reproduce
- Potential impact
- Any suggested fixes (optional)

You will receive an acknowledgement within 48 hours and a resolution timeline within 7 days.

## Scope

The following are in scope:
- Authentication bypass in the JWT or session system
- Policy engine bypass allowing blocked content through
- SQL injection or similar backend vulnerabilities
- Secrets exposed in API responses
- CORS or CSRF vulnerabilities

The following are out of scope:
- Vulnerabilities in third-party AI providers (report to them directly)
- Self-inflicted misconfigurations (e.g. deploying with `LOCAL_DEV=true` in production)
- Denial of service via excessive API calls without rate limiting configured

## Production hardening checklist

Before deploying Aegis Lite to production:

- [ ] Set `SECRET_KEY` to a strong random value (`openssl rand -hex 32`)
- [ ] Set `LOCAL_DEV=false` (default)
- [ ] Use PostgreSQL, not SQLite
- [ ] Put the backend behind a reverse proxy (nginx / Caddy)
- [ ] Enable HTTPS
- [ ] Restrict `CORS_ORIGINS` to your actual frontend domain
- [ ] Rotate all API keys regularly
- [ ] Never commit `.env` to version control
