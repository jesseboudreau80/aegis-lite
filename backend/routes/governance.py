"""
Governance Dashboard API.

GET /governance/summary      — aggregate policy metrics
GET /governance/events       — filtered, paginated governance event log
GET /governance/audit        — audit explorer (paginated)
GET /governance/audit/{id}   — single event detail
GET /governance/activity     — real-time activity feed (any authenticated user)
GET /governance/stream       — SSE push stream of governance events
"""
import asyncio
import json
import logging
from collections import Counter
from datetime import datetime, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db, AsyncSessionLocal
from models import AuditLog, GovernanceEvent, User
from routes.auth import get_current_user, require_admin

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/governance", tags=["governance"])


@router.get("/summary")
async def get_governance_summary(
    days: int = Query(30, ge=1, le=365),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
):
    since = datetime.utcnow() - timedelta(days=days)
    result = await db.execute(
        select(GovernanceEvent)
        .where(GovernanceEvent.event_type == "policy_decision", GovernanceEvent.timestamp >= since)
        .order_by(GovernanceEvent.timestamp.desc())
        .limit(5000)
    )
    events = result.scalars().all()

    blocked = escalated = modified = 0
    risk_scores: list[float] = []
    all_flags: list[str] = []
    model_counts: Counter = Counter()

    for e in events:
        p = e.payload or {}
        decision = p.get("decision", "allow")
        if decision == "block":
            blocked += 1
        elif decision == "escalate":
            escalated += 1
        elif decision in ("modify", "warn"):
            modified += 1
        risk_scores.append(float(p.get("risk_score", 0.0)))
        all_flags.extend(p.get("flags", []))
        model_counts[p.get("model_requested", "unknown")] += 1

    total = len(events)
    avg_risk = round(sum(risk_scores) / len(risk_scores), 4) if risk_scores else 0.0
    top_flags = Counter(all_flags).most_common(10)

    return {
        "window_days":          days,
        "total_flagged_events": total,
        "blocked":              blocked,
        "escalated":            escalated,
        "modified_or_warned":   modified,
        "avg_risk_score":       avg_risk,
        "top_flags":            [{"flag": f, "count": c} for f, c in top_flags],
        "model_distribution":   dict(model_counts.most_common(10)),
    }


@router.get("/events")
async def get_governance_events(
    page: int = Query(1, ge=1),
    limit: int = Query(25, ge=1, le=100),
    event_type: Optional[str] = Query(None),
    severity: Optional[str] = Query(None),
    days: int = Query(30, ge=1, le=365),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
):
    since = datetime.utcnow() - timedelta(days=days)
    q = (
        select(GovernanceEvent)
        .where(GovernanceEvent.timestamp >= since)
        .order_by(GovernanceEvent.timestamp.desc())
    )
    if event_type:
        q = q.where(GovernanceEvent.event_type == event_type)
    if severity:
        q = q.where(GovernanceEvent.severity == severity)

    total = (await db.execute(select(func.count()).select_from(q.subquery()))).scalar_one()
    q = q.offset((page - 1) * limit).limit(limit)
    result = await db.execute(q)
    events = result.scalars().all()

    return {
        "total": total,
        "page":  page,
        "limit": limit,
        "events": [
            {
                "id":          e.id,
                "timestamp":   e.timestamp.isoformat(),
                "event_type":  e.event_type,
                "actor_email": e.actor_email,
                "severity":    e.severity,
                "payload":     e.payload,
            }
            for e in events
        ],
    }


