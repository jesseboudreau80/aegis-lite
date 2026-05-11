from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from models import AuditLog, User
from routes.auth import get_current_user

router = APIRouter(prefix="/audit-logs", tags=["audit"])


@router.get("")
async def get_audit_logs(
    page: int = Query(1, ge=1),
    per_page: int = Query(50, ge=1, le=100),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    q = select(AuditLog).order_by(AuditLog.timestamp.desc())
    if user.role != "admin":
        q = q.where(AuditLog.user_id == user.id)
    q = q.offset((page - 1) * per_page).limit(per_page)
    result = await db.execute(q)
    logs = result.scalars().all()

    return [
        {
            "id":               log.id,
            "user_id":          log.user_id,
            "timestamp":        log.timestamp.isoformat(),
            "model":            log.model,
            "prompt_preview":   (log.prompt or "")[:150],
            "response_preview": (log.response or "")[:150],
            "input_tokens":     log.estimated_input_tokens,
            "output_tokens":    log.estimated_output_tokens,
            "estimated_cost":   round(log.estimated_cost or 0, 8),
            "policy_decision":  log.policy_decision,
            "status":           log.status,
        }
        for log in logs
    ]
