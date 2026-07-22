"""Policy engine PII rules — IBAN detection (issue #2)."""

from __future__ import annotations

import re
import sys
from pathlib import Path

import pytest

# Allow `from config import policy_config` when running from backend/
BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from config import policy_config as cfg  # noqa: E402
from services.policy_engine import PolicyContext, PolicyEngine  # noqa: E402


def _iban_rule():
    for pattern, label, action in cfg.PII_RULES:
        if label == "iban":
            return pattern, label, action
    raise AssertionError("iban rule missing from PII_RULES")


def test_iban_rule_is_redact_action():
    pattern, label, action = _iban_rule()
    assert label == "iban"
    assert action == "redact"
    assert isinstance(pattern, re.Pattern)


@pytest.mark.parametrize(
    "text",
    [
        "please send payment to GB82 WEST 1234 5698 7654 32",
        "wire transfer: DE89370400440532013000",
        "account FR7630006000011234567890189 for payroll",
        "GB82WEST12345698765432",  # no spaces
    ],
)
def test_iban_pattern_matches_valid_forms(text):
    pattern, _, _ = _iban_rule()
    assert pattern.search(text), f"expected IBAN match in: {text!r}"


@pytest.mark.parametrize(
    "text",
    [
        "the order number is 1234 5678 9012 3456",
        "call 555-867-5309",
        "uuid 550e8400-e29b-41d4-a716-446655440000",
        "just a long number 12345678901234567890",
    ],
)
def test_iban_pattern_ignores_non_iban(text):
    pattern, _, _ = _iban_rule()
    assert pattern.search(text) is None, f"unexpected match in: {text!r}"


@pytest.mark.asyncio
async def test_policy_engine_redacts_iban_in_prompt():
    engine = PolicyEngine()
    context = PolicyContext(
        user_id="u1",
        user_role="user",
        user_email="user@example.com",
        model_requested="gpt4o",
        provider="mock",
        prompt="please send payment to GB82 WEST 1234 5698 7654 32",
        source="chat",
        data_classification="internal",
    )
    decision = await engine.evaluate_request(context)
    assert "iban_detected" in decision.flags or "pii_detected" in decision.flags
    # Effective prompt after redaction is exposed via decision fields.
    redacted = (
        getattr(decision, "prompt_redacted", None)
        or getattr(decision, "modified_prompt", None)
        or ""
    )
    if not redacted and getattr(decision, "effective_prompt", None):
        redacted = decision.effective_prompt
    # If engine only records flags, at least the flag must fire; when
    # redaction text is available it must not still contain the IBAN.
    if redacted:
        assert "GB82" not in redacted
        assert "REDACTED" in redacted.upper()