@router.get("/audit")
async def get_audit_explorer(
    page:     int   = Query(1, ge=1),
    limit:    int   = Query(25, ge=1, le=100),
    model:    Optional[str] = Query(None),
    decision: Optional[str] = Query(None),
    search:   Optional[str] = Query(None),
    days:     int   = Query(30, ge=1, le=365),
    db:       AsyncSession = Depends(get_db),
    _:        User = Depends(require_admin),
):
    since = datetime.utcnow() - timedelta(days=days)
    q = (
        select(AuditLog, User.email)
        .join(User, User.id == AuditLog.user_id)
        .where(AuditLog.timestamp >= since)
        .order_by(AuditLog.timestamp.desc())
    )
    if model:
        q = q.where(AuditLog.model == model)
    if search:
        q = q.where(AuditLog.prompt.ilike(f"%{search}%"))
    if decision:
        q = q.where(AuditLog.policy_decision == decision)

    total = (await db.execute(select(func.count()).select_from(q.subquery()))).scalar_one()
    q = q.offset((page - 1) * limit).limit(limit)
    rows = (await db.execute(q)).all()

    return {
        "total": total, "page": page, "limit": limit,
        "results": [
            {
                "id":        log.id,
                "timestamp": log.timestamp.isoformat(),
                "user":      email,
                "model":     log.model,
                "decision":  log.policy_decision or "allow",
                "prompt":    (log.prompt or "")[:200],
                "cost":      round(log.estimated_cost or 0, 6),
                "tokens_in": log.estimated_input_tokens,
                "tokens_out":log.estimated_output_tokens,
                "status":    log.status,
            }
            for log, email in rows
        ],
    }


@router.get("/audit/{event_id}")
async def get_audit_detail(
    event_id: str,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
):
    from fastapi import HTTPException
    log_result = await db.execute(select(AuditLog).where(AuditLog.id == event_id))
    log = log_result.scalar_one_or_none()
    if not log:
        raise HTTPException(status_code=404, detail="Audit event not found.")

    ge_result = await db.execute(
        select(GovernanceEvent)
        .where(GovernanceEvent.actor_id == log.user_id, GovernanceEvent.event_type == "policy_decision")
        .order_by(GovernanceEvent.timestamp.desc())
        .limit(1)
    )
    ge = ge_result.scalar_one_or_none()

    p = ge.payload or {} if ge else {}
    return {
        "id":           log.id,
        "timestamp":    log.timestamp.isoformat(),
        "model":        log.model,
        "decision":     log.policy_decision or "allow",
        "risk_score":   float(p.get("risk_score", 0.0)),
        "flags":        p.get("flags", []),
        "prompt_full":  log.prompt,
        "response_full":log.response,
        "rule_trace":   p.get("rule_trace", []),
        "tokens_in":    log.estimated_input_tokens,
        "tokens_out":   log.estimated_output_tokens,
        "cost":         round(log.estimated_cost or 0, 6),
        "status":       log.status,
    }


@router.get("/health")
async def policy_engine_health(_: User = Depends(require_admin)):
    """Verify the policy engine is operational."""
    from services.policy_engine import policy_engine, build_policy_context
    from config.policy_config import POLICY_VERSION
    from fastapi import HTTPException

    class _FakeUser:
        id = "health-check"
        role = "admin"
        email = "health@check.internal"
        department = None

    try:
        ctx = build_policy_context(user=_FakeUser(), model="claude_sonnet", prompt="Hello", source="chat")
        decision = await policy_engine.evaluate_request(ctx)
        return {"status": "ok", "policy_version": POLICY_VERSION, "engine_decision": decision.decision}
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"Policy engine error: {exc}")


# ── Real-time governance activity feed ────────────────────────────────────────


def _format_audit_event(log: AuditLog, actor_email: str) -> dict:
    """Convert an AuditLog row into a standardised activity event."""
    decision  = log.policy_decision or "allow"
    tok       = (log.estimated_input_tokens or 0) + (log.estimated_output_tokens or 0)
    cost      = round(log.estimated_cost or 0, 8)
    request_id = log.id[:8]
    runtime   = log.model or "unknown"

    severity_map = {
        "allow":    "info",
        "modify":   "info",
        "warn":     "warning",
        "escalate": "warning",
        "block":    "critical",
    }

    return {
        "id":           log.id,
        "request_id":   request_id,
        "timestamp":    log.timestamp.isoformat() + "Z",
        "actor":        actor_email,
        "decision":     decision,
        "runtime":      runtime,
        "cost_usd":     cost,
        "token_count":  tok,
        "tokens_in":    log.estimated_input_tokens,
        "tokens_out":   log.estimated_output_tokens,
        "event_type":   log.event_type or "chat",
        "status":       log.status,
        "severity":     severity_map.get(decision, "info"),
    }


