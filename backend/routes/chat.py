import uuid
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from config.model_costs import MODEL_INFO, MODEL_RATE_LIMITS
from database import get_db
from models import AISystem, AuditLog, Conversation, Message, User
from routes.auth import require_training
from services.ai_router import call_model
from services.cost_engine import calculate_cost, estimate_tokens, get_cost_summary
from services import memory as mem
from services.policy_engine import PolicyBlockedError, build_policy_context, log_policy_event
from services.rate_limiter import check_rate_limit, increment_rate_limit
from services.trace_builder import build_execution_trace

router = APIRouter(prefix="/chat", tags=["chat"])

_SYSTEM_PROMPT = (
    "You are a helpful AI assistant within Aegis Lite, a governed AI workspace. "
    "Be accurate, professional, and concise. Do not discuss sensitive business information."
)


class ChatRequest(BaseModel):
    conversation_id: Optional[str] = None
    message: str
    model: str = "claude_sonnet"
    file_content: Optional[str] = None
    file_name: Optional[str] = None
    system_id: Optional[str] = None


class ChatResponse(BaseModel):
    conversation_id: str
    message_id: str
    response: str
    model: str
    cost_info: dict
    budget_info: dict
    rate_limit_warning: Optional[str] = None
    high_cost_warning: Optional[str] = None
    routing_info: Optional[dict] = None
    policy_warning: Optional[str] = None
    model_override: Optional[dict] = None
    tools_blocked: Optional[list] = None
    execution_trace: Optional[list] = None
    system_info: Optional[dict] = None


