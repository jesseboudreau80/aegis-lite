# Issue: Write AGENT_SYSTEM.md documentation

**Labels:** `good-first-issue` · `documentation`

## Description

`docs/AGENT_SYSTEM.md` is referenced in the README but does not exist. This document should explain the agent framework architecture, how built-in agents are defined, how user-created agents are governed, and how to create a new agent.

## Why this matters

The agent framework is one of the most differentiated features of Aegis Lite. Without documentation, contributors and users can't understand how governance applies to agent executions or how to build new agents.

## Acceptance criteria

- [ ] File created at `docs/AGENT_SYSTEM.md`
- [ ] Covers the difference between builtin and user_created agent types
- [ ] Explains the `BUILTIN_AGENTS` registry in `config/agent_registry.py`
- [ ] Documents all fields in an agent definition (slug, name, system_prompt, allowed_models, budget_limit_usd, etc.)
- [ ] Explains how the policy engine applies to agent executions
- [ ] Shows the execution trace structure returned from a `POST /agents/{id}/run`
- [ ] Includes a step-by-step guide for creating a new built-in agent
- [ ] Includes a step-by-step guide for users creating a custom agent via the UI
- [ ] Documents the allowed_models enforcement logic
- [ ] < 600 lines — prioritize clarity over completeness

## Content outline

```markdown
# Agent System

## Overview
## Agent types
  - Built-in agents
  - User-created agents
## Agent definition schema
## How governance applies to agents
  - Policy evaluation on every run
  - Model allowlist enforcement
  - Budget limit enforcement
  - Execution trace
## Creating a built-in agent
  1. Edit config/agent_registry.py
  2. Define all required fields
  3. Restart the backend (auto-seeded on startup)
## Creating a user-created agent (UI)
## API reference
  - GET /agents
  - GET /agents/{id}
  - POST /agents
  - POST /agents/{id}/run
## Example execution trace
```

## Suggested files to modify

- `docs/AGENT_SYSTEM.md` (create)
- `README.md` — verify the link to this doc is correct after creation
