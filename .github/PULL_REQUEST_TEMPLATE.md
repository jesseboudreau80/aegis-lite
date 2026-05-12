## Summary

<!-- Describe what this PR changes and why. One paragraph. -->

## Type of change

- [ ] Bug fix
- [ ] New feature / enhancement
- [ ] Policy engine rule (new detection pattern)
- [ ] Documentation
- [ ] Tests
- [ ] Refactor (no behavior change)
- [ ] Deployment / infrastructure

## Related issue

Closes #

## Changes

<!-- List the files changed and briefly explain what each does -->

-
-

## Testing

- [ ] Backend tests pass: `cd backend && LOCAL_DEV=true PYTHONPATH=. pytest tests/`
- [ ] Frontend build passes: `cd frontend && npm run build`
- [ ] Manually tested the affected flow end-to-end
- [ ] Relevant tests added or updated

## Policy engine changes (if applicable)

<!-- Skip this section if no policy rules were added or modified -->

- [ ] New rule constants added to `config/policy_config.py` (not inline)
- [ ] Detection method added to `services/policy_engine.py`
- [ ] Rule trace fires with correct flag and risk delta
- [ ] Test cases cover: trigger, non-trigger, and edge cases
- [ ] False positive risk assessed

## Security checklist

- [ ] No secrets, API keys, or credentials in changed files
- [ ] No new unauthenticated endpoints added without justification
- [ ] No new SQL queries that could be injection vectors
- [ ] `LOCAL_DEV`-gated code never reaches authenticated paths

## Screenshots (for UI changes)

<!-- Paste before/after screenshots here if this is a visual change -->

## Notes for reviewer

<!-- Anything the reviewer should know about approach decisions, trade-offs, or follow-up work -->
