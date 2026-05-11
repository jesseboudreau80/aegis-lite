import uuid
from datetime import date

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from config.model_costs import MODEL_RATE_LIMITS
from models import RateLimitEntry


async def check_rate_limit(
    db: AsyncSession, user_id: str, model: str
) -> tuple[bool, str, int]:
    """Returns (allowed, error_message, current_daily_count)."""
    today = str(date.today())
    limit_cfg = MODEL_RATE_LIMITS.get(model, {"daily_limit": 200, "warning": False})
    daily_limit = limit_cfg["daily_limit"]

    result = await db.execute(
        select(RateLimitEntry).where(
            RateLimitEntry.user_id == user_id,
            RateLimitEntry.model == model,
            RateLimitEntry.date == today,
        )
    )
    entry = result.scalar_one_or_none()
    current = entry.request_count if entry else 0

    if current >= daily_limit:
        return (
            False,
            f"Daily limit of {daily_limit} requests for {model} reached. Resets tomorrow.",
            current,
        )
    return True, "", current


async def increment_rate_limit(
    db: AsyncSession, user_id: str, model: str
) -> None:
    today = str(date.today())
    result = await db.execute(
        select(RateLimitEntry).where(
            RateLimitEntry.user_id == user_id,
            RateLimitEntry.model == model,
            RateLimitEntry.date == today,
        )
    )
    entry = result.scalar_one_or_none()
    if entry:
        entry.request_count += 1
    else:
        db.add(RateLimitEntry(
            id=str(uuid.uuid4()),
            user_id=user_id,
            model=model,
            date=today,
            request_count=1,
        ))
