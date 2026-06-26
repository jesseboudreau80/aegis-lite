"""
Executive Dashboard API — board-ready org-level AI metrics.

GET /governance/executive   — comprehensive executive summary
"""
from collections import Counter
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from models import AuditLog, KnowledgeAsset, User
from routes.auth import require_admin

router = APIRouter(prefix="/governance", tags=["executive"])


@router.get("/executive")
async def get_executive_summary(
    days: int = Query(30, ge=1, le=365),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
):
    since = datetime.utcnow() - timedelta(days=days)

    # ── Spend and usage ───────────────────────────────────────────────────────
    spend_result = await db.execute(
        select(func.sum(AuditLog.estimated_cost)).where(AuditLog.timestamp >= since)
    )
    total_spend = round(float(spend_result.scalar_one() or 0), 4)

    # ── User adoption ─────────────────────────────────────────────────────────
    total_users_result = await db.execute(
        select(func.count(User.id)).where(User.is_active == True)  # noqa: E712
    )
    total_users = total_users_result.scalar_one()

    active_users_result = await db.execute(
        select(func.count(func.distinct(AuditLog.user_id))).where(AuditLog.timestamp >= since)
    )
    active_users = active_users_result.scalar_one()

    adoption_pct = round((active_users / total_users * 100) if total_users else 0, 1)

    # ── Policy events breakdown ───────────────────────────────────────────────
    policy_rows = (await db.execute(
        select(AuditLog.policy_decision, func.count(AuditLog.id))
        .where(AuditLog.timestamp >= since, AuditLog.policy_decision.isnot(None))
        .group_by(AuditLog.policy_decision)
    )).all()
    policy_breakdown = {row[0]: row[1] for row in policy_rows}

    critical_events = policy_breakdown.get("block", 0)

    # ── Top contributors ──────────────────────────────────────────────────────
    contributor_rows = (await db.execute(
        select(
            User.email,
            User.name,
            func.count(AuditLog.id).label("request_count"),
            func.sum(AuditLog.estimated_cost).label("total_cost"),
        )
        .join(User, User.id == AuditLog.user_id)
        .where(AuditLog.timestamp >= since)
        .group_by(User.id, User.email, User.name)
        .order_by(func.sum(AuditLog.estimated_cost).desc())
        .limit(10)
    )).all()

    top_contributors = [
        {
            "email":         row[0],
            "name":          row[1],
            "request_count": row[2],
            "total_cost":    round(float(row[3] or 0), 4),
        }
        for row in contributor_rows
    ]

    # ── Department utilization ────────────────────────────────────────────────
    dept_rows = (await db.execute(
        select(
            User.department,
            func.count(func.distinct(AuditLog.user_id)).label("active_users"),
            func.count(AuditLog.id).label("request_count"),
            func.sum(AuditLog.estimated_cost).label("total_cost"),
        )
        .join(User, User.id == AuditLog.user_id)
        .where(AuditLog.timestamp >= since, User.department.isnot(None))
        .group_by(User.department)
        .order_by(func.count(AuditLog.id).desc())
    )).all()

    # Also count total users per department for adoption %
    dept_totals_rows = (await db.execute(
        select(User.department, func.count(User.id))
        .where(User.is_active == True, User.department.isnot(None))  # noqa: E712
        .group_by(User.department)
    )).all()
    dept_totals = {row[0]: row[1] for row in dept_totals_rows}

    max_requests = max((row[2] for row in dept_rows), default=1)
    department_utilization = [
        {
            "department":    row[0] or "Unassigned",
            "active_users":  row[1],
            "total_users":   dept_totals.get(row[0], row[1]),
            "request_count": row[2],
            "total_cost":    round(float(row[3] or 0), 4),
            "utilization_pct": round(row[2] / max_requests * 100, 1) if max_requests else 0,
        }
        for row in dept_rows
    ]

    # ── Knowledge assets ──────────────────────────────────────────────────────
    top_assets = (await db.execute(
        select(KnowledgeAsset)
        .where(KnowledgeAsset.status.in_(["published", "approved"]))
        .order_by(KnowledgeAsset.reuse_count.desc())
        .limit(5)
    )).scalars().all()

    top_knowledge = [
        {
            "id":          a.id,
            "title":       a.title,
            "type":        a.type,
            "reuse_count": a.reuse_count,
            "status":      a.status,
            "created_at":  a.created_at.isoformat(),
        }
        for a in top_assets
    ]

    # ── Total request volume ──────────────────────────────────────────────────
    total_requests = (await db.execute(
        select(func.count(AuditLog.id)).where(AuditLog.timestamp >= since)
    )).scalar_one()

    return {
        "window_days":         days,
        "generated_at":        datetime.utcnow().isoformat(),
        "kpis": {
            "adoption_pct":    adoption_pct,
            "active_users":    active_users,
            "total_users":     total_users,
            "total_spend_usd": total_spend,
            "total_requests":  total_requests,
            "critical_events": critical_events,
        },
        "policy_breakdown":    policy_breakdown,
        "top_contributors":    top_contributors,
        "department_utilization": department_utilization,
        "top_knowledge_assets": top_knowledge,
    }
