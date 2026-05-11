from config.model_costs import MODEL_COSTS


def estimate_tokens(text: str) -> int:
    """Rough approximation: ~4 chars per token."""
    return max(1, len(text) // 4)


def calculate_cost(model: str, input_tokens: int, output_tokens: int) -> float:
    costs = MODEL_COSTS.get(model, MODEL_COSTS["claude_sonnet"])
    return (input_tokens * costs["input"]) + (output_tokens * costs["output"])


def check_budget(
    current_usage: float, budget: float, estimated_cost: float
) -> tuple[bool, str]:
    """Returns (allowed, error_message)."""
    if budget <= 0:
        return True, ""
    if current_usage >= budget:
        return False, "Monthly AI budget reached. Please contact admin."
    if current_usage + estimated_cost > budget:
        remaining = budget - current_usage
        return (
            False,
            f"This request would exceed your monthly budget. Remaining: ${remaining:.4f}",
        )
    return True, ""


def get_cost_summary(model: str, input_tokens: int, output_tokens: int) -> dict:
    cost = calculate_cost(model, input_tokens, output_tokens)
    rates = MODEL_COSTS.get(model, {})
    return {
        "model": model,
        "input_tokens": input_tokens,
        "output_tokens": output_tokens,
        "total_tokens": input_tokens + output_tokens,
        "cost_usd": round(cost, 8),
        "input_rate_per_token": rates.get("input", 0),
        "output_rate_per_token": rates.get("output", 0),
    }
