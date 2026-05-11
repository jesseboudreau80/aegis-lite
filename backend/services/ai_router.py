"""
AI Router — provider dispatch with integrated policy enforcement.

Policy evaluation runs BEFORE provider dispatch (pre-check) and AFTER
the response is received (post-check). Route handlers that call call_model()
must wrap in try/except PolicyBlockedError to handle blocks.

Example:
    ctx = build_policy_context(user, model, prompt, source="chat")
    try:
        text, in_tok, out_tok, routing = await call_model(
            model, messages, system, user=user, policy_context=ctx
        )
    except PolicyBlockedError as e:
        await log_policy_event(db, ctx, e.decision)
        raise HTTPException(403, detail=f"Policy: {e.decision.reason}")
"""
import logging
from typing import Optional, TYPE_CHECKING

from config.model_costs import MODEL_INFO
from config.settings import settings
from services.providers.openrouter import call_openrouter
from services.providers.perplexity import call_perplexity
from services.routing_engine import FREE_FALLBACK_MODEL, select_model

if TYPE_CHECKING:
    from services.policy_engine import PolicyContext, PolicyDecision

logger = logging.getLogger(__name__)

_MOCK_RESPONSES = {
    "kimi": (
        "Hi! I'm Kimi by Moonshot AI (simulated). This mock response demonstrates "
        "the Kimi integration pathway. In production this connects to the Moonshot AI API."
    ),
}

_MODEL_ERROR = "[Model Error] Unable to process request. Please try again."


def _key_is_configured(key: str) -> bool:
    if not key:
        return False
    if key.endswith("..."):
        return False
    return key.lower() not in {"your-key-here", "change-me", "placeholder"}


def _demo_response(model: str, messages: list[dict]) -> tuple[str, int, int]:
    """Clean fallback when no real API key is configured."""
    display = MODEL_INFO.get(model, {}).get("display_name", model)
    last_content = messages[-1].get("content", "") if messages else ""
    words = len(last_content.split())

    if model in ("claude_opus", "claude_sonnet"):
        env_var = "ANTHROPIC_API_KEY"
    elif model in ("openai", "gpt4o", "gpt4o_mini"):
        env_var = "OPENAI_API_KEY"
    elif model in ("mistral", "llama3", "gemini", "kimi"):
        env_var = "OPENROUTER_API_KEY"
    elif model in ("perplexity_sonar", "perplexity_sonar_pro"):
        env_var = "PERPLEXITY_API_KEY"
    else:
        env_var = "the relevant API key"

    text = (
        f"**[{display} — Demo Mode]**\n\n"
        f"This is a simulated response. To enable live AI responses, add your "
        f"`{env_var}` to `backend/.env`.\n\n"
        f"Your message ({words} {'word' if words == 1 else 'words'}) was received, "
        f"cost-tracked, and logged to the Usage Ledger."
    )
    return text, max(1, words), max(1, len(text.split()))


