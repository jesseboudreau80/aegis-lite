# Issue: Write unit tests for the policy engine rule chain

**Labels:** `good-first-issue` · `testing` · `backend` · `policy`

## Description

The policy engine in `backend/services/policy_engine.py` is the most critical component in Aegis Lite and currently has zero test coverage. This issue tracks creating a complete unit test suite for the 10 rule evaluation methods.

## Why this matters

The policy engine is the security-critical path for every AI request. Without tests:
- Rule changes can silently break existing detection
- Risk score calculations are unverified
- Force-flag logic may have edge cases
- False positives/negatives go undetected before deployment

## Acceptance criteria

- [ ] Test file created at `backend/tests/test_policy_engine.py`
- [ ] Each of the 10 rule methods has at least 3 test cases: trigger, pass, edge case
- [ ] Risk score accumulation is verified for multi-flag scenarios
- [ ] Force-flag override logic is tested (`FORCE_BLOCK_FLAGS`, `FORCE_ESCALATE_FLAGS`)
- [ ] Decision resolution (`allow → warn → escalate → block`) is verified
- [ ] PII redaction output is verified (content modified correctly)
- [ ] All tests pass with `pytest backend/tests/test_policy_engine.py`

## Technical notes

The engine is a stateless class — tests can instantiate `PolicyEngine()` directly without any DB or HTTP stack:

```python
import asyncio
from services.policy_engine import PolicyEngine, build_policy_context

engine = PolicyEngine()

class FakeUser:
    id = "test-user"
    role = "user"
    email = "test@example.com"
    department = None

ctx = build_policy_context(
    user=FakeUser(),
    model="claude_sonnet",
    prompt="Your test prompt here",
    source="chat",
)

decision = asyncio.run(engine.evaluate_request(ctx))
assert decision.decision == "allow"
```

## Rule methods to test

| Method | What to test |
|--------|-------------|
| `_check_secrets` | OpenAI key → block; normal text → pass; partial key → pass |
| `_check_model_access` | user role + claude_opus → override; admin → pass; no fallback → deny |
| `_check_agent_permissions` | model outside allowlist → override; matching model → pass |
| `_check_data_classification` | "confidential" keyword → classification raised; external provider + confidential → escalate |
| `_check_pii` | email address → redact; SSN pattern → redact; no PII → pass |
| `_check_prompt_injection` | injection phrase → flag; high count → escalate; normal → pass |
| `_check_sensitive_keywords` | "lawsuit" → flag; "hello world" → pass |
| `_check_research_outbound` | source=research + restricted → block; source=chat → pass |
| `_check_tool_grants` | user + code_execution → deny; admin → pass |
| `_apply_risk_behavior_controls` | warn decision → system prompt injected |

## Suggested files to modify

- `backend/tests/__init__.py` (create)
- `backend/tests/test_policy_engine.py` (create)
- `backend/requirements.txt` (add `pytest`, `pytest-asyncio` if not present)

## Good-first-issue guidance

This is self-contained Python testing work — no need to understand the full stack. Read `backend/services/policy_engine.py` and `backend/config/policy_config.py` to understand the rule constants, then write pytest functions that verify each rule method.

Use `pytest.mark.asyncio` for the async evaluate methods.
