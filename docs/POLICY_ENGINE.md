# Policy Engine

The policy engine is the core governance primitive in Aegis Lite. It evaluates every AI request deterministically before it reaches any model, and every response before it is returned to the user.

## Design principles

1. **Deterministic** — Phase 1 rules are pure regex/keyword matching. No LLM calls inside the engine. Results are reproducible for any given input.
2. **Stateless** — the `policy_engine` singleton holds no mutable state and is safe across async workers.
3. **Append-only trace** — every rule that fires appends to `rule_trace` for full audit reproducibility.
4. **Non-breaking** — a decision of `allow` changes nothing downstream. Callers must only handle `block`.

## Rule chain (Phase 1)

Evaluated in order on every request:

| # | Rule | Action on violation |
|---|------|---------------------|
| 1 | Secrets detection | BLOCK (force_block flag) |
| 2 | Model access control | Override to fallback, or BLOCK |
| 3 | Agent permission check | Override model to agent allowlist |
| 4 | Data classification | AUTO-DETECT + restrict providers |
| 5 | PII detection | REDACT (email, phone, SSN, CC) |
| 6 | Prompt injection | ESCALATE when score ≥ 0.55 |
| 7 | Sensitive keywords | WARN |
| 8 | Research outbound | BLOCK confidential/restricted to Perplexity |
| 9 | Tool grant enforcement | Block unauthorized tools |
| 10 | Risk behavior controls | Inject system prompt, set audit level |

## Risk scoring

Each rule that fires adds a `risk_delta` to the cumulative `risk_score` (0.0–1.0). The final score maps to a decision:

| Risk score | Decision |
|-----------|---------|
| ≥ 0.85 | BLOCK |
| ≥ 0.60 | ESCALATE |
| ≥ 0.25 | WARN |
| < 0.25 | ALLOW |

Force flags override the risk threshold:

- `secrets_detected`, `restricted_data_blocked`, `model_access_denied` → force BLOCK regardless of score
- `ssn_detected`, `credit_card_detected`, `high_confidence_injection` → force ESCALATE

## Decisions

| Decision | Meaning |
|---------|---------|
| `allow` | Request passes all checks. Proceed normally. |
| `modify` | Content or model was changed (PII redacted, model downgraded). |
| `warn` | Flagged but allowed. Warning surfaced to UI. |
| `escalate` | High-risk pattern. Enhanced audit. Requires human review. |
| `block` | Hard stop. HTTP 403 returned to caller. |

## Extending the engine

### Add a new Phase 1 rule

1. Add constants to `backend/config/policy_config.py`
2. Add `_check_<name>(self, context, state)` on `PolicyEngine`
3. Call it in the ordered chain in `evaluate_request()`
4. Add a test in `backend/tests/`

### Phase 2 — AI-assisted evaluation (stub)

`evaluate_request_ai()` is a stub for AI-assisted evaluation. When implemented:
- Call a lightweight model (e.g. `gpt4o_mini`) with a structured policy-evaluation prompt
- Merge its decision with Phase 1: never lower the risk score or remove flags

## Configuration

All rule constants live in `backend/config/policy_config.py`:

```python
# Add a new injection pattern:
INJECTION_PATTERNS.append("new jailbreak phrase")

# Tighten the block threshold:
RISK_THRESHOLDS["block"] = 0.75

# Add a department model restriction:
DEPARTMENT_MODEL_BLOCKLIST["finance"] = {"claude_opus"}

# Add a new PII rule (regex, label, action):
PII_RULES.append((
    re.compile(r"\bIBAN\s*[A-Z]{2}\d{2}[\s\d]{15,30}\b"),
    "iban",
    "redact",
))
```

Changes to `policy_config.py` are captured in git history, giving you a full audit trail of policy evolution.
