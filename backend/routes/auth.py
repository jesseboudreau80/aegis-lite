"""FastAPI auth dependencies used by all protected routes."""
from __future__ import annotations

import logging
import uuid
from datetime import datetime
from typing import Optional

from fastapi import Depends, Header, HTTPException, Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from models import User

logger = logging.getLogger(__name__)


async def get_current_user(
    request: Request,
    x_user_email: Optional[str] = Header(None),
    db: AsyncSession = Depends(get_db),
) -> User:
    """Resolve calling user from JWT state or X-User-Email header."""
    email: Optional[str] = getattr(request.state, "jwt_email", None)

    if not email and x_user_email:
        from config.settings import settings
        if settings.local_dev:
            email = x_user_email
        else:
            logger.warning("X-User-Email header rejected (LOCAL_DEV=false): %s", x_user_email)

    if not email:
        raise HTTPException(status_code=401, detail="Authentication required.")

    result = await db.execute(
        select(User).where(User.email == email, User.is_active == True)  # noqa: E712
    )
    user = result.scalar_one_or_none()

    if not user:
        from services.auth_service import get_demo_profile
        profile = get_demo_profile(email)
        if profile:
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
        else:
            raise HTTPException(status_code=401, detail="User not found or inactive.")

    return user


async def require_training(user: User = Depends(get_current_user)) -> User:
    if not user.training_completed:
        raise HTTPException(status_code=403, detail="Training not completed.")
    return user


async def require_admin(user: User = Depends(get_current_user)) -> User:
    if user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required.")
    return user
