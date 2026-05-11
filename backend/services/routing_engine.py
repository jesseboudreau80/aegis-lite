import logging

from fastapi import HTTPException

from config.model_registry import ids_by_tier, free_fallback_id, premium_model_ids

logger = logging.getLogger(__name__)

MAX_REQUEST_COST: float = 0.10
BUDGET_WARNING_PCT: float = 0.80

FREE_FALLBACK_MODEL: str = free_fallback_id()
COST_FALLBACK_MODEL: str = next(iter(ids_by_tier("budget")), "gpt4o_mini")
PREMIUM_MODELS: set[str] = premium_model_ids()


async def select_model(
    requested_model: str,
    user,
    estimated_cost: float,
    fallback_enabled: bool = True,
) -> dict:
    """
    Evaluate routing rules and return a model decision.
    Returns: {"model": str, "fallback_used": bool, "reason": str}
    """
    budget = user.monthly_budget_usd
    usage = user.current_usage_usd

    if budget > 0 and usage >= budget:
        if fallback_enabled:
            return _decision(FREE_FALLBACK_MODEL, True, "budget exhausted — routed to free model")
        raise HTTPException(status_code=402, detail="Monthly AI budget reached.")

    if budget > 0 and (usage + estimated_cost) > budget:
        if fallback_enabled:
            remaining = budget - usage
            return _decision(
                FREE_FALLBACK_MODEL, True,
                f"request would exceed remaining budget (${remaining:.4f}) — free model",
            )
        raise HTTPException(status_code=402, detail="Request would exceed budget.")

    if estimated_cost > MAX_REQUEST_COST:
        return _decision(
            COST_FALLBACK_MODEL,
            requested_model != COST_FALLBACK_MODEL,
            f"estimated cost ${estimated_cost:.4f} exceeds per-request limit — downgraded",
        )

    if requested_model in PREMIUM_MODELS and budget > 0:
        pct = usage / budget
        if pct >= BUDGET_WARNING_PCT:
            return _decision(
                COST_FALLBACK_MODEL, True,
                f"budget at {pct:.0%} — downgraded from {requested_model} to conserve budget",
            )

    return _decision(requested_model, False, "selected as requested")


def _decision(model: str, fallback_used: bool, reason: str) -> dict:
    return {"model": model, "fallback_used": fallback_used, "reason": reason}
