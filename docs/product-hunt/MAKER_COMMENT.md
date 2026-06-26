# Maker Comment — Pin This Immediately on Launch

This is the single most important piece of content on launch day.
Post it as your first comment within 60 seconds of the listing going live.
It will be pinned and is the first thing every visitor reads.

---

## THE COMMENT (copy-paste ready)

---

Hey Product Hunt 👋 I'm Jesse, the maker.

I built Aegis Lite because I kept running into the same conversation at every AI deployment:

> *"This is incredible — but before we roll it out, what governance controls do we have?"*

The answer was always the same: "we're working on it." The tools that existed were either vendor-locked (AWS Guardrails, Azure Content Safety) or built for ML researchers, not operators running AI in production.

So I built the enterprise version first — deployed it internally, stress-tested the policy engine against real threat classes, and got the audit logging tight enough to satisfy a CISO. Then I open-sourced the core.

**What Aegis Lite actually does:**

Every AI request — chat, agent run, research query — flows through a 10-rule deterministic policy engine *before* a token is dispatched. It evaluates PII exposure, secrets leakage, prompt injection, data classification violations, and content risk. The engine is purely deterministic — no LLM calls, no fuzzy scoring — which means it's auditable, testable, and fast.

The result: a full governance trace on every request. Risk score. Rule trace. Model. Cost. Tokens. Immutable audit record. All of it visible in the dashboard.

**Why open source:**

The governance layer for AI should not be owned by a single vendor. Every cloud provider has financial incentives to make their guardrails look sufficient. The control plane for how your organization runs AI should be auditable, forkable, and community-owned. Apache 2.0 means you can deploy it, modify it, and build on it — no licensing conversation with your legal team.

**Try the live demo:**

Send `My SSN is 123-45-6789` in the Chat and watch what happens. The enforcement banner shows exactly what fired and why — no black box. Login at https://aegis-lite.jesseboudreau.com with `admin@example.com` / `demo`.

**For contributors:**

The policy engine is the highest-value area for contributions right now. There are 17 pre-written issues with full technical context at `docs/github-issues/` — everything from IBAN detection rules to deployment guides to test coverage. The `good-first-issue` label is live on GitHub.

The things I want to build with the community: OAuth/SSO, more PII pattern classes, a real-time alert system, deployment guides for Railway/Fly.io/ECS, and a policy config editor in the dashboard.

Happy to answer anything — drop questions here and I'll respond throughout the day.

— Jesse
[jesseboudreau.com](https://jesseboudreau.com) · [github.com/jesseboudreau80](https://github.com/jesseboudreau80)

---

## FOLLOW-UP COMMENT TEMPLATES

Use these to respond to common questions. Keep responses fast — first 2 hours matter most.

### "How does this compare to [AWS Guardrails / Azure Content Safety]?"

> The core difference is ownership and architecture. AWS Guardrails and Azure Content Safety are vendor-managed black boxes running inside their own clouds. You can't inspect the rules, fork the logic, or deploy it outside their infrastructure. Aegis Lite runs on your infrastructure, the policy engine is fully inspectable, and every decision is traceable. The governance logic lives in your stack, not theirs.

### "How does this compare to LangChain / LlamaIndex guardrails?"

> LangChain and LlamaIndex have guard-like features but they're designed for orchestration, not governance. Their safety features are best-effort additions. Aegis Lite inverts the architecture: governance is the primary layer, AI access flows through it. Policy decisions happen before inference, not alongside it.

### "Why deterministic and not LLM-based evaluation?"

> A few reasons: LLM-based content evaluation is slow (adds 1-3 seconds per request), expensive (you're paying to evaluate every prompt), and non-deterministic (the same input can produce different decisions). Most critically for compliance: you can't write an audit log entry that says "blocked because the evaluator model felt this was risky." Deterministic rules produce an exact trace — which rule fired, with what parameters, at what risk delta. That's what compliance evidence actually looks like.

### "Can I add custom policy rules?"

> Yes — the policy engine is fully extensible. Add constants to `config/policy_config.py`, add a detection method to `policy_engine.py`, and wire it into the chain. There's a full contributing guide and a policy rule issue template on GitHub specifically for this.

### "Is this production-ready?"

> The core is running in production at the demo URL right now and has been since v1.0. It's not v1.0 with asterisks — the policy engine, audit logging, and streaming inference are all production-stable. The areas still maturing are test coverage (a priority in v1.1), Docker Compose deployment profiles, and OAuth/SSO. I'd say: production-ready for teams who understand they're adopting v1.x, not for mission-critical regulated environments without adding your own test layer first.

### "What models does it support?"

> Multi-provider routing out of the box: Anthropic (Claude), OpenAI (GPT-4o), OpenRouter (free tier — works with zero API key config, just add your OPENROUTER_API_KEY for higher limits), and Perplexity for research. Budget-aware fallback — if the preferred model exceeds budget, the router falls back to the next available provider. Adding a new provider is straightforward if it's OpenAI-compatible.

### "Is there a hosted/cloud version?"

> The live demo at aegis-lite.jesseboudreau.com is the public instance for evaluation. There's a full enterprise platform (not open-sourced) for teams who want a managed deployment. For now, Aegis Lite is self-hosted — that's intentional, because the governance layer for AI should run inside your perimeter, not in someone else's cloud.
