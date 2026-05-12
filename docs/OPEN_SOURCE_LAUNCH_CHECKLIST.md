# Open Source Launch Checklist

Use this checklist before any public announcement. Each section has an owner and a clear pass/fail criterion.

---

## 1. Secrets & Sensitive Data Review

Run before every push to `main`:

```bash
# Enterprise identifiers — must return ZERO results
grep -rn "dpvet\|dp-vet\|DP Vet\|destpet\|reselleros\|ThriftyClover" . \
  --include="*.py" --include="*.ts" --include="*.tsx" \
  --include="*.md" --include="*.yml" --include="*.sh" \
  --exclude-dir=".git"

# API keys and credentials — must return ZERO results
grep -rn "sk-ant-api\|sk-or-v1-[a-z0-9]\{20\}\|supabase\.co" . \
  --include="*.py" --include="*.ts" --exclude-dir=".git"

# Database files — must return ZERO results
find . -name "*.db" -o -name "*.sqlite" -o -name "*.dump" | grep -v ".git"

# Committed .env files — must return ZERO results
find . -name ".env" ! -name ".env.example" ! -path "./.git/*"
```

- [ ] All checks above return zero results
- [ ] `backend/.env` is in `.gitignore` and not tracked by git
- [ ] No database files present in any git-tracked path
- [ ] `git log --all --oneline` shows no commits with "secret", "password", or "key" in the message

---

## 2. .env.example Quality

- [ ] All required environment variables are present with placeholder values
- [ ] No real values in `.env.example` (placeholders only)
- [ ] `LOCAL_DEV` is documented with a clear warning about production use
- [ ] `SECRET_KEY` has a comment showing how to generate a strong value
- [ ] Database URL shows both SQLite and PostgreSQL variants

---

## 3. Repository Structure

- [ ] `README.md` includes: project overview, quickstart, feature table, architecture diagram reference, contributing link
- [ ] `LICENSE` is present and complete (Apache 2.0)
- [ ] `CONTRIBUTING.md` covers: setup, PR workflow, policy rule standards, scope boundaries
- [ ] `SECURITY.md` covers: disclosure process, scope, hardening checklist
- [ ] `CODE_OF_CONDUCT.md` is present
- [ ] `CHANGELOG.md` or `docs/ROADMAP.md` communicates project direction
- [ ] `.gitignore` covers: `.env`, `*.db`, `*.dump`, `__pycache__`, `.next`, `node_modules`

---

## 4. GitHub Configuration

- [ ] Repository visibility: Public
- [ ] Default branch: `main` (not `develop` or `master`)
- [ ] Branch protection on `main`:
  - [ ] Require pull request before merging
  - [ ] Require at least 1 approving review
  - [ ] Dismiss stale reviews on new push
  - [ ] Require status checks to pass (backend-tests, frontend-build, security-scan)
- [ ] Issue templates configured (`.github/ISSUE_TEMPLATE/config.yml`)
- [ ] PR template configured (`.github/PULL_REQUEST_TEMPLATE.md`)
- [ ] GitHub Actions enabled and workflows passing
- [ ] Labels created: `bash scripts/setup_github_labels.sh`
- [ ] Discussions enabled
- [ ] Wiki disabled (docs live in `/docs` instead)
- [ ] Repository topics set: `ai-governance`, `llm`, `policy-engine`, `audit-log`, `fastapi`, `nextjs`, `open-source`

---

## 5. GitHub Actions / CI

- [ ] `backend-tests.yml` — runs on push to main and develop; passes
- [ ] `frontend-build.yml` — TypeScript check + Next.js build passes
- [ ] `security-scan.yml` — enterprise identifier scan + secret check passes
- [ ] All workflows passing on the current `main` HEAD

Check: `gh run list --repo jesseboudreau80/aegis-lite --limit 10`

---

## 6. Documentation Quality

