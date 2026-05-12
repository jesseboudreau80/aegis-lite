# Issue: Add IP-based rate limiting for unauthenticated auth endpoints

**Labels:** `enhancement` · `backend` · `security`

## Description

The `/auth/magic-link` and `/auth/login` endpoints have per-email lockout (after 5 failures) but no IP-based rate limiting for unauthenticated requests. This allows an attacker to enumerate valid email addresses or attempt credential stuffing from a single IP by cycling through email addresses.

## Why this matters

Without IP-level rate limiting:
- An attacker can enumerate valid user emails by cycling through addresses rapidly
- Credential stuffing is possible at high volume from a single IP
- Per-email lockout is bypassable by using different email addresses

## Acceptance criteria

- [ ] Unauthenticated `POST /auth/login` requests are rate-limited to **20 per minute per IP**
- [ ] Unauthenticated `POST /auth/magic-link` requests are rate-limited to **10 per minute per IP**
- [ ] Requests exceeding the limit receive `HTTP 429` with `Retry-After` header
- [ ] Rate limit state is in-memory (consistent with the existing `_failed_logins` dict approach)
- [ ] `LOCAL_DEV=true` bypasses IP rate limiting to avoid friction in development
- [ ] A GovernanceEvent is logged when an IP is rate-limited

## Implementation approach

Add a FastAPI dependency that runs before the auth endpoints:

```python
# backend/services/rate_limiter.py — add:
from datetime import datetime, timedelta
from collections import defaultdict

_ip_counters: dict[str, dict] = defaultdict(lambda: {"count": 0, "window_start": datetime.utcnow()})
_IP_WINDOW_SECONDS = 60

def check_ip_rate_limit(ip: str, limit: int) -> tuple[bool, int]:
    """Returns (allowed, retry_after_seconds)."""
    now = datetime.utcnow()
    entry = _ip_counters[ip]
    if (now - entry["window_start"]).total_seconds() > _IP_WINDOW_SECONDS:
        entry["count"] = 0
        entry["window_start"] = now
    entry["count"] += 1
    if entry["count"] > limit:
        retry_after = _IP_WINDOW_SECONDS - int((now - entry["window_start"]).total_seconds())
        return False, max(1, retry_after)
    return True, 0
```

Then in `auth_routes.py`:

```python
from fastapi import Request
from services.rate_limiter import check_ip_rate_limit

@router.post("/login")
async def password_login(req: PasswordLoginRequest, request: Request, ...):
    if not settings.local_dev:
        ip = request.client.host
        allowed, retry_after = check_ip_rate_limit(ip, limit=20)
        if not allowed:
            raise HTTPException(
                status_code=429,
                headers={"Retry-After": str(retry_after)},
                detail=f"Too many requests from this IP. Try again in {retry_after}s.",
            )
    ...
```

## Notes

- For production multi-instance deployments, this should eventually use Redis. Document this limitation clearly in a code comment.
- The existing per-email `_failed_logins` mechanism remains unchanged — this is additive.

## Suggested files to modify

- `backend/services/rate_limiter.py` — add `check_ip_rate_limit`
- `backend/routes/auth_routes.py` — apply IP limiter to `/login` and `/magic-link`
- `backend/tests/test_auth_routes.py` (create if needed) — test the 429 response
