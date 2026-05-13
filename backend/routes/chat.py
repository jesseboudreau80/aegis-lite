import asyncio
import json
import logging
import uuid
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from config.model_costs import MODEL_INFO, MODEL_RATE_LIMITS
from config.settings import settings
from database import AsyncSessionLocal, get_db
from models import AISystem, AuditLog, Conversation, Message, User
from routes.auth import require_training
from services.ai_router import call_model, _key_is_configured, _demo_response
from services.cost_engine import calculate_cost, estimate_tokens, get_cost_summary
from services import memory as mem
from services.policy_engine import (
    PolicyBlockedError, build_policy_context, log_policy_event, policy_engine,
)
from services.rate_limiter import check_rate_limit, increment_rate_limit
from services.routing_engine import select_model
from services.trace_builder import build_execution_trace

logger = logging.getLogger(__name__)
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


# ── Streaming endpoint ─────────────────────────────────────────────────────────

@router.post("/stream")
async def chat_stream(
    req: ChatRequest,
    user: User = Depends(require_training),
    db: AsyncSession = Depends(get_db),
):
    """
    SSE streaming chat endpoint.

    Sends three event types:
      {"type":"meta"}  — governance metadata, sent immediately before inference
      {"type":"token"} — incremental text token
      {"type":"done"}  — completion with cost, message_id, conversation_id
    """
    if req.model not in MODEL_INFO:
        raise HTTPException(status_code=400, detail=f"Unknown model: {req.model}")

    rate_ok, rate_msg, _ = await check_rate_limit(db, user.id, req.model)
    if not rate_ok:
        raise HTTPException(status_code=429, detail=rate_msg)

    full_prompt = req.message
    if req.file_content:
        fname = req.file_name or "attachment"
        full_prompt += f"\n\n---\n**Attached file: {fname}**\n{req.file_content[:5000]}"

    est_input  = estimate_tokens(full_prompt)
    est_cost   = calculate_cost(req.model, est_input, 600)

    # Conversation setup
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

    conv_id = conversation.id

    # Message history
    history_result = await db.execute(
        select(Message).where(Message.conversation_id == conversation.id).order_by(Message.created_at)
    )
    history = history_result.scalars().all()
    messages = (
        [{"role": m.role, "content": m.content} for m in history]
        if history else mem.build_context_messages(user.id)
    )
    messages.append({"role": "user", "content": full_prompt})

    # Policy evaluation
    policy_ctx = build_policy_context(
        user=user, model=req.model, prompt=full_prompt, source="chat",
        ai_system=None, session_id=req.conversation_id,
    )
    decision = await policy_engine.evaluate_request(policy_ctx)

    if decision.decision == "block":
        await log_policy_event(db, policy_ctx, decision, flush=False)
        await db.commit()
        raise HTTPException(status_code=403, detail=f"Request blocked by policy: {decision.reason}")

    # Model routing
    routing = await select_model(req.model, user, est_cost)
    effective_model = routing["model"]

    if decision.overridden_model and decision.overridden_model != effective_model:
        effective_model = decision.overridden_model
        routing["model"] = effective_model
        routing["fallback_used"] = True
        routing["reason"] = f"policy override to {effective_model}"

    if decision.modified_prompt:
        messages = list(messages)
        if messages and messages[-1]["role"] == "user":
            messages[-1] = {**messages[-1], "content": decision.modified_prompt}

    system_prompt = _SYSTEM_PROMPT
    if decision.system_prompt_injection:
        system_prompt = f"{system_prompt}\n\n{decision.system_prompt_injection}"

    routing["policy"] = {
        "decision":        decision.decision,
        "reason":          decision.reason,
        "flags":           decision.flags,
        "risk_score":      decision.risk_score,
        "policy_version":  decision.policy_version,
    }

    await db.commit()  # commit conversation before streaming starts

    # Snapshot immutable values for use inside generator
    user_id        = user.id
    user_usage     = user.current_usage_usd
    user_budget    = user.monthly_budget_usd
    req_model      = req.model

    policy_warning: Optional[str] = None
    if decision.decision in ("warn", "escalate", "modify"):
        policy_warning = f"Policy notice ({decision.decision}): {decision.reason}"

    async def event_stream():
        # ── Governance metadata event ────────────────────────────────────────
        pre_trace = build_execution_trace(
            policy_decision=routing.get("policy"),
            routing=routing,
            model=effective_model,
            cost_info={},
            rate_limit_ok=rate_ok,
        )

        meta_evt = {
            "type":            "meta",
            "conversation_id": conv_id,
            "model":           effective_model,
            "fallback_used":   routing.get("fallback_used", False),
            "policy_decision": decision.decision,
            "policy_warning":  policy_warning,
            "execution_trace": pre_trace,
        }
        yield f"data: {json.dumps(meta_evt)}\n\n"

        # ── Token stream ─────────────────────────────────────────────────────
        text_parts: list[str] = []
        in_tokens = out_tokens = 0

        try:
            if not _key_is_configured(settings.openrouter_api_key):
                # Demo mode: word-by-word stream
                demo_text, in_tokens, out_tokens = _demo_response(effective_model, messages)
                for word in demo_text.split():
                    tok = word + " "
                    text_parts.append(tok)
                    yield f"data: {json.dumps({'type': 'token', 'content': tok})}\n\n"
                    await asyncio.sleep(0.04)
            else:
                # Live stream from OpenRouter
                from services.providers.openrouter import stream_openrouter
                async for token in stream_openrouter(effective_model, messages, system_prompt):
                    text_parts.append(token)
                    yield f"data: {json.dumps({'type': 'token', 'content': token})}\n\n"
                in_tokens  = estimate_tokens(full_prompt)
                out_tokens = max(1, len("".join(text_parts).split()))

        except asyncio.CancelledError:
            pass
        except Exception as exc:
            logger.error("Stream error model=%s: %s", effective_model, exc)
            err = f"\n\n[Stream interrupted — {type(exc).__name__}]"
            text_parts.append(err)
            yield f"data: {json.dumps({'type': 'token', 'content': err})}\n\n"

        # ── Post-stream DB writes + done event ───────────────────────────────
        full_text   = "".join(text_parts)
        actual_cost = calculate_cost(effective_model, in_tokens, out_tokens)
        cost_info   = get_cost_summary(effective_model, in_tokens, out_tokens)

        msg_id = str(uuid.uuid4())
        try:
            async with AsyncSessionLocal() as wdb:
                wdb.add(Message(
                    id=str(uuid.uuid4()), conversation_id=conv_id,
                    role="user", content=full_prompt,
                ))
                wdb.add(Message(
                    id=msg_id, conversation_id=conv_id, role="assistant",
                    content=full_text, model=effective_model, cost_usd=actual_cost,
                    input_tokens=in_tokens, output_tokens=out_tokens,
                ))
                u = (await wdb.execute(select(User).where(User.id == user_id))).scalar_one_or_none()
                if u:
                    u.current_usage_usd = round(u.current_usage_usd + actual_cost, 8)
                await increment_rate_limit(wdb, user_id, effective_model)
                wdb.add(AuditLog(
                    id=str(uuid.uuid4()), user_id=user_id, event_type="chat",
                    model=effective_model, prompt=full_prompt[:2000], response=full_text[:2000],
                    estimated_input_tokens=in_tokens, estimated_output_tokens=out_tokens,
                    estimated_cost=actual_cost, status="success",
                    policy_decision=decision.decision,
                    timestamp=datetime.utcnow(),
                ))
                if decision.decision != "allow":
                    await log_policy_event(wdb, policy_ctx, decision, flush=True)
                await wdb.commit()
        except Exception as exc:
            logger.error("Post-stream DB write failed: %s", exc)

        # Final trace with real cost
        final_trace = build_execution_trace(
            policy_decision=routing.get("policy"),
            routing=routing,
            model=effective_model,
            cost_info=cost_info,
            rate_limit_ok=rate_ok,
        )

        new_usage = user_usage + actual_cost
        remaining = max(0.0, user_budget - new_usage) if user_budget > 0 else None

        done_evt = {
            "type":          "done",
            "message_id":    msg_id,
            "conversation_id": conv_id,
            "model":         effective_model,
            "cost_info":     cost_info,
            "budget_info": {
                "current_usage":  round(new_usage, 6),
                "monthly_budget": user_budget,
                "remaining":      round(remaining, 6) if remaining is not None else None,
                "percentage_used": round((new_usage / user_budget * 100) if user_budget > 0 else 0, 2),
            },
            "execution_trace":  final_trace,
            "policy_warning":   policy_warning,
            "model_override": {
                "original": req_model,
                "actual":   effective_model,
                "reason":   routing.get("reason", ""),
            } if routing.get("fallback_used") else None,
        }
        yield f"data: {json.dumps(done_evt)}\n\n"

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control":     "no-cache",
            "X-Accel-Buffering": "no",
            "Connection":        "keep-alive",
        },
    )
