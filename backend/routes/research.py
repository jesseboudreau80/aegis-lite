"""
Research routes — web-grounded research via Perplexity with policy enforcement.

All research is FAIL-CLOSED: policy engine blocks before any data leaves.
"""
import logging
import uuid
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from models import Citation, ResearchReport, ResearchSession, User
from routes.auth import require_training
from services.ai_router import call_model
from services.cost_engine import calculate_cost
from services.policy_engine import PolicyBlockedError, build_policy_context, log_policy_event

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/research", tags=["research"])

_RESEARCH_MODELS = {
    "quick":   "perplexity_sonar",
    "deep":    "perplexity_sonar_pro",
    "analyst": "perplexity_sonar_pro",
}


class ResearchRequest(BaseModel):
    query: str
    research_type: str = "quick"
    search_recency: Optional[str] = None
    search_domains: Optional[list[str]] = None


@router.post("")
async def run_research(
    req: ResearchRequest,
    user: User = Depends(require_training),
    db: AsyncSession = Depends(get_db),
):
    model = _RESEARCH_MODELS.get(req.research_type, "perplexity_sonar")
    policy_ctx = build_policy_context(
        user=user, model=model, prompt=req.query, source="research",
    )

    messages = [{"role": "user", "content": req.query}]
    kwargs = {}
    if req.search_recency:
        kwargs["search_recency_filter"] = req.search_recency
    if req.search_domains:
        kwargs["search_domain_filter"] = req.search_domains

    try:
        response_text, in_tokens, out_tokens, routing = await call_model(
            model, messages, None, user=user, policy_context=policy_ctx, **kwargs
        )
    except PolicyBlockedError as exc:
        await log_policy_event(db, policy_ctx, exc.decision, flush=False)
        await db.commit()
        raise HTTPException(status_code=403, detail=f"Research blocked by policy: {exc.decision.reason}")

    actual_cost = calculate_cost(routing["model"], in_tokens, out_tokens)
    user.current_usage_usd = round(user.current_usage_usd + actual_cost, 8)

    session = ResearchSession(
        id=str(uuid.uuid4()), user_id=user.id, query=req.query,
        model=routing["model"], status="completed", cost_usd=actual_cost,
        created_at=datetime.utcnow(),
    )
    db.add(session)
    await db.flush()

    report = ResearchReport(
        id=str(uuid.uuid4()), session_id=session.id,
        content=response_text, created_at=datetime.utcnow(),
    )
    db.add(report)
    await db.flush()

    citations = routing.get("citations", [])
    for c in citations:
        db.add(Citation(
            id=str(uuid.uuid4()), report_id=report.id,
            url=c.get("url"), title=c.get("title"), snippet=c.get("snippet"),
        ))

    await db.commit()

    return {
        "session_id":    session.id,
        "report_id":     report.id,
        "query":         req.query,
        "research_type": req.research_type,
        "content":       response_text,
        "model_used":    routing["model"],
        "cost_usd":      round(actual_cost, 8),
        "citations":     citations,
    }


@router.get("")
async def list_sessions(user: User = Depends(require_training), db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(ResearchSession).where(ResearchSession.user_id == user.id)
        .order_by(ResearchSession.created_at.desc()).limit(50)
    )
    sessions = result.scalars().all()
    return [
        {"id": s.id, "query": s.query, "model": s.model,
         "status": s.status, "cost_usd": s.cost_usd,
         "created_at": s.created_at.isoformat()}
        for s in sessions
    ]
