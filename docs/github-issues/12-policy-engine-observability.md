# Issue: Add Prometheus metrics endpoint to the policy engine

**Labels:** `enhancement` · `observability` · `backend` · `governance`

## Background

Aegis Lite has a rich governance event log, but no way to feed real-time policy metrics into standard monitoring infrastructure (Prometheus, Grafana, Datadog). Organizations deploying Aegis Lite in production need operational visibility into policy engine behavior at the metrics layer — not just the audit log.

## Why this matters

Without a metrics endpoint:
- Policy block rates are invisible to on-call monitoring
- Budget exhaustion events don't page anyone
- Risk score trends aren't available for anomaly detection dashboards
- Organizations can't set alerts on governance metrics

## Acceptance criteria

- [ ] New endpoint `GET /metrics` returning Prometheus text format (no library required — plain text format)
- [ ] Metrics include:
  - `aegis_policy_requests_total{decision="allow|warn|modify|escalate|block"}` — counter
  - `aegis_policy_risk_score_histogram` — histogram of risk scores (buckets: 0, .25, .60, .85, 1.0)
  - `aegis_budget_exhaustion_total` — counter of requests routed due to budget exhaustion
  - `aegis_model_requests_total{model="..."}` — counter per model
  - `aegis_active_users_total` — gauge of users with > 0 usage this month
- [ ] Metrics are computed from the last 24 hours of `AuditLog` and `GovernanceEvent` data
- [ ] Endpoint is accessible without authentication (Prometheus scrape is typically unauthenticated)
- [ ] Documentation added to `docs/SETUP.md` explaining how to configure a Prometheus scrape job

## Implementation sketch

```python
# backend/routes/metrics.py
from fastapi import APIRouter
from fastapi.responses import PlainTextResponse

router = APIRouter()

@router.get("/metrics", response_class=PlainTextResponse, include_in_schema=False)
async def prometheus_metrics(db: AsyncSession = Depends(get_db)):
    """Prometheus text format metrics."""
    lines = [
        "# HELP aegis_policy_requests_total Policy decisions by outcome",
        "# TYPE aegis_policy_requests_total counter",
    ]
    # Query governance events for the last 24h and aggregate
    # ...
    return "\n".join(lines) + "\n"
```

No external prometheus-client library needed — Prometheus text format is simple:

```
metric_name{label="value"} 42
```

## Notes

- 24h window avoids unbounded DB scans; add a `?window=1h|24h|7d` query param for flexibility
- If `prometheus-fastapi-instrumentator` is added as a dependency, basic HTTP metrics (latency, status codes) come for free — but it's optional
- This endpoint should be documented as something to put behind network-level access control in production (firewall or nginx `allow` rules)

## Suggested files to modify

- `backend/routes/metrics.py` (create)
- `backend/main.py` (register the router)
- `docs/SETUP.md` (add Prometheus scrape config example)
