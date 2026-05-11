"""Agents Hub routes — built-in and user-created governed agents."""
import uuid
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from models import Agent, AgentExecution, AgentVersion, GovernanceEvent, User
from routes.auth import get_current_user, require_training
from services.ai_router import call_model
from services.cost_engine import calculate_cost, estimate_tokens
from services.policy_engine import PolicyBlockedError, build_policy_context, log_policy_event
from services.trace_builder import build_execution_trace

router = APIRouter(prefix="/agents", tags=["agents"])


class CreateAgentRequest(BaseModel):
    name: str
    description: str = ""
    system_prompt: str = ""
    model: str = "claude_sonnet"
    allowed_models: Optional[list] = None
    budget_limit_usd: Optional[float] = None


class UpdateAgentRequest(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    system_prompt: Optional[str] = None
    model: Optional[str] = None
    allowed_models: Optional[list] = None
    budget_limit_usd: Optional[float] = None
    change_note: Optional[str] = None


class AgentRunRequest(BaseModel):
    message: str
    model: Optional[str] = None


def _agent_dict(a: Agent) -> dict:
    return {
        "id":               a.id,
        "slug":             a.slug,
        "name":             a.name,
        "description":      a.description or "",
        "system_prompt":    a.system_prompt,
        "model":            a.model,
        "agent_type":       a.agent_type,
        "allowed_models":   a.allowed_models,
        "budget_limit_usd": a.budget_limit_usd,
        "is_active":        a.is_active,
        "created_by":       a.created_by,
        "created_at":       a.created_at.isoformat(),
    }


@router.get("")
async def list_agents(
    agent_type: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_training),
):
    q = select(Agent).where(Agent.is_active == True)  # noqa: E712
    if agent_type:
        q = q.where(Agent.agent_type == agent_type)
    result = await db.execute(q)
    agents = result.scalars().all()
    return [_agent_dict(a) for a in agents]


@router.get("/{agent_id}")
async def get_agent(
    agent_id: str,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_training),
):
    result = await db.execute(select(Agent).where(Agent.id == agent_id))
    agent = result.scalar_one_or_none()
    if not agent:
        result = await db.execute(select(Agent).where(Agent.slug == agent_id))
        agent = result.scalar_one_or_none()
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found.")
    return _agent_dict(agent)


@router.post("")
async def create_agent(
    req: CreateAgentRequest,
    user: User = Depends(require_training),
    db: AsyncSession = Depends(get_db),
):
    slug = req.name.lower().replace(" ", "-").replace("_", "-")[:50]
    existing = await db.execute(select(Agent).where(Agent.slug == slug))
    if existing.scalar_one_or_none():
        slug = f"{slug}-{uuid.uuid4().hex[:6]}"

    agent = Agent(
        id=str(uuid.uuid4()),
        name=req.name,
        slug=slug,
        description=req.description,
        system_prompt=req.system_prompt,
        model=req.model,
        agent_type="user_created",
        is_active=True,
        budget_limit_usd=req.budget_limit_usd,
        allowed_models=req.allowed_models,
        created_by=user.id,
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow(),
    )
    db.add(agent)

    version = AgentVersion(
        id=str(uuid.uuid4()),
        agent_id=agent.id,
        version=1,
        system_prompt=req.system_prompt,
        model=req.model,
        change_note="Initial version",
        created_by=user.id,
        created_at=datetime.utcnow(),
    )
    db.add(version)
    await db.commit()
    return _agent_dict(agent)


@router.patch("/{agent_id}")
async def update_agent(
    agent_id: str,
    req: UpdateAgentRequest,
    user: User = Depends(require_training),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Agent).where(Agent.id == agent_id))
    agent = result.scalar_one_or_none()
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found.")
    if agent.agent_type == "builtin":
        raise HTTPException(status_code=403, detail="Built-in agents cannot be modified.")
    if agent.created_by != user.id and user.role != "admin":
        raise HTTPException(status_code=403, detail="Not authorized to edit this agent.")

    if req.name is not None:
        agent.name = req.name
    if req.description is not None:
        agent.description = req.description
    if req.model is not None:
        agent.model = req.model
    if req.allowed_models is not None:
        agent.allowed_models = req.allowed_models
    if req.budget_limit_usd is not None:
        agent.budget_limit_usd = req.budget_limit_usd

    if req.system_prompt is not None and req.system_prompt != agent.system_prompt:
        latest_version_result = await db.execute(
            select(AgentVersion).where(AgentVersion.agent_id == agent.id).order_by(AgentVersion.version.desc()).limit(1)
        )
        latest = latest_version_result.scalar_one_or_none()
        next_v = (latest.version + 1) if latest else 2
        db.add(AgentVersion(
            id=str(uuid.uuid4()),
            agent_id=agent.id,
            version=next_v,
            system_prompt=req.system_prompt,
            model=agent.model,
            change_note=req.change_note or "Updated",
            created_by=user.id,
            created_at=datetime.utcnow(),
        ))
        agent.system_prompt = req.system_prompt

    agent.updated_at = datetime.utcnow()
    await db.commit()
    return _agent_dict(agent)


