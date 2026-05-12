# Issue: Add integration test suite for AI provider dispatch

**Labels:** `testing` · `backend`

## Description

The AI router (`backend/services/ai_router.py`) dispatches to multiple providers (Anthropic, OpenAI, OpenRouter, Perplexity) with no automated test coverage. Regressions in provider dispatch are only caught at runtime. This issue tracks adding integration tests that verify correct dispatch logic without making real API calls.

## Acceptance criteria

- [ ] Test file created at `backend/tests/test_ai_router.py`
- [ ] All provider dispatch paths covered using mock patches (no real API calls)
- [ ] Tests verify demo-mode fallback when no API key is configured
- [ ] Tests verify that the correct `_demo_response` is returned for each model when key is empty
- [ ] Tests verify that policy blocking raises `PolicyBlockedError`
- [ ] Tests verify model override from routing engine (budget exceeded → free fallback)
- [ ] Tests verify that post-response PII scanning redacts content in the returned text

## Technical notes

Mock the provider functions to avoid real API calls:

```python
from unittest.mock import AsyncMock, patch
import pytest

@pytest.mark.asyncio
async def test_anthropic_demo_mode():
    """When ANTHROPIC_API_KEY is empty, returns demo response."""
    with patch("services.ai_router.settings") as mock_settings:
        mock_settings.anthropic_api_key = ""
        text, in_tok, out_tok, routing = await call_model(
            "claude_sonnet",
            [{"role": "user", "content": "Hello"}],
            None,
        )
    assert "Demo Mode" in text
    assert in_tok > 0

@pytest.mark.asyncio
async def test_policy_block_raises():
    """PolicyBlockedError raised when engine blocks request."""
    from services.policy_engine import PolicyBlockedError
    fake_user = FakeUser()
    ctx = build_policy_context(
        user=fake_user, model="claude_sonnet",
        prompt="sk-abc123def456ghi789jkl012",  # triggers secrets detection
        source="chat",
    )
    with pytest.raises(PolicyBlockedError):
        await call_model("claude_sonnet", [...], None,
                         user=fake_user, policy_context=ctx)
```

## What NOT to test here

- Real API correctness (that's the provider's responsibility)
- Specific response content (too brittle)
- Anything requiring a running database

## Suggested files to modify

- `backend/tests/test_ai_router.py` (create)
- `backend/requirements.txt` — add `pytest-asyncio` if not present

## Notes

Set `PYTHONPATH=.` when running tests from the `backend/` directory:
```bash
cd backend && LOCAL_DEV=true PYTHONPATH=. pytest tests/
```