async def _dispatch(
    model: str,
    messages: list[dict],
    system: str | None,
    **kwargs,
) -> tuple[str, int, int, dict]:
    """Route to the correct provider and return (text, in_tok, out_tok, routing_meta)."""
    info = MODEL_INFO.get(model, {})
    routing_meta: dict = {}

    # Mock providers
    if model in _MOCK_RESPONSES:
        text = _MOCK_RESPONSES[model]
        return text, max(1, len(text.split())), max(1, len(text.split())), routing_meta

    provider = MODEL_INFO.get(model, {}).get("provider", "").lower()

    # Anthropic
    if "anthropic" in MODEL_INFO.get(model, {}).get("provider", "").lower():
        if not _key_is_configured(settings.anthropic_api_key):
            text, i, o = _demo_response(model, messages)
            return text, i, o, routing_meta
        try:
            import anthropic as ant
            api_model = info.get("api_model", "claude-sonnet-4-6")
            client = ant.AsyncAnthropic(api_key=settings.anthropic_api_key)
            ant_messages = [m for m in messages if m.get("role") != "system"]
            resp = await client.messages.create(
                model=api_model,
                max_tokens=4096,
                system=system or "You are a helpful AI assistant.",
                messages=ant_messages,
            )
            text = resp.content[0].text if resp.content else _MODEL_ERROR
            in_tok = resp.usage.input_tokens if resp.usage else 0
            out_tok = resp.usage.output_tokens if resp.usage else 0
            return text, in_tok, out_tok, routing_meta
        except Exception as exc:
            logger.error("Anthropic error for model %s: %s", model, exc)
            return _MODEL_ERROR, 0, 0, routing_meta

    # OpenAI
    if "openai" in MODEL_INFO.get(model, {}).get("provider", "").lower():
        if not _key_is_configured(settings.openai_api_key):
            text, i, o = _demo_response(model, messages)
            return text, i, o, routing_meta
        try:
            from openai import AsyncOpenAI
            api_model = info.get("api_model", "gpt-4o")
            client = AsyncOpenAI(api_key=settings.openai_api_key)
            oai_messages = []
            if system:
                oai_messages.append({"role": "system", "content": system})
            oai_messages.extend(messages)
            resp = await client.chat.completions.create(
                model=api_model, messages=oai_messages, max_tokens=4096
            )
            text = (resp.choices[0].message.content or "").strip()
            usage = resp.usage
            return text, (usage.prompt_tokens if usage else 0), (usage.completion_tokens if usage else 0), routing_meta
        except Exception as exc:
            logger.error("OpenAI error for model %s: %s", model, exc)
            return _MODEL_ERROR, 0, 0, routing_meta

    # Perplexity
    if model in ("perplexity_sonar", "perplexity_sonar_pro"):
        if not _key_is_configured(settings.perplexity_api_key):
            text, i, o = _demo_response(model, messages)
            return text, i, o, routing_meta
        text, in_tok, out_tok, citations = await call_perplexity(model, messages, system, **kwargs)
        routing_meta["citations"] = citations
        return text, in_tok, out_tok, routing_meta

    # OpenRouter (Mistral, Llama, Gemini, etc.)
    if not _key_is_configured(settings.openrouter_api_key):
        text, i, o = _demo_response(model, messages)
        return text, i, o, routing_meta
    text, in_tok, out_tok = await call_openrouter(model, messages, system)
    return text, in_tok, out_tok, routing_meta


async def call_model(
    model: str,
    messages: list[dict],
    system: str | None = None,
    *,
    user=None,
    estimated_cost: float = 0.0,
    policy_context: Optional["PolicyContext"] = None,
    **provider_kwargs,
) -> tuple[str, int, int, dict]:
    """
    Main entry point. Applies routing + policy enforcement around provider dispatch.

    Returns (response_text, input_tokens, output_tokens, routing_dict).
    routing_dict contains: model, fallback_used, reason, policy (optional).
    Raises PolicyBlockedError if request is blocked.
    """
    from services.policy_engine import policy_engine, PolicyBlockedError

    # Budget-aware routing
    if user:
        routing = await select_model(model, user, estimated_cost)
        effective_model = routing["model"]
    else:
        routing = {"model": model, "fallback_used": False, "reason": "no user context"}
        effective_model = model

    # Pre-dispatch policy evaluation
    if policy_context:
        decision = await policy_engine.evaluate_request(policy_context)
        routing["policy"] = {
            "decision":        decision.decision,
            "reason":          decision.reason,
            "flags":           decision.flags,
            "risk_score":      decision.risk_score,
            "policy_version":  decision.policy_version,
            "_decision_obj":   decision,
        }

        if decision.decision == "block":
            raise PolicyBlockedError(decision)

        # Apply model override from policy
        if decision.overridden_model and decision.overridden_model != effective_model:
            effective_model = decision.overridden_model
            routing["model"] = effective_model
            routing["fallback_used"] = True
            routing["reason"] = f"policy override to {effective_model}"

        # Use redacted prompt if policy modified it
        if decision.modified_prompt:
            messages = list(messages)
            if messages and messages[-1]["role"] == "user":
                messages[-1] = {**messages[-1], "content": decision.modified_prompt}

        # Inject governance notice into system prompt
        if decision.system_prompt_injection:
            system = f"{system}\n\n{decision.system_prompt_injection}" if system else decision.system_prompt_injection

    # Dispatch
    text, in_tok, out_tok, dispatch_meta = await _dispatch(
        effective_model, messages, system, **provider_kwargs
    )
    routing.update(dispatch_meta)

    # Post-dispatch policy evaluation (response scan)
    if policy_context and text and text != _MODEL_ERROR:
        resp_decision = await policy_engine.evaluate_response(policy_context, text)
        if resp_decision.modified_response:
            text = resp_decision.modified_response
        if resp_decision.decision == "block":
            text = "[Response blocked by governance policy.]"

    routing["model"] = effective_model
    return text, in_tok, out_tok, routing