@router.delete("/{agent_id}")
async def delete_agent(
    agent_id: str,
    user: User = Depends(require_training),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Agent).where(Agent.id == agent_id))
    agent = result.scalar_one_or_none()
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found.")
    if agent.agent_type == "builtin":
        raise HTTPException(status_code=403, detail="Built-in agents cannot be deleted.")
    if agent.created_by != user.id and user.role != "admin":
        raise HTTPException(status_code=403, detail="Not authorized.")
    agent.is_active = False
    agent.updated_at = datetime.utcnow()
    await db.commit()
    return {"message": "Agent deactivated."}


@router.post("/{agent_id}/run")
async def run_agent(
    agent_id: str,
    req: AgentRunRequest,
    user: User = Depends(require_training),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Agent).where(Agent.id == agent_id))
    agent = result.scalar_one_or_none()
    if not agent:
        result = await db.execute(select(Agent).where(Agent.slug == agent_id))
        agent = result.scalar_one_or_none()
    if not agent or not agent.is_active:
        raise HTTPException(status_code=404, detail="Agent not found or inactive.")

    model = req.model or agent.model
    if agent.allowed_models and model not in agent.allowed_models:
        model = agent.allowed_models[0]

    full_prompt = req.message
    est_tokens = estimate_tokens(full_prompt)
    est_cost = calculate_cost(model, est_tokens, 600)

    policy_ctx = build_policy_context(
        user=user, model=model, prompt=full_prompt, source="agent", agent=agent,
    )

    messages = [{"role": "user", "content": full_prompt}]
    system = agent.system_prompt or "You are a helpful AI assistant."

    try:
        response_text, in_tokens, out_tokens, routing = await call_model(
            model, messages, system, user=user, estimated_cost=est_cost, policy_context=policy_ctx,
        )
    except PolicyBlockedError as exc:
        await log_policy_event(db, policy_ctx, exc.decision, flush=False)
        db.add(AgentExecution(
            id=str(uuid.uuid4()), agent_id=agent.id, user_id=user.id,
            prompt=full_prompt, model=model, status="blocked",
            policy_decision=exc.decision.decision,
            created_at=datetime.utcnow(),
        ))
        await db.commit()
        raise HTTPException(status_code=403, detail=f"Policy blocked: {exc.decision.reason}")

    actual_cost = calculate_cost(routing["model"], in_tokens, out_tokens)
    user.current_usage_usd = round(user.current_usage_usd + actual_cost, 8)

    execution = AgentExecution(
        id=str(uuid.uuid4()), agent_id=agent.id, user_id=user.id,
        prompt=full_prompt, response=response_text, model=routing["model"],
        cost_usd=actual_cost, status="success",
        policy_decision=routing.get("policy", {}).get("decision"),
        created_at=datetime.utcnow(),
    )
    db.add(execution)

    if "policy" in routing:
        pd_obj = routing["policy"].get("_decision_obj")
        if pd_obj:
            await log_policy_event(db, policy_ctx, pd_obj, flush=True)

    await db.commit()

    trace = build_execution_trace(
        policy_decision=routing.get("policy"),
        routing=routing,
        model=routing["model"],
        cost_info={"total_tokens": in_tokens + out_tokens, "cost_usd": actual_cost},
        rate_limit_ok=True,
    )

    return {
        "execution_id":   execution.id,
        "agent":          agent.name,
        "response":       response_text,
        "model_used":     routing["model"],
        "fallback_used":  routing.get("fallback_used", False),
        "cost_usd":       round(actual_cost, 8),
        "execution_trace":trace,
    }