@router.get("/activity")
async def get_governance_activity(
    limit: int = Query(20, ge=1, le=50),
    since: Optional[str] = Query(None, description="ISO timestamp — return only events after this time"),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Real-time governance activity feed.

    Available to any authenticated user. Admins see all workspace activity;
    regular users see their own activity only.
    """
    q = (
        select(AuditLog, User.email)
        .join(User, User.id == AuditLog.user_id, isouter=True)
        .order_by(AuditLog.timestamp.desc())
    )

    if user.role != "admin":
        q = q.where(AuditLog.user_id == user.id)

    if since:
        try:
            since_dt = datetime.fromisoformat(since.rstrip("Z"))
            q = q.where(AuditLog.timestamp > since_dt)
        except ValueError:
            pass

    rows = (await db.execute(q.limit(limit))).all()

    events = [_format_audit_event(log, email or "unknown") for log, email in rows]

    return {
        "events": events,
        "count":  len(events),
        "real":   True,
    }


@router.get("/stream")
async def governance_stream(
    token: str = Query(..., description="JWT — required because EventSource cannot set headers"),
    db: AsyncSession = Depends(get_db),
):
    """SSE push stream of real governance events.

    Accepts JWT via ?token= query param because the browser EventSource API
    cannot set Authorization headers. Poll interval: 4 seconds. Keepalive: 8s.
    """
    from services.auth_service import decode_access_token

    payload = decode_access_token(token)
    if not payload:
        async def _unauth():
            yield 'data: {"error":"unauthorized"}\n\n'
        return StreamingResponse(_unauth(), media_type="text/event-stream")

    email = payload.get("sub")
    user_result = await db.execute(select(User).where(User.email == email, User.is_active == True))  # noqa
    stream_user = user_result.scalar_one_or_none()
    if not stream_user:
        async def _nouser():
            yield 'data: {"error":"user_not_found"}\n\n'
        return StreamingResponse(_nouser(), media_type="text/event-stream")

    is_admin     = stream_user.role == "admin"
    user_id      = stream_user.id
    last_ts      = datetime.utcnow()
    keepalive_n  = 0

    async def _event_stream():
        nonlocal last_ts, keepalive_n
        while True:
            try:
                async with AsyncSessionLocal() as session:
                    q = (
                        select(AuditLog, User.email)
                        .join(User, User.id == AuditLog.user_id, isouter=True)
                        .where(AuditLog.timestamp > last_ts)
                        .order_by(AuditLog.timestamp.asc())
                        .limit(10)
                    )
                    if not is_admin:
                        q = q.where(AuditLog.user_id == user_id)
                    rows = (await session.execute(q)).all()

                if rows:
                    for log, actor_email in rows:
                        last_ts = log.timestamp
                        event_data = _format_audit_event(log, actor_email or "unknown")
                        yield f"data: {json.dumps(event_data)}\n\n"
                    keepalive_n = 0
                else:
                    keepalive_n += 1
                    if keepalive_n >= 2:
                        yield ": keepalive\n\n"
                        keepalive_n = 0

                await asyncio.sleep(4)

            except asyncio.CancelledError:
                break
            except Exception:
                logger.exception("Governance stream error — sleeping 5s")
                await asyncio.sleep(5)

    return StreamingResponse(
        _event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control":   "no-cache",
            "X-Accel-Buffering": "no",
            "Connection":       "keep-alive",
        },
    )
