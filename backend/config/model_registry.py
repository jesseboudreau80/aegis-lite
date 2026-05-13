"""
Single source of truth for all model metadata.

Pricing is stored as cost-per-million-tokens (USD) for readability.
Cost engine derives per-token rates by dividing by 1_000_000.
"""

# fmt: off
REGISTRY: dict[str, dict] = {

    # ── Premium reasoning ─────────────────────────────────────────────────────
    "claude_opus": {
        "id":                       "claude_opus",
        "display_name":             "Claude Opus",
        "description":              "Highest-capability reasoning model. Best for complex analysis, multi-step research, and tasks that require nuanced judgement.",
        "provider":                 "Anthropic",
        "provider_type":            "anthropic",
        "api_model":                "claude-opus-4-7",
        "tier":                     "premium",
        "cost_level":               "High",
        "latency_level":            "Slow",
        "quality_level":            "Highest",
        "input_cost_per_million":   15.0,
        "output_cost_per_million":  75.0,
        "daily_limit":              20,
        "fallback_chain":           ["claude_sonnet", "gpt4o_mini", "mistral"],
        "recommended_for":          ["complex reasoning", "legal and compliance drafting", "multi-step research", "strategic analysis"],
        "avoid_for":                ["simple Q&A", "high-volume batch tasks", "real-time responses"],
        "enabled":                  True,
        "visible_in_ui":            True,
        "warning":                  "Premium model — significantly higher cost. Reserve for tasks that genuinely require advanced reasoning.",
    },

    # ── Standard — balanced performance ──────────────────────────────────────
    "claude_sonnet": {
        "id":                       "claude_sonnet",
        "display_name":             "Claude Sonnet",
        "description":              "Balanced intelligence and speed. Handles most professional tasks well at a moderate cost.",
        "provider":                 "Anthropic",
        "provider_type":            "anthropic",
        "api_model":                "claude-sonnet-4-6",
        "tier":                     "standard",
        "cost_level":               "Medium",
        "latency_level":            "Medium",
        "quality_level":            "High",
        "input_cost_per_million":   3.0,
        "output_cost_per_million":  15.0,
        "daily_limit":              200,
        "fallback_chain":           ["gpt4o", "gpt4o_mini", "mistral"],
        "recommended_for":          ["drafting and editing", "summarisation", "code review", "general Q&A"],
        "avoid_for":                ["cost-critical high-volume tasks"],
        "enabled":                  True,
        "visible_in_ui":            True,
        "warning":                  None,
    },

    # ── Standard — OpenAI ─────────────────────────────────────────────────────
    "gpt4o": {
        "id":                       "gpt4o",
        "display_name":             "GPT-4o",
        "description":              "OpenAI's flagship model. Strong at coding, structured output, and general-purpose tasks.",
        "provider":                 "OpenAI",
        "provider_type":            "openai",
        "api_model":                "gpt-4o",
        "tier":                     "standard",
        "cost_level":               "Medium",
        "latency_level":            "Medium",
        "quality_level":            "High",
        "input_cost_per_million":   5.0,
        "output_cost_per_million":  20.0,
        "daily_limit":              200,
        "fallback_chain":           ["gpt4o_mini", "mistral"],
        "recommended_for":          ["code generation", "data extraction", "structured JSON output"],
        "avoid_for":                ["cost-critical high-volume tasks"],
        "enabled":                  True,
        "visible_in_ui":            True,
        "warning":                  None,
    },

    # ── Budget saver ──────────────────────────────────────────────────────────
    "gpt4o_mini": {
        "id":                       "gpt4o_mini",
        "display_name":             "GPT-4o Mini",
        "description":              "Fast, cost-efficient model. Handles everyday tasks well at a fraction of the cost.",
        "provider":                 "OpenAI",
        "provider_type":            "openai",
        "api_model":                "gpt-4o-mini",
        "tier":                     "budget",
        "cost_level":               "Low",
        "latency_level":            "Fast",
        "quality_level":            "Good",
        "input_cost_per_million":   0.15,
        "output_cost_per_million":  0.60,
        "daily_limit":              500,
        "fallback_chain":           ["mistral"],
        "recommended_for":          ["quick lookups", "short summaries", "form completion", "high-volume workflows"],
        "avoid_for":                ["nuanced analysis", "long-form writing requiring depth"],
        "enabled":                  True,
        "visible_in_ui":            True,
        "warning":                  None,
    },

    # ── Free — OpenRouter ─────────────────────────────────────────────────────
    "mistral": {
        "id":                       "mistral",
        "display_name":             "Liquid LFM 1.2B (Free)",
        "description":              "Liquid AI's compact 1.2B instruction model via OpenRouter free tier. Ultra-fast, zero cost.",
        "provider":                 "OpenRouter",
        "provider_type":            "openrouter",
        "api_model":                "liquid/lfm-2.5-1.2b-instruct:free",
        "tier":                     "free",
        "cost_level":               "Very Low",
        "latency_level":            "Fast",
        "quality_level":            "Basic",
        "input_cost_per_million":   0.0,
        "output_cost_per_million":  0.0,
        "daily_limit":              500,
        "fallback_chain":           ["llama3"],
        "recommended_for":          ["general Q&A", "drafts", "free-tier experimentation"],
        "avoid_for":                ["complex multi-step reasoning"],
        "enabled":                  True,
        "visible_in_ui":            True,
        "warning":                  None,
    },

    "llama3": {
        "id":                       "llama3",
        "display_name":             "GPT OSS 20B (Free)",
        "description":              "OpenAI's open-source 20B model via OpenRouter free tier. Clean output at zero cost.",
        "provider":                 "OpenRouter",
        "provider_type":            "openrouter",
        "api_model":                "openai/gpt-oss-20b:free",
        "tier":                     "free",
        "cost_level":               "Very Low",
        "latency_level":            "Fast",
        "quality_level":            "Good",
        "input_cost_per_million":   0.0,
        "output_cost_per_million":  0.0,
        "daily_limit":              500,
        "fallback_chain":           ["mistral"],
        "recommended_for":          ["general Q&A", "drafts", "cost-free experimentation"],
        "avoid_for":                ["production-critical tasks"],
        "enabled":                  True,
        "visible_in_ui":            True,
        "warning":                  None,
    },

    "gemini": {
        "id":                       "gemini",
        "display_name":             "Gemma 4 26B (Free)",
        "description":              "Google Gemma 4 26B via OpenRouter free tier. Strong quality at zero cost.",
        "provider":                 "OpenRouter",
        "provider_type":            "openrouter",
        "api_model":                "google/gemma-4-26b-a4b-it:free",
        "tier":                     "free",
        "cost_level":               "Very Low",
        "latency_level":            "Medium",
        "quality_level":            "Good",
        "input_cost_per_million":   0.0,
        "output_cost_per_million":  0.0,
        "daily_limit":              500,
        "fallback_chain":           ["llama3"],
        "recommended_for":          ["quick queries", "drafts", "summaries"],
        "avoid_for":                ["confidential documents — routes through external API"],
        "enabled":                  True,
        "visible_in_ui":            True,
        "warning":                  None,
    },

    "kimi": {
        "id":                       "kimi",
        "display_name":             "Kimi (Demo)",
        "description":              "Moonshot AI Kimi — simulated response in demo mode.",
        "provider":                 "Moonshot AI (Demo)",
        "provider_type":            "mock",
        "api_model":                "kimi-mock",
        "tier":                     "free",
        "cost_level":               "Very Low",
        "latency_level":            "Fast",
        "quality_level":            "Basic",
        "input_cost_per_million":   0.5,
        "output_cost_per_million":  2.0,
        "daily_limit":              500,
        "fallback_chain":           ["mistral"],
        "recommended_for":          ["demo and testing"],
        "avoid_for":                ["production use — currently simulated"],
        "enabled":                  True,
        "visible_in_ui":            True,
        "warning":                  "Simulated response — not connected to the live Kimi API.",
    },

    # ── Research — Perplexity ─────────────────────────────────────────────────
    "perplexity_sonar": {
        "id":                       "perplexity_sonar",
        "display_name":             "Perplexity Sonar",
        "description":              "Web-grounded search with citations. Fast answers backed by live web sources.",
        "provider":                 "Perplexity",
        "provider_type":            "perplexity",
        "api_model":                "sonar",
        "tier":                     "standard",
        "cost_level":               "Low",
        "latency_level":            "Fast",
        "quality_level":            "Good",
        "input_cost_per_million":   1.0,
        "output_cost_per_million":  1.0,
        "daily_limit":              200,
        "fallback_chain":           ["claude_sonnet", "gpt4o_mini"],
        "recommended_for":          ["quick web lookups", "current events", "factual Q&A with sources"],
        "avoid_for":                ["deep analysis", "confidential document work"],
        "enabled":                  True,
        "visible_in_ui":            True,
        "warning":                  "Sends queries to Perplexity's web-search API. Do not submit confidential data.",
    },

    "perplexity_sonar_pro": {
        "id":                       "perplexity_sonar_pro",
        "display_name":             "Perplexity Sonar Pro",
        "description":              "Deep web research with multi-source synthesis and detailed citations.",
        "provider":                 "Perplexity",
        "provider_type":            "perplexity",
        "api_model":                "sonar-pro",
        "tier":                     "standard",
        "cost_level":               "Medium",
        "latency_level":            "Medium",
        "quality_level":            "High",
        "input_cost_per_million":   3.0,
        "output_cost_per_million":  15.0,
        "daily_limit":              100,
        "fallback_chain":           ["perplexity_sonar", "claude_sonnet"],
        "recommended_for":          ["competitive research", "market analysis", "multi-source synthesis"],
        "avoid_for":                ["confidential document work"],
        "enabled":                  True,
        "visible_in_ui":            True,
        "warning":                  "Sends queries to Perplexity's web-search API. Do not submit confidential data.",
    },

    # ── Legacy alias ──────────────────────────────────────────────────────────
    "openai": {
        "id":                       "openai",
        "display_name":             "GPT-4o",
        "description":              "Legacy alias for gpt4o.",
        "provider":                 "OpenAI",
        "provider_type":            "openai",
        "api_model":                "gpt-4o",
        "tier":                     "standard",
        "cost_level":               "Medium",
        "latency_level":            "Medium",
        "quality_level":            "High",
        "input_cost_per_million":   5.0,
        "output_cost_per_million":  20.0,
        "daily_limit":              200,
        "fallback_chain":           ["gpt4o_mini", "mistral"],
        "recommended_for":          [],
        "avoid_for":                [],
        "enabled":                  True,
        "visible_in_ui":            False,
        "warning":                  None,
    },
}
# fmt: on


def get(model_id: str) -> dict | None:
    return REGISTRY.get(model_id)


def ids_by_tier(tier: str, enabled_only: bool = True) -> list[str]:
    return [
        m["id"] for m in REGISTRY.values()
        if m["tier"] == tier and (not enabled_only or m["enabled"])
    ]


def free_fallback_id() -> str:
    ids = ids_by_tier("free")
    return ids[0] if ids else "mistral"


def premium_model_ids() -> set[str]:
    return {m["id"] for m in REGISTRY.values() if m["tier"] == "premium" and m["enabled"]}


def ui_models() -> list[dict]:
    _tier_order = {"premium": 0, "standard": 1, "budget": 2, "free": 3}
    visible = [m for m in REGISTRY.values() if m["visible_in_ui"] and m["enabled"]]
    return sorted(visible, key=lambda m: (_tier_order.get(m["tier"], 9), m["display_name"]))
