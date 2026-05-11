"""Support assistant routes — keyword-based routing with AI responses."""
import uuid
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from models import SupportFeedback, SupportMessage, SupportRoutingDecision, SupportRoutingMatrix, SupportSession, User
from routes.auth import require_admin, require_training
from services.ai_router import call_model
from services.cost_engine import calculate_cost
from services.policy_engine import PolicyBlockedError, build_policy_context, log_policy_event

router = APIRouter(prefix="/support", tags=["support"])

_SUPPORT_SYSTEM = (
    "You are a helpful support assistant. Help users resolve questions about HR, IT, "
    "Finance, Operations, and Compliance. Answer directly when you can. "
    "Ask one clarifying question when needed. When you cannot resolve an issue, "
    "say: 'I'll route this to [Department] for you.' "
    "Never fabricate company policies. Be empathetic and concise.\n\n"
    "If routing to a department, add on a new line: ROUTE_TO: [Department Name]"
)


class StartSessionRequest(BaseModel):
    message: str


class ChatRequest(BaseModel):
    message: str


class RoutingMatrixEntry(BaseModel):
    department: str
    issue_keywords: list[str]
    issue_categories: list[str]
    contact_email: Optional[str] = None
    contact_name: Optional[str] = None
    priority: int = 5


def _route_from_matrix(text: str, matrix: list) -> Optional[str]:
    """Keyword-based routing — check message against each matrix entry."""
    text_lower = text.lower()
    for entry in sorted(matrix, key=lambda e: e.priority):
        for keyword in entry.issue_keywords:
            if keyword.lower() in text_lower:
                return entry.department
    return None


@router.post("")
async def start_session(
    req: StartSessionRequest,
    user: User = Depends(require_training),
    db: AsyncSession = Depends(get_db),
):
    session = SupportSession(
        id=str(uuid.uuid4()), user_id=user.id, status="open",
        created_at=datetime.utcnow(), updated_at=datetime.utcnow(),
    )
    db.add(session)
    await db.flush()

    db.add(SupportMessage(
        id=str(uuid.uuid4()), session_id=session.id, role="user",
        content=req.message, created_at=datetime.utcnow(),
    ))

    matrix_result = await db.execute(select(SupportRoutingMatrix).where(SupportRoutingMatrix.is_active == True))  # noqa: E712
    matrix = matrix_result.scalars().all()
    detected_dept = _route_from_matrix(req.message, matrix)

    policy_ctx = build_policy_context(user=user, model="claude_sonnet", prompt=req.message, source="support")
    messages = [{"role": "user", "content": req.message}]

    try:
        response_text, in_tok, out_tok, routing = await call_model(
            "claude_sonnet", messages, _SUPPORT_SYSTEM, user=user, policy_context=policy_ctx
        )
    except PolicyBlockedError as exc:
        await log_policy_event(db, policy_ctx, exc.decision, flush=False)
        await db.commit()
        raise HTTPException(status_code=403, detail="Request blocked by policy.")

    actual_cost = calculate_cost(routing["model"], in_tok, out_tok)
    user.current_usage_usd = round(user.current_usage_usd + actual_cost, 8)

    route_dept = detected_dept
    if "ROUTE_TO:" in response_text:
        for line in response_text.splitlines():
            if line.strip().startswith("ROUTE_TO:"):
                route_dept = line.split(":", 1)[1].strip()
                response_text = response_text.replace(line, "").strip()
                break

    db.add(SupportMessage(
        id=str(uuid.uuid4()), session_id=session.id, role="assistant",
        content=response_text, created_at=datetime.utcnow(),
    ))

    if route_dept:
        db.add(SupportRoutingDecision(
            id=str(uuid.uuid4()), session_id=session.id,
            department=route_dept, confidence=0.8,
            routing_reason="keyword match + AI routing",
            created_at=datetime.utcnow(),
        ))
        session.status = "escalated"

    await db.commit()
    return {"session_id": session.id, "response": response_text, "routed_to": route_dept}


@router.post("/{session_id}/messages")
async def chat_in_session(
    session_id: str,
    req: ChatRequest,
    user: User = Depends(require_training),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(SupportSession).where(SupportSession.id == session_id, SupportSession.user_id == user.id)
    )
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found.")

    history = (await db.execute(
        select(SupportMessage).where(SupportMessage.session_id == session_id).order_by(SupportMessage.created_at)
    )).scalars().all()

    messages = [{"role": m.role, "content": m.content} for m in history]
    messages.append({"role": "user", "content": req.message})

    db.add(SupportMessage(
        id=str(uuid.uuid4()), session_id=session.id, role="user",
        content=req.message, created_at=datetime.utcnow(),
    ))

    policy_ctx = build_policy_context(user=user, model="claude_sonnet", prompt=req.message, source="support")
    try:
        response_text, in_tok, out_tok, routing = await call_model(
            "claude_sonnet", messages, _SUPPORT_SYSTEM, user=user, policy_context=policy_ctx
        )
    except PolicyBlockedError as exc:
        await log_policy_event(db, policy_ctx, exc.decision, flush=False)
        await db.commit()
        raise HTTPException(status_code=403, detail="Request blocked by policy.")

    actual_cost = calculate_cost(routing["model"], in_tok, out_tok)
    user.current_usage_usd = round(user.current_usage_usd + actual_cost, 8)

    db.add(SupportMessage(
        id=str(uuid.uuid4()), session_id=session.id, role="assistant",
        content=response_text, created_at=datetime.utcnow(),
    ))
    session.updated_at = datetime.utcnow()
    await db.commit()
    return {"response": response_text}


@router.get("/routing-matrix")
async def get_routing_matrix(_: User = Depends(require_admin), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(SupportRoutingMatrix))
    return [
        {"id": e.id, "department": e.department, "contact_email": e.contact_email,
         "issue_keywords": e.issue_keywords, "is_active": e.is_active}
        for e in result.scalars().all()
    ]


@router.post("/routing-matrix")
async def create_routing_entry(
    req: RoutingMatrixEntry,
    _: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    entry = SupportRoutingMatrix(
        id=str(uuid.uuid4()), department=req.department,
        issue_keywords=req.issue_keywords, issue_categories=req.issue_categories,
        contact_email=req.contact_email, contact_name=req.contact_name,
        priority=req.priority, is_active=True,
    )
    db.add(entry)
    await db.commit()
    return {"id": entry.id, "department": entry.department}
