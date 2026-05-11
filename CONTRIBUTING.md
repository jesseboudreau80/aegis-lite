# Contributing to Aegis Lite

Thank you for your interest in contributing. This guide covers everything you need to get started.

## Code of Conduct

This project follows the [Contributor Covenant](CODE_OF_CONDUCT.md). Be respectful, inclusive, and constructive.

## Ways to contribute

- **Bug reports** — open a GitHub issue with steps to reproduce
- **Feature requests** — open an issue describing the use case
- **Pull requests** — see the workflow below
- **Documentation** — improvements to docs/ are always welcome
- **Policy rules** — additions to the policy engine are especially valuable

## Development setup

```bash
git clone https://github.com/jesseboudreau80/aegis-lite.git
cd aegis-lite

# Backend
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp ../.env.example .env
LOCAL_DEV=true uvicorn main:app --reload --port 8100

# Frontend (separate terminal)
cd frontend
npm install
npm run dev
```

## Pull request workflow

1. Fork the repository and create a feature branch from `main`
2. Make your changes — keep each PR focused on one concern
3. Run the test suite: `cd backend && python -m pytest`
4. Run frontend type-check: `cd frontend && npm run build`
5. Open a PR with a clear description of the change and why

## Policy engine contributions

Policy rules in `backend/config/policy_config.py` and the engine in `backend/services/policy_engine.py` are the highest-value area for community contributions. When adding rules:

- Add the constant to `policy_config.py` (not inline in the engine)
- Document the pattern in a comment with the rationale
- Add a test in `backend/tests/test_policy_engine.py`
- Ensure the rule does not produce false positives on normal prompts

## What belongs in Lite vs. Enterprise

Aegis Lite is the open core. Features that require organizational coordination, cloud scale, or infrastructure-level access belong in the enterprise layer. When in doubt, open an issue to discuss.

**Always welcome in Lite:**
- New policy engine rules
- Additional model providers
- UI improvements to the governance dashboard
- Developer experience improvements
- Documentation and examples

## Commit messages

Use the imperative mood: "Add PII rule for IBAN numbers" not "Added IBAN rule".

## License

By contributing, you agree that your contributions will be licensed under the Apache License 2.0.
