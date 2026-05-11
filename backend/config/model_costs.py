"""
Backward-compatible cost/rate-limit/info dicts derived from the model registry.
"""
from config.model_registry import REGISTRY

MODEL_COSTS: dict[str, dict] = {
    id: {
        "input":  m["input_cost_per_million"]  / 1_000_000,
        "output": m["output_cost_per_million"] / 1_000_000,
    }
    for id, m in REGISTRY.items()
}

MODEL_RATE_LIMITS: dict[str, dict] = {
    id: {
        "daily_limit": m["daily_limit"],
        "warning":     m["tier"] == "premium",
    }
    for id, m in REGISTRY.items()
}

MODEL_INFO: dict[str, dict] = {
    id: {
        "display_name": m["display_name"],
        "provider":     m["provider"],
        "cost_level":   m["cost_level"],
        "best_for":     m["description"],
        "warning":      m["warning"],
        "api_model":    m["api_model"],
    }
    for id, m in REGISTRY.items()
}
