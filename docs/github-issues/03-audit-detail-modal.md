# Issue: Improve audit detail panel in the explorer

**Labels:** `enhancement` · `frontend` · `dashboard`

## Description

The audit explorer (`/governance/audit`) shows a split-panel view when an event is selected, but the detail panel currently shows limited information. This issue tracks enriching the detail view with the full rule trace, risk breakdown, and better data presentation.

## Current state

Clicking an audit row opens a right-side panel showing: timestamp, user, model, decision, cost, and the prompt text. Missing:

- Risk score with visual indicator
- Rule trace (which rules fired and with what delta)
- Tokens in/out
- Policy version
- Full response text (if available)

## Acceptance criteria

- [ ] Risk score displayed with a color-coded indicator (green < 0.25, yellow < 0.60, orange < 0.85, red ≥ 0.85)
- [ ] Rule trace rendered as an ordered list showing: rule name, flag, risk delta, and note
- [ ] Token counts (in / out / total) displayed
- [ ] Policy version shown
- [ ] Detail panel fetches full data from `GET /governance/audit/{id}` (not just the row data)
- [ ] Panel smoothly animates in (CSS transition, no library required)
- [ ] Works correctly on mobile (panel becomes bottom sheet on small screens)

## Technical notes

The `GET /governance/audit/{id}` endpoint exists and returns:

```json
{
  "id": "...",
  "timestamp": "...",
  "model": "...",
  "decision": "allow|warn|modify|escalate|block",
  "risk_score": 0.35,
  "flags": ["pii_detected", "email_detected"],
  "prompt_full": "...",
  "response_full": "...",
  "rule_trace": [
    {"rule": "_check_pii", "flag": "email_detected", "risk_delta": 0.20, "note": "email found in request"},
    ...
  ],
  "tokens_in": 145,
  "tokens_out": 320,
  "cost": 0.000045
}
```

The detail panel should call this on row selection (not preloaded):

```typescript
useEffect(() => {
  if (!selected) return
  api.getAuditDetail(selected.id).then(r => setDetail(r.data))
}, [selected?.id])
```

## Suggested files to modify

- `frontend/app/governance/audit/page.tsx` — enrich the detail panel, add loading state while fetching full detail
- `frontend/lib/api.ts` — `getAuditDetail` already exists

## Design direction

Match the existing dark theme. Risk score: use a small colored pill or horizontal bar. Rule trace: monospace font, left border colored by delta magnitude (green = low, red = high). No external charting library.