@router.post("", response_model=ChatResponse)
async def chat(
    req: ChatRequest,
    user: User = Depends(require_training),
    db: AsyncSession = Depends(get_db),
):
    if req.model not in MODEL_INFO:
        raise HTTPException(status_code=400, detail=f"Unknown model: {req.model}")

    ai_system: Optional[AISystem] = None
    if req.system_id:
        sys_result = await db.execute(select(AISystem).where(AISystem.id == req.system_id))
        ai_system = sys_result.scalar_one_or_none()
        if not ai_system:
            raise HTTPException(status_code=404, detail=f"AI system '{req.system_id}' not found.")
        if ai_system.status == "draft":
            raise HTTPException(status_code=403, detail=f"AI system '{ai_system.name}' is in draft status.")
        if ai_system.status == "deprecated":
            raise HTTPException(status_code=403, detail=f"AI system '{ai_system.name}' is deprecated.")
        if ai_system.model_used and ai_system.model_used in MODEL_INFO:
            req = req.model_copy(update={"model": ai_system.model_used})

    rate_ok, rate_msg, daily_count = await check_rate_limit(db, user.id, req.model)
    if not rate_ok:
        raise HTTPException(status_code=429, detail=rate_msg)

    full_prompt = req.message
    if req.file_content:
        fname = req.file_name or "attachment"
        full_prompt += f"\n\n---\n**Attached file: {fname}**\n{req.file_content[:5000]}"

    est_input = estimate_tokens(full_prompt)
    est_cost = calculate_cost(req.model, est_input, 600)

    conversation: Optional[Conversation] = None
    if req.conversation_id:
        result = await db.execute(
            select(Conversation).where(
                Conversation.id == req.conversation_id,
                Conversation.user_id == user.id,
            )
        )
        conversation = result.scalar_one_or_none()

    if not conversation:
        title = req.message[:60] + ("…" if len(req.message) > 60 else "")
        conversation = Conversation(
            id=str(uuid.uuid4()),
            user_id=user.id,
            title=title,
            model=req.model,
            system_id=req.system_id,
        )
        db.add(conversation)
        await db.flush()

    history_result = await db.execute(
        select(Message).where(Message.conversation_id == conversation.id).order_by(Message.created_at)
    )
    history = history_result.scalars().all()
    messages = [{"role": m.role, "content": m.content} for m in history] if history else mem.build_context_messages(user.id)
    messages.append({"role": "user", "content": full_prompt})

    policy_ctx = build_policy_context(
        user=user, model=req.model, prompt=full_prompt, source="chat",
        ai_system=ai_system, session_id=req.conversation_id,
    )

    try:
        response_text, in_tokens, out_tokens, routing = await call_model(
            req.model, messages, _SYSTEM_PROMPT, user=user,
            estimated_cost=est_cost, policy_context=policy_ctx,
        )
    except PolicyBlockedError as exc:
        await log_policy_event(db, policy_ctx, exc.decision, flush=False)
        await db.commit()
        raise HTTPException(status_code=403, detail=f"Request blocked by policy: {exc.decision.reason}")

    policy_warning: Optional[str] = None
    if "policy" in routing:
        pd = routing["policy"]
        decision_obj = pd.get("_decision_obj")
        if decision_obj:
            await log_policy_event(db, policy_ctx, decision_obj, flush=True)
        if pd["decision"] in ("warn", "escalate", "modify"):
            policy_warning = f"Policy notice ({pd['decision']}): {pd['reason']}"

    final_model = routing["model"]
    actual_cost = calculate_cost(final_model, in_tokens, out_tokens)
    cost_info = get_cost_summary(final_model, in_tokens, out_tokens)

    user_msg = Message(
        id=str(uuid.uuid4()), conversation_id=conversation.id, role="user", content=full_prompt,
    )
    db.add(user_msg)

    msg_id = str(uuid.uuid4())
    asst_msg = Message(
        id=msg_id, conversation_id=conversation.id, role="assistant",
        content=response_text, model=final_model, cost_usd=actual_cost,
        input_tokens=in_tokens, output_tokens=out_tokens,
    )
    db.add(asst_msg)

    user.current_usage_usd = round(user.current_usage_usd + actual_cost, 8)
    await increment_rate_limit(db, user.id, final_model)

    audit = AuditLog(
        id=str(uuid.uuid4()), user_id=user.id, event_type="chat",
        model=final_model, prompt=full_prompt[:2000], response=response_text[:2000],
        estimated_input_tokens=in_tokens, estimated_output_tokens=out_tokens,
        estimated_cost=actual_cost, status="success",
        policy_decision=routing.get("policy", {}).get("decision"),
        timestamp=__import__("datetime").datetime.utcnow(),
    )
    db.add(audit)
    await db.commit()

    budget = user.monthly_budget_usd
    remaining = max(0, budget - user.current_usage_usd) if budget > 0 else None
    budget_info = {
        "current_usage": round(user.current_usage_usd, 6),
        "monthly_budget": budget,
        "remaining": round(remaining, 6) if remaining is not None else None,
        "percentage_used": round((user.current_usage_usd / budget * 100) if budget > 0 else 0, 2),
    }

    rate_limit_warning = None
    if daily_count >= MODEL_RATE_LIMITS.get(final_model, {}).get("daily_limit", 200) * 0.9:
        rate_limit_warning = f"Approaching daily limit for {final_model}"

    execution_trace = build_execution_trace(
        policy_decision=routing.get("policy"),
        routing=routing,
        model=final_model,
        cost_info=cost_info,
        rate_limit_ok=rate_ok,
    )

    routing_info = {
        "model":         final_model,
        "fallback_used": routing.get("fallback_used", False),
        "reason":        routing.get("reason", ""),
    }

    model_override_info = None
    if routing.get("fallback_used") or (routing.get("policy", {}).get("overridden_model")):
        model_override_info = {
            "original":    req.model,
            "actual":      final_model,
            "reason":      routing.get("reason", ""),
        }

    system_info = None
    if ai_system:
        system_info = {
            "id":         ai_system.id,
            "name":       ai_system.name,
            "department": ai_system.department,
            "risk_level": ai_system.risk_level,
            "status":     ai_system.status,
        }

    return ChatResponse(
        conversation_id=conversation.id,
        message_id=msg_id,
        response=response_text,
        model=final_model,
        cost_info=cost_info,
        budget_info=budget_info,
        rate_limit_warning=rate_limit_warning,
        high_cost_warning="High-cost model — monitor usage." if MODEL_RATE_LIMITS.get(final_model, {}).get("warning") else None,
        routing_info=routing_info,
        policy_warning=policy_warning,
        model_override=model_override_info,
        tools_blocked=routing.get("policy", {}).get("tools_blocked"),
        execution_trace=execution_trace,
        system_info=system_info,
    )
