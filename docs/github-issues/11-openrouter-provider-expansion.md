# Issue: Expand OpenRouter provider with additional free models

**Labels:** `good-first-issue` · `provider-integration` · `backend`

## Background

The current OpenRouter integration in `backend/services/providers/openrouter.py` supports Mistral 7B, Llama 3.1 8B, and Gemini Flash 1.5 8B via the free tier. OpenRouter's free tier now includes additional capable models that would give Aegis Lite users more zero-cost options, including models better suited for specific governance use cases.

## Why this matters

Free-tier model variety is one of the strongest differentiators for OSS AI governance tools. Teams evaluating Aegis Lite should be able to test governance workflows at zero cost with multiple model options.

## Acceptance criteria

- [ ] At least 3 new models added to `backend/config/model_registry.py` from the OpenRouter free tier
- [ ] Each model has: display name, description, provider_type `openrouter`, tier `free`, accurate daily_limit
- [ ] `allowed_models` in `config/agent_registry.py` updated where appropriate
- [ ] New models appear in the frontend model selector
- [ ] `policy_config.py` `ROLE_MODEL_ACCESS` updated to include new models for the `user` role
- [ ] Brief comment in model_registry.py explaining the free-tier model discovery process

## Suggested models to evaluate

Check [openrouter.ai/models?q=free](https://openrouter.ai/models?q=free) for the current free-tier list. Candidates at time of writing:

| Model | ID | Notes |
|-------|-----|-------|
| Qwen 2.5 7B | `qwen/qwen-2.5-7b-instruct:free` | Strong multilingual |
| DeepSeek R1 | `deepseek/deepseek-r1:free` | Strong reasoning |
| Phi-3 Mini | `microsoft/phi-3-mini-128k-instruct:free` | Fast, small context |

Verify each is still free tier before adding — OpenRouter free tiers change periodically.

## Implementation notes

Follow the exact pattern of existing models in `model_registry.py`:

```python
"qwen_2_5": {
    "id":                       "qwen_2_5",
    "display_name":             "Qwen 2.5 7B (Free)",
    "description":              "Alibaba Qwen 2.5 7B via OpenRouter free tier. Strong multilingual support.",
    "provider":                 "OpenRouter",
    "provider_type":            "openrouter",
    "api_model":                "qwen/qwen-2.5-7b-instruct:free",
    "tier":                     "free",
    "cost_level":               "Very Low",
    "latency_level":            "Fast",
    "quality_level":            "Basic",
    "input_cost_per_million":   0.0,
    "output_cost_per_million":  0.0,
    "daily_limit":              500,
    "fallback_chain":           ["mistral"],
    ...
}
```

## Suggested files to modify

- `backend/config/model_registry.py`
- `backend/config/policy_config.py` (ROLE_MODEL_ACCESS)
- `backend/config/agent_registry.py` (allowed_models in builtin agents)
