from datetime import datetime, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from models import AuditLog, User
from routes.auth import get_current_user, require_admin

router = APIRouter(prefix="/usage", tags=["usage"])


@router.get("")
async def get_usage(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(
            AuditLog.model,
            func.count(AuditLog.id).label("request_count"),
            func.sum(AuditLog.estimated_cost).label("total_cost"),
            func.sum(AuditLog.estimated_input_tokens).label("total_input_tokens"),
            func.sum(AuditLog.estimated_output_tokens).label("total_output_tokens"),
        )
        .where(AuditLog.user_id == user.id)
        .group_by(AuditLog.model)
    )
    rows = result.all()

    pct = (
        (user.current_usage_usd / user.monthly_budget_usd * 100)
        if user.monthly_budget_usd > 0 else 0
    )

    return {
        "user": {
            "id":    user.id,
            "name":  user.name,
            "email": user.email,
            "role":  user.role,
        },
        "budget": {
            "monthly_budget_usd": user.monthly_budget_usd,
            "current_usage_usd":  round(user.current_usage_usd, 6),
            "remaining_usd":      round(max(0, user.monthly_budget_usd - user.current_usage_usd), 6),
            "percentage_used":    round(pct, 2),
        },
        "usage_by_model": [
            {
                "model":              row.model,
                "request_count":      row.request_count,
                "total_cost_usd":     round(float(row.total_cost or 0), 6),
                "total_input_tokens": int(row.total_input_tokens or 0),
                "total_output_tokens":int(row.total_output_tokens or 0),
            }
            for row in rows
        ],
    }


@router.get("/admin")
async def get_admin_usage(
    _: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
    days: Optional[int] = Query(None, ge=1),
    user_id: Optional[str] = Query(None),
    model: Optional[str] = Query(None),
):
    """Admin-only: aggregate usage across all users."""
    filters = []
    if days:
        cutoff = datetime.utcnow() - timedelta(days=days)
        filters.append(AuditLog.timestamp >= cutoff)
    if user_id:
        filters.append(AuditLog.user_id == user_id)
    if model:
        filters.append(AuditLog.model == model)

    totals = (await db.execute(
        select(
            func.count(AuditLog.id).label("total_requests"),
            func.coalesce(func.sum(AuditLog.estimated_cost), 0).label("total_cost"),
        ).where(*filters)
    )).one()

    top_users = (await db.execute(
        select(AuditLog.user_id, User.name, User.email, func.count(AuditLog.id).label("request_count"))
        .join(User, User.id == AuditLog.user_id)
        .where(*filters)
        .group_by(AuditLog.user_id, User.name, User.email)
        .order_by(func.count(AuditLog.id).desc())
        .limit(10)
    )).all()

    top_models = (await db.execute(
        select(AuditLog.model, func.count(AuditLog.id).label("request_count"))
        .where(*filters)
        .group_by(AuditLog.model)
        .order_by(func.count(AuditLog.id).desc())
        .limit(10)
    )).all()

    return {
        "total_requests": totals.total_requests,
        "total_cost":     round(float(totals.total_cost), 6),
        "top_users": [
            {"user_id": r.user_id, "name": r.name, "email": r.email, "request_count": r.request_count}
            for r in top_users
        ],
        "top_models": [
            {"model": r.model, "request_count": r.request_count}
            for r in top_models
        ],
    }
