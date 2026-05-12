# Issue: Add real-time governance event stream to dashboard

**Labels:** `enhancement` · `frontend` · `backend` · `dashboard`

## Description

The governance dashboard currently shows historical data (last 30 days). For operational use, operators want to see policy decisions as they happen. This issue tracks adding a live event feed using Server-Sent Events (SSE) or polling.

## Acceptance criteria

- [ ] A "Live Feed" section on `/governance` page showing the last 10 governance events, updating without page refresh
- [ ] New events appear at the top with a subtle fade-in animation
- [ ] Each event shows: timestamp, decision badge, user email, flag count, risk score
- [ ] Polling interval: 10 seconds (SSE preferred; polling acceptable as simpler fallback)
- [ ] Feed can be paused/resumed with a toggle button
- [ ] Feed gracefully handles backend unavailability (shows "reconnecting…" state)

## Backend approach (option A — SSE)

Add a streaming endpoint to `backend/routes/governance.py`:

```python
from fastapi.responses import StreamingResponse
import asyncio, json

@router.get("/stream")
async def stream_events(_: User = Depends(require_admin)):
    async def event_generator():
        last_seen = datetime.utcnow()
        while True:
            await asyncio.sleep(5)
            # query events since last_seen
            # yield as SSE
            yield f"data: {json.dumps(events)}\n\n"
            last_seen = datetime.utcnow()
    return StreamingResponse(event_generator(), media_type="text/event-stream")
```

## Frontend approach (option B — polling, simpler)

```typescript
useEffect(() => {
  if (!isLive) return
  const id = setInterval(async () => {
    const res = await api.getGovernanceEvents({ limit: 10, days: 1 })
    setLiveEvents(res.data.events)
  }, 10_000)
  return () => clearInterval(id)
}, [isLive])
```

Polling is acceptable for v1 and avoids SSE complexity. Start with polling; upgrade to SSE if there's demand.

## UI notes

- Render events as a scrollable list, newest first
- Use the existing `badge` CSS classes for decision labels
- Animate new events with `fade-up` CSS class (already in globals.css)
- "Live" indicator: blinking green dot (`.pulse-dot`)

## Suggested files to modify

- `frontend/app/governance/page.tsx` — add live feed section
- `backend/routes/governance.py` — add polling endpoint or SSE stream
