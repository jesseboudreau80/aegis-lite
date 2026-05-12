# Issue: Add governance report export (JSON + CSV)

**Labels:** `enhancement` · `backend` · `frontend`

## Description

Compliance teams need to export governance data for audits, incident reports, and regulatory reviews. This issue tracks adding export functionality to the audit explorer: download a filtered set of audit events as JSON or CSV.

## Use case

A compliance officer filters the audit explorer to `decision=block` over the last 30 days, then downloads the result as CSV to attach to a quarterly audit report.

## Acceptance criteria

- [ ] New backend endpoint: `GET /governance/audit/export` with same filter params as the main audit endpoint
- [ ] Returns either `application/json` or `text/csv` based on `Accept` header or `format=json|csv` query param
- [ ] CSV includes columns: `timestamp, user_email, model, decision, risk_score, flags, cost_usd, prompt_preview`
- [ ] JSON includes the same fields plus `id` and `rule_trace_summary`
- [ ] Export is capped at 10,000 rows with a clear warning if the result is truncated
- [ ] Frontend: "Export" button in the audit explorer toolbar, opens a small dropdown: JSON / CSV
- [ ] Exported filename includes the date range: `aegis-audit-2026-05-01-to-2026-05-31.csv`
- [ ] Admin access required (same as the audit endpoint)

## Backend implementation sketch

```python
# backend/routes/governance.py
@router.get("/audit/export")
async def export_audit(
    format: str = Query("csv", regex="^(csv|json)$"),
    days: int = Query(30, ge=1, le=365),
    decision: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
):
    # query with same filters as /audit, limit 10_000
    # if format == "csv": return StreamingResponse with text/csv
    # if format == "json": return list of dicts
```

For CSV, use Python's built-in `csv.DictWriter` with `io.StringIO` — no external library needed.

## Frontend implementation sketch

```tsx
const handleExport = async (format: 'csv' | 'json') => {
  const res = await api.get('/governance/audit/export', {
    params: { format, days: 30, decision: decisionFilter !== 'all' ? decisionFilter : undefined },
    responseType: 'blob',
  })
  const url = URL.createObjectURL(new Blob([res.data]))
  const a = document.createElement('a')
  a.href = url; a.download = `aegis-audit-${new Date().toISOString().slice(0,10)}.${format}`
  a.click()
}
```

## Suggested files to modify

- `backend/routes/governance.py` — add export endpoint
- `frontend/app/governance/audit/page.tsx` — add export button to toolbar
- `frontend/lib/api.ts` — add export API method
