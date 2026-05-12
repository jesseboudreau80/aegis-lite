# Agent System

Aegis Lite supports two agent classes:

- built-in agents seeded from code at startup
- user-created agents created and edited through the API/UI

Both run through the same governance pipeline used by chat requests.

## Overview

The agent stack is split across these files:

- `backend/config/agent_registry.py` - built-in definitions
- `backend/main.py` - startup seeding into the `agents` table
- `backend/routes/agents.py` - CRUD + run endpoints
- `backend/services/policy_engine.py` - policy checks and model overrides
- `backend/services/trace_builder.py` - execution trace returned to clients
- `backend/models.py` - `Agent`, `AgentVersion`, `AgentExecution` tables

## Agent types

### Built-in (`agent_type = "builtin"`)

- Source of truth is `BUILTIN_AGENTS` in `backend/config/agent_registry.py`
- Seeded on startup in `backend/main.py` if slug does not already exist
- Cannot be edited or deleted via API (`PATCH`/`DELETE` return 403)
- Intended for org-wide baseline assistants

### User-created (`agent_type = "user_created"`)

- Created via `POST /agents`
- Editable by creator (or admin) via `PATCH /agents/{agent_id}`
- Soft-deletable via `DELETE /agents/{agent_id}` (`is_active = false`)
- Prompt revisions are versioned in `agent_versions`

## BUILTIN_AGENTS registry

`BUILTIN_AGENTS` is a list of dictionaries. Example entries include `support-assistant`, `sop-builder`, `decksmith`, `flow`, and `research-analyst`.

Common fields in each definition:

- `slug`: stable identifier used in URLs and lookups
- `name`: display name
- `description`: short purpose
- `category`: grouping (example: `research`, `operations`)
- `agent_type`: `builtin`
- `persona_name`: UX-facing persona label
- `system_prompt`: base instruction prompt
- `allowed_models`: allowlist for requested model selection
- `allowed_tools`: reserved for tool-gating context
- `budget_limit_usd`: per-agent budget metadata
- `daily_execution_limit`: intended per-day cap metadata
- `visibility`: example `org`
- `published`: whether shown as published
- `has_guided_flow`: whether guided flow is enabled
- `guided_flow`: guided flow payload (or `None`)
- `version`: definition version

Important: startup seeding currently persists this subset into the `agents` table:
`slug`, `name`, `description`, `system_prompt`, `model` (first allowed model), `agent_type`, `budget_limit_usd`, and `allowed_models`.

## Agent definition schema

Persisted agent fields (`backend/models.py`, `Agent`):

- `id` (UUID)
- `name`
- `slug` (unique)
- `description`
- `system_prompt`
- `model` (default run model)
- `agent_type` (`builtin` or `user_created`)
- `is_active`
- `budget_limit_usd`
- `allowed_models` (JSON list)
- `created_by`
- `created_at`, `updated_at`

Version history fields (`AgentVersion`):

- `agent_id`
- `version`
- `system_prompt`
- `model`
- `change_note`
- `created_by`, `created_at`

Execution log fields (`AgentExecution`):

- `agent_id`, `user_id`
- `prompt`, `response`
- `model`
- `cost_usd`
- `status` (`success`, `blocked`, `error`)
- `policy_decision`
- `execution_trace` (JSON list)
- `created_at`

## How governance applies to agents

`POST /agents/{agent_id}/run` follows this path:

1. Resolve agent by `id` or `slug`, require active.
2. Choose requested model: `req.model` or `agent.model`.
3. Apply immediate allowlist gate in route:
   - if `agent.allowed_models` exists and requested model is not in it, use `agent.allowed_models[0]`.
4. Build policy context (`source="agent"`) including:
   - `agent_id`, `agent_slug`, `agent_type`
   - `agent_allowed_models`
   - `agent_budget_limit`
5. Call `call_model(...)`:
   - routing engine does budget-aware model routing by user monthly budget
   - policy engine evaluates request pre-dispatch
   - policy can override model, redact prompt, inject governance system text, or block
6. On block:
   - log governance event
   - store `AgentExecution(status="blocked")`
   - return HTTP 403
7. On success:
   - persist execution + cost
   - build and return execution trace

### Allowed model enforcement logic

There are two enforcement layers:

- Route layer (`routes/agents.py`): hard gate to `allowed_models[0]` when requested model is outside the agent allowlist
- Policy layer (`services/policy_engine.py`): if effective model still violates agent allowlist, override to fallback priority within allowlist and add `agent_model_override` flag to trace

### Budget limit enforcement

- User monthly budget is actively enforced by `services/routing_engine.py` (downgrade to free fallback or block with 402).
- `agent_budget_limit` from the agent record is passed into policy context for governance metadata.
- Per-agent hard stop logic is not currently enforced as a separate runtime blocker in `routes/agents.py`.

## Execution trace shape (`POST /agents/{id}/run`)

Response payload includes:

- `execution_id`
- `agent`
- `response`
- `model_used`
- `fallback_used`
- `cost_usd`
- `execution_trace` (ordered list)

`execution_trace` steps come from `build_execution_trace(...)` and look like:

```json
[
  {
    "stage": "rate_limit",
    "message": "Rate limit check",
    "status": "complete"
  },
  {
    "stage": "policy",
    "message": "Policy: modify (agent_model_override)",
    "status": "warning",
    "metadata": {
      "risk_score": 0.1,
      "flags": ["agent_model_override"],
      "policy_version": "phase1"
    }
  },
  {
    "stage": "routing",
    "message": "Model: gpt4o_mini (fallback)",
    "status": "warning",
    "metadata": {
      "model": "gpt4o_mini",
      "fallback_used": true,
      "reason": "policy override to gpt4o_mini"
    }
  },
  {
    "stage": "response",
    "message": "Response generated - 812 tokens, $0.004210",
    "status": "complete",
    "metadata": {
      "total_tokens": 812,
      "cost_usd": 0.00421
    }
  }
]
```

## Creating a new built-in agent

1. Edit `backend/config/agent_registry.py`.
2. Add a new dictionary to `BUILTIN_AGENTS` with required values:
   - `slug`, `name`, `system_prompt`, `allowed_models`
   - plus metadata fields used by your org (`description`, `category`, `budget_limit_usd`, etc.)
3. Keep slug unique and stable.
4. Restart backend so startup seeding runs (`backend/main.py` lifespan).
5. Verify through API:
   - `GET /agents?agent_type=builtin`
   - `GET /agents/{slug}`
6. Run a smoke test:
   - `POST /agents/{slug}/run`
   - verify `execution_trace` and `model_used`

Note: seeding only inserts when slug does not exist. Existing rows are not auto-updated.

## Creating a user-created agent (UI/API)

1. Open the agents section in UI (or call `POST /agents`).
2. Provide:
   - `name`
   - optional `description`
   - `system_prompt`
   - `model`
   - optional `allowed_models`
   - optional `budget_limit_usd`
3. Save and verify:
   - `GET /agents`
   - `GET /agents/{id}`
4. Run it:
   - `POST /agents/{id}/run` with `message` and optional model override
5. Update prompt later with `PATCH /agents/{id}`:
   - prompt changes create a new `agent_versions` row
6. Deactivate if needed with `DELETE /agents/{id}` (soft delete)

## API reference

- `GET /agents` - list active agents (optional `agent_type` filter)
- `GET /agents/{agent_id}` - fetch by id or slug
- `POST /agents` - create a user-created agent
- `PATCH /agents/{agent_id}` - update user-created agent
- `DELETE /agents/{agent_id}` - deactivate user-created agent
- `POST /agents/{agent_id}/run` - execute an agent with governance + routing