- [ ] `README.md` Quickstart section tested from scratch (cold clone → running app)
- [ ] `docs/SETUP.md` local dev setup tested on a clean machine (or VM)
- [ ] Docker Compose: `docker compose up` works cold from a fresh clone
- [ ] `docs/ARCHITECTURE.md` accurately reflects current service topology
- [ ] `docs/POLICY_ENGINE.md` rule table matches `policy_config.py` current state
- [ ] Links in README point to real URLs (not placeholder `#`)
- [ ] `AGENT_SYSTEM.md` — exists (or issue #8 is open and linked)

---

## 7. Application Correctness

- [ ] Backend starts without errors: `LOCAL_DEV=true uvicorn main:app --port 8100`
- [ ] `GET /health` returns `{"status": "ok", "edition": "lite"}`
- [ ] Demo login works: `admin@example.com` signs in successfully
- [ ] Chat sends a message and gets a response (demo mode if no API key)
- [ ] Governance dashboard loads without errors (admin user)
- [ ] Audit log shows entries after a chat
- [ ] Docker Compose cold start works: `docker compose up`
- [ ] Policy engine health check passes: `GET /governance/health`

---

## 8. Security Posture

- [ ] `LOCAL_DEV=false` is the hardcoded default in `settings.py`
- [ ] X-User-Email bypass is gated behind `settings.local_dev` check (not just env variable)
- [ ] JWT `SECRET_KEY` weak-secret validator is active (tested: starts with weak key → startup blocked)
- [ ] No endpoints accept unauthenticated write operations except `/auth/*`
- [ ] `SECURITY.md` private disclosure email is valid and monitored
- [ ] Security scan workflow passes in CI

---

## 9. License Verification

- [ ] `LICENSE` file is Apache 2.0 (current year, correct copyright holder)
- [ ] No files contain GPL or AGPL licensed code
- [ ] All third-party libraries in `requirements.txt` and `package.json` have compatible licenses

Quick check:
```bash
cd backend && pip install pip-licenses && pip-licenses --format=table | grep -v "Apache\|MIT\|BSD\|ISC\|Python"
```

---

## 10. Dependency Audit

- [ ] `pip-audit -r backend/requirements.txt` — no HIGH/CRITICAL CVEs
- [ ] `cd frontend && npm audit --audit-level=high` — no high-severity issues
- [ ] Dependency versions are pinned or bounded (not `*` or open-ended ranges)

---

## 11. Screenshots / Media

For GitHub README and social posts:

- [ ] Landing page (full-viewport, light or dark)
- [ ] Policy engine animation (governance dashboard hero)
- [ ] Governance dashboard — metric cards visible
- [ ] Audit explorer — table with decision badges + detail panel
- [ ] Chat page — message thread with model + routing info
- [ ] Login page — split panel

Screenshot tool: browser at 1440×900, DevTools → "Capture screenshot"

---

## 12. Pre-announcement Final Check

Run the full OSS safety suite:

```bash
cd ~/infra/apps/aegis-lite

# Enterprise leak check
bash -c '
  patterns=("dpvet" "destpet" "reselleros" "ThriftyClover" "AegisDemo123" "mizmdmntpfwpjyscvotc")
  for p in "${patterns[@]}"; do
    results=$(grep -rn "$p" . --include="*.py" --include="*.ts" --include="*.tsx" --include="*.md" --exclude-dir=".git" 2>/dev/null)
    [ -n "$results" ] && echo "FAIL: $p found" && echo "$results" || echo "PASS: $p"
  done
'

# Secrets check
grep -rn 'sk-ant-api\|sk-or-v1-[A-Za-z0-9]\{20,\}\|supabase\.co\|ghp_[A-Za-z0-9]\{36\}' . \
  --exclude-dir=".git" --include="*.py" --include="*.ts" --include="*.yml" 2>/dev/null && echo "FAIL: secrets found" || echo "PASS: no secrets"

# DB files
find . \( -name "*.db" -o -name "*.sqlite" -o -name "*.dump" \) ! -path "./.git/*" \
  | grep -q . && echo "FAIL: database files present" || echo "PASS: no database files"
```

All lines must print `PASS` before announcement.

---

## Launch sequence

1. ✅ All checklist items above complete
2. Run: `bash scripts/setup_github_labels.sh`
3. Create initial issues: `bash scripts/create_github_issues.sh --dry-run` → review → run without `--dry-run`
4. Enable GitHub Discussions
5. Publish the LinkedIn post
6. Post to r/selfhosted
7. Post to Hacker News (Show HN)
8. Monitor Issues and Discussions for 48 hours post-launch
