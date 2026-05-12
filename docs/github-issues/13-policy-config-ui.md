# Issue: Add read-only policy configuration viewer to governance dashboard

**Labels:** `enhancement` · `frontend` · `governance` · `dashboard`

## Background

The current `/governance/policies` page shows a hardcoded list of policy rules. It doesn't reflect the actual values in `policy_config.py` at runtime — if an administrator changes a threshold, the UI doesn't update. Additionally, there's no way to see which INJECTION_PATTERNS or SECRETS_RULES are currently active without reading the source code.

## Why this matters

Compliance officers need to be able to view the exact policy configuration that was active at any point — not a static description. A read-only API-backed policy viewer closes this gap and makes the governance dashboard genuinely authoritative.

## Acceptance criteria

- [ ] New backend endpoint `GET /governance/policy-config` (admin-only) returning:
  - `policy_version`
  - `risk_thresholds` (block, escalate, warn values)
  - `pii_rule_count` (count, not the raw regexes)
  - `secrets_rule_count`
  - `injection_pattern_count`
  - `injection_patterns` (the actual strings, for transparency)
  - `force_block_flags` (list)
  - `force_escalate_flags` (list)
  - `role_model_access` (which roles can access which models)
- [ ] Frontend `/governance/policies` page updated to fetch from this endpoint
- [ ] Policy version prominently displayed with a "last changed" note (from git or a static comment)
- [ ] All threshold values shown numerically, not just described in prose
- [ ] Admin can copy the full config as JSON via a "Copy config" button

## Backend sketch

```python
# GET /governance/policy-config
@router.get("/policy-config")
async def get_policy_config(_: User = Depends(require_admin)):
    from config import policy_config as cfg
    return {
        "policy_version":       cfg.POLICY_VERSION,
        "risk_thresholds":      cfg.RISK_THRESHOLDS,
        "pii_rule_count":       len(cfg.PII_RULES),
        "pii_rule_labels":      [label for _, label, _ in cfg.PII_RULES],
        "secrets_rule_count":   len(cfg.SECRETS_RULES),
        "secrets_rule_labels":  [label for _, label, _ in cfg.SECRETS_RULES],
        "injection_patterns":   cfg.INJECTION_PATTERNS,
        "force_block_flags":    sorted(cfg.FORCE_BLOCK_FLAGS),
        "force_escalate_flags": sorted(cfg.FORCE_ESCALATE_FLAGS),
        "force_warn_flags":     sorted(cfg.FORCE_WARN_FLAGS),
        "role_model_access": {
            role: sorted(models) if models else "unrestricted"
            for role, models in cfg.ROLE_MODEL_ACCESS.items()
        },
        "provider_data_policy": {
            k: sorted(v) for k, v in cfg.PROVIDER_DATA_POLICY.items()
        },
    }
```

## Suggested files to modify

- `backend/routes/governance.py` — add `/policy-config` endpoint
- `frontend/app/governance/policies/page.tsx` — fetch from API, display live values
- `frontend/lib/api.ts` — add `getPolicyConfig()` method
