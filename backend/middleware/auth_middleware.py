"""
Auth middleware — JWT validation and X-User-Email dev bypass.

SECURITY NOTE: X-User-Email bypass is only active when LOCAL_DEV=true.
It must never be enabled in production — set LOCAL_DEV=false (the default).
"""
from __future__ import annotations

import logging

from fastapi import HTTPException, Request
from sqlalchemy import select

from config.settings import settings
from database import AsyncSessionLocal
from models import User
from services.auth_service import decode_access_token

logger = logging.getLogger(__name__)


async def get_current_user(request: Request) -> User:
    """
    Resolve the authenticated user from the request.

    In production: reads Authorization: Bearer <JWT>.
    In local dev (LOCAL_DEV=true only): also accepts X-User-Email header.
    """
    db = request.state.db if hasattr(request.state, "db") else None

    # ── Dev bypass — email header (LOCAL_DEV only) ────────────────────────────
    if settings.local_dev:
        email_header = request.headers.get("X-User-Email")
        if email_header and db:
            result = await db.execute(
                select(User).where(User.email == email_header, User.is_active == True)  # noqa: E712
            )
            user = result.scalar_one_or_none()
            if user:
                return user

    # ── JWT auth ──────────────────────────────────────────────────────────────
    auth_header = request.headers.get("Authorization", "")
    if auth_header.startswith("Bearer "):
        token = auth_header[7:]
        payload = decode_access_token(token)
        if payload:
            email = payload.get("sub", "")
            if email and db:
                result = await db.execute(
                    select(User).where(User.email == email, User.is_active == True)  # noqa: E712
                )
                user = result.scalar_one_or_none()
                if user:
                    return user

    raise HTTPException(status_code=401, detail="Authentication required.")
