"""
Authentication endpoints.

POST /auth/magic-link  — request a magic-link login URL
GET  /auth/verify      — exchange magic token for JWT session
POST /auth/login       — password login
GET  /auth/me          — validate a stored JWT and return user info
"""
from __future__ import annotations

import logging
import uuid
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from config.settings import settings
from database import get_db
from models import GovernanceEvent, User
from services.auth_service import (
    check_demo_password,
    clear_login_failures,
    consume_magic_token,
    create_access_token,
    create_magic_token,
    decode_access_token,
    get_demo_profile,
    get_failure_count,
    is_locked_out,
    record_login_failure,
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/auth", tags=["auth"])

_DEFAULT_BASE_URL = "http://localhost:3000"


class MagicLinkRequest(BaseModel):
    email: str
    base_url: Optional[str] = None


class PasswordLoginRequest(BaseModel):
    email: str
    password: str


async def _get_or_provision(email: str, db: AsyncSession) -> Optional[User]:
    result = await db.execute(
        select(User).where(User.email == email, User.is_active == True)  # noqa: E712
    )
    user = result.scalar_one_or_none()
    if user:
        return user
    profile = get_demo_profile(email)
    if not profile:
        return None
    user = User(
        id=str(uuid.uuid4()),
        name=profile.get("name", email.split("@")[0].title()),
        email=email,
        role=profile.get("role", "user"),
        monthly_budget_usd=profile.get("monthly_budget_usd", 20.0),
        training_completed=profile.get("training_completed", True),
        is_active=True,
        created_at=datetime.utcnow(),
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user


async def _log(db, user, email, method, extra=None):
    db.add(GovernanceEvent(
        id=str(uuid.uuid4()),
        timestamp=datetime.utcnow(),
        event_type="auth_event",
        actor_id=user.id if user else None,
        actor_email=email,
        subject_type="auth",
        payload={"method": method, "email": email, "role": user.role if user else None, **(extra or {})},
        severity="info",
    ))
    await db.flush()


def _user_dict(user: User) -> dict:
    return {
        "id":                 user.id,
        "name":               user.name,
        "email":              user.email,
        "role":               user.role,
        "training_completed": user.training_completed,
        "monthly_budget_usd": user.monthly_budget_usd,
        "current_usage_usd":  round(user.current_usage_usd, 6),
    }


@router.post("/magic-link")
async def request_magic_link(req: MagicLinkRequest, db: AsyncSession = Depends(get_db)):
    """Generate a one-time magic-link login URL."""
    email = req.email.lower().strip()
    user = await _get_or_provision(email, db)
    if not user:
        raise HTTPException(status_code=404, detail=f"No account found for {email}.")

    token = create_magic_token(email)
    base_url = (req.base_url or _DEFAULT_BASE_URL).rstrip("/")
    login_url = f"{base_url}/login?token={token}"

    await _log(db, user, email, "magic_link_requested", {"login_url": login_url})
    await db.commit()

    return {
        "status":             "ok",
        "login_url":          login_url,
        "expires_in_minutes": 60,
    }


@router.get("/verify")
async def verify_magic_token(
    token: str = Query(...),
    db: AsyncSession = Depends(get_db),
):
    """Exchange a magic-link token for a JWT session token."""
    email = consume_magic_token(token)
    if not email:
        raise HTTPException(status_code=401, detail="Magic link is invalid or expired.")

    user = await _get_or_provision(email, db)
    if not user:
        raise HTTPException(status_code=404, detail="User account not found.")

    access_token = create_access_token(user.id, user.email, user.role)
    await _log(db, user, email, "magic_link_verified")
    await db.commit()

    return {"access_token": access_token, "token_type": "bearer", "user": _user_dict(user)}


@router.post("/login")
async def password_login(req: PasswordLoginRequest, db: AsyncSession = Depends(get_db)):
    """Password-based login. Enforces lockout after repeated failures."""
    email = req.email.lower().strip()

    if is_locked_out(email):
        raise HTTPException(
            status_code=429,
            detail="Too many failed login attempts. Please try again in 15 minutes.",
        )

    profile = check_demo_password(email, req.password)
    if not profile:
        count = record_login_failure(email)
        locked = is_locked_out(email)
        db.add(GovernanceEvent(
            id=str(uuid.uuid4()),
            timestamp=datetime.utcnow(),
            event_type="auth_failure",
            actor_email=email,
            subject_type="auth",
            payload={"method": "password_login", "email": email, "failure_count": count, "locked_out": locked},
            severity="critical" if locked else "warning",
        ))
        await db.commit()
        raise HTTPException(status_code=401, detail="Invalid email or password.")

    user = await _get_or_provision(email, db)
    if not user:
        raise HTTPException(status_code=500, detail="Account provisioning failed.")

    clear_login_failures(email)
    access_token = create_access_token(user.id, user.email, user.role)
    await _log(db, user, email, "password_login")
    await db.commit()

    return {"access_token": access_token, "token_type": "bearer", "user": _user_dict(user)}


@router.get("/me")
async def validate_jwt(token: str = Query(...), db: AsyncSession = Depends(get_db)):
    """Validate a stored JWT and return current user info."""
    payload = decode_access_token(token)
    if not payload:
        raise HTTPException(status_code=401, detail="Token is invalid or expired.")

    email = payload.get("sub", "")
    result = await db.execute(
        select(User).where(User.email == email, User.is_active == True)  # noqa: E712
    )
    user = result.scalar_one_or_none()

    if not user:
        user = await _get_or_provision(email, db)
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")

    return _user_dict(user)
