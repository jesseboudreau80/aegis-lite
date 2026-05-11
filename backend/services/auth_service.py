"""
Auth Service — JWT lifecycle, magic-link tokens, demo credential validation.

Magic tokens use in-memory storage (sufficient for single-instance deployments).
For multi-process deployments, swap _magic_store for Redis.
"""
from __future__ import annotations

import logging
import secrets
from datetime import datetime, timedelta, timezone
from typing import Optional

import jwt

logger = logging.getLogger(__name__)

_ALGORITHM = "HS256"
_ACCESS_TOKEN_HOURS = 24
_MAGIC_LINK_MINUTES = 60
_MAX_FAILURES = 5
_LOCKOUT_MINUTES = 15


def _secret() -> str:
    from config.settings import settings
    return settings.secret_key


_magic_store: dict[str, dict] = {}
_failed_logins: dict[str, dict] = {}

# Demo account profiles — passwords come from settings (env vars), never from source code.
# Customize or remove these for your deployment.
DEMO_PROFILES: dict[str, dict] = {
    "admin@example.com": {
        "name":               "Admin User",
        "role":               "admin",
        "training_completed": True,
        "monthly_budget_usd": 100.0,
    },
    "demo@example.com": {
        "name":               "Demo User",
        "role":               "user",
        "training_completed": True,
        "monthly_budget_usd": 20.0,
    },
}


def create_access_token(user_id: str, email: str, role: str) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "sub":     email,
        "user_id": user_id,
        "role":    role,
        "iat":     now,
        "exp":     now + timedelta(hours=_ACCESS_TOKEN_HOURS),
    }
    return jwt.encode(payload, _secret(), algorithm=_ALGORITHM)


def decode_access_token(token: str) -> Optional[dict]:
    try:
        return jwt.decode(token, _secret(), algorithms=[_ALGORITHM])
    except jwt.PyJWTError as exc:
        logger.debug("jwt decode failed: %s", exc)
        return None


def create_magic_token(email: str) -> str:
    token = secrets.token_urlsafe(32)
    expiry = datetime.now(timezone.utc) + timedelta(minutes=_MAGIC_LINK_MINUTES)
    _magic_store[token] = {"email": email, "expires_at": expiry, "used": False}
    return token


def consume_magic_token(token: str) -> Optional[str]:
    entry = _magic_store.get(token)
    if not entry or entry["used"] or datetime.now(timezone.utc) > entry["expires_at"]:
        _magic_store.pop(token, None)
        return None
    entry["used"] = True
    return entry["email"]


def get_demo_profile(email: str) -> Optional[dict]:
    return DEMO_PROFILES.get(email.lower().strip())


def check_demo_password(email: str, password: str) -> Optional[dict]:
    from config.settings import settings
    profile = DEMO_PROFILES.get(email.lower().strip())
    if not profile:
        return None
    demo_password = getattr(settings, "demo_password", "") or "demo"
    if password == demo_password:
        return profile
    return None


def is_locked_out(email: str) -> bool:
    entry = _failed_logins.get(email)
    if not entry:
        return False
    if "locked_until" in entry:
        if datetime.now(timezone.utc) < entry["locked_until"]:
            return True
        _failed_logins.pop(email, None)
    return False


def record_login_failure(email: str) -> int:
    now = datetime.now(timezone.utc)
    entry = _failed_logins.setdefault(email, {"count": 0, "first_failure": now})
    entry["count"] += 1
    if entry["count"] >= _MAX_FAILURES:
        entry["locked_until"] = now + timedelta(minutes=_LOCKOUT_MINUTES)
    return entry["count"]


def clear_login_failures(email: str) -> None:
    _failed_logins.pop(email, None)


def get_failure_count(email: str) -> int:
    return _failed_logins.get(email, {}).get("count", 0)
