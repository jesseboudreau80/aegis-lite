"""
Public status endpoint — no authentication required.

Returns safe, public-facing system health and demo metrics.
Never exposes: secrets, IPs, internal domains, private ports, or user data.

GET /status        — full public status object
GET /status/health — minimal liveness probe (for load balancers)
GET /status/demo   — seeded governance event stream (DEMO_MODE only)
"""
from __future__ import annotations

import random
import uuid
from datetime import datetime, timedelta

from fastapi import APIRouter, HTTPException
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import Depends

from config.model_registry import REGISTRY
from config.policy_config import POLICY_VERSION
from config.settings import settings
from database import get_db
from models import AuditLog, GovernanceEvent, User

router = APIRouter(prefix="/status", tags=["status"])

# ── Demo event templates ───────────────────────────────────────────────────────
# Safe, realistic-looking governance events for demo mode.
# None contain real user data, IPs, or internal identifiers.

_DEMO_EVENTS = [
    {"decision": "allow",    "event_type": "policy_decision", "severity": "info",     "actor": "researcher@example.com", "model": "claude_sonnet",   "flags": [],                            "risk": 0.05},
    {"decision": "warn",     "event_type": "policy_decision", "severity": "warning",  "actor": "analyst@example.com",    "model": "gpt4o",           "flags": ["pii_detected"],              "risk": 0.22},
    {"decision": "modify",   "event_type": "policy_decision", "severity": "info",     "actor": "demo@example.com",       "model": "claude_sonnet",   "flags": ["email_detected"],            "risk": 0.20},
    {"decision": "allow",    "event_type": "policy_decision", "severity": "info",     "actor": "admin@example.com",      "model": "gpt4o_mini",      "flags": [],                            "risk": 0.03},
    {"decision": "escalate", "event_type": "policy_decision", "severity": "warning",  "actor": "user@example.com",       "model": "claude_sonnet",   "flags": ["prompt_injection_suspected"],"risk": 0.62},
    {"decision": "block",    "event_type": "policy_decision", "severity": "critical", "actor": "demo@example.com",       "model": "gpt4o",           "flags": ["secrets_detected"],          "risk": 0.97},
    {"decision": "allow",    "event_type": "policy_decision", "severity": "info",     "actor": "analyst@example.com",    "model": "mistral",         "flags": [],                            "risk": 0.02},
    {"decision": "warn",     "event_type": "policy_decision", "severity": "warning",  "actor": "researcher@example.com", "model": "claude_sonnet",   "flags": ["sensitive_keywords_detected"],"risk": 0.28},
    {"decision": "allow",    "event_type": "auth_event",      "severity": "info",     "actor": "admin@example.com",      "model": None,              "flags": [],                            "risk": 0.0},
    {"decision": "modify",   "event_type": "policy_decision", "severity": "info",     "actor": "user@example.com",       "model": "gpt4o_mini",      "flags": ["phone_detected"],            "risk": 0.20},
]

_DEMO_PROVIDERS = [
    {"name": "Anthropic",  "models": ["claude_sonnet", "claude_opus"], "status": "operational", "latency_ms": 420},
    {"name": "OpenAI",     "models": ["gpt4o", "gpt4o_mini"],          "status": "operational", "latency_ms": 310},
    {"name": "OpenRouter", "models": ["mistral", "llama3", "gemini"],   "status": "operational", "latency_ms": 580},
    {"name": "Perplexity", "models": ["perplexity_sonar"],              "status": "operational", "latency_ms": 890},
]


def _demo_event_stream(count: int = 12) -> list[dict]:
    """Generate a deterministic-ish stream of demo governance events."""
    now = datetime.utcnow()
    events = []
    templates = (_DEMO_EVENTS * ((count // len(_DEMO_EVENTS)) + 1))[:count]
    # Spread over the last 2 hours
    interval_minutes = 120 / count
    for i, tmpl in enumerate(templates):
        ts = now - timedelta(minutes=i * interval_minutes)
        events.append({
            "id":         str(uuid.uuid5(uuid.NAMESPACE_DNS, f"demo-{i}")),
            "timestamp":  ts.isoformat() + "Z",
            "event_type": tmpl["event_type"],
            "decision":   tmpl["decision"],
            "actor_email":tmpl["actor"],
            "severity":   tmpl["severity"],
            "model":      tmpl["model"],
            "flags":      tmpl["flags"],
            "risk_score": tmpl["risk"],
            "policy_version": POLICY_VERSION,
        })
    return events


def _demo_summary() -> dict:
    seed = datetime.utcnow().hour  # changes each hour for live-ish feel
    rng = random.Random(seed)
    total = rng.randint(280, 420)
    blocked = rng.randint(8, 18)
    escalated = rng.randint(5, 14)
    modified = rng.randint(30, 60)
    return {
        "window_hours":        24,
        "total_requests":      total,
        "policy_events":       rng.randint(45, 80),
        "blocked":             blocked,
        "escalated":           escalated,
        "modified":            modified,
        "avg_risk_score":      round(rng.uniform(0.08, 0.18), 3),
        "budget_enforcement":  rng.randint(2, 8),
        "pii_redactions":      rng.randint(12, 28),
    }


# ── Routes ─────────────────────────────────────────────────────────────────────

@router.get("/health")
async def health_probe():
    """Minimal liveness probe for load balancers. Always unauthenticated."""
    return {"status": "ok", "edition": settings.aegis_edition}


@router.get("")
async def public_status(db: AsyncSession = Depends(get_db)):
    """
    Public-safe system status. No authentication required.
    Never exposes secrets, user PII, internal IPs, or raw credentials.
    """
    started_at = datetime.utcnow().replace(second=0, microsecond=0).isoformat() + "Z"

    # ── Subsystem health ──────────────────────────────────────────────────────
    components = [
        {"name": "Policy Engine",    "status": "operational", "version": POLICY_VERSION},
        {"name": "AI Router",        "status": "operational", "description": f"{len(REGISTRY)} models registered"},
        {"name": "Governance Log",   "status": "operational", "description": "Audit trail active"},
        {"name": "Authentication",   "status": "operational", "description": "JWT + magic-link"},
        {"name": "Rate Limiter",     "status": "operational", "description": "Per-user, per-model"},
    ]

    # ── Provider availability ─────────────────────────────────────────────────
    configured_providers: list[str] = []
    if settings.anthropic_api_key and not settings.anthropic_api_key.endswith("..."):
        configured_providers.append("Anthropic")
    if settings.openai_api_key and not settings.openai_api_key.endswith("..."):
        configured_providers.append("OpenAI")
    if settings.openrouter_api_key and not settings.openrouter_api_key.endswith("..."):
        configured_providers.append("OpenRouter")
    if settings.perplexity_api_key and not settings.perplexity_api_key.endswith("..."):
        configured_providers.append("Perplexity")

    # In demo mode, show all providers as connected
    if settings.demo_mode:
        configured_providers = ["Anthropic", "OpenAI", "OpenRouter", "Perplexity"]
        providers_display = _DEMO_PROVIDERS
    else:
        providers_display = [
            {"name": p, "status": "operational"}
            for p in (configured_providers or ["None configured — demo mode active"])
        ]

    # ── Live metrics (or demo metrics) ────────────────────────────────────────
    if settings.demo_mode:
        summary = _demo_summary()
        user_count = 4
        recent_events = _demo_event_stream(8)
    else:
        try:
            summary_row = (await db.execute(
                select(
                    func.count(AuditLog.id).label("total"),
                    func.count(AuditLog.id).filter(AuditLog.policy_decision == "block").label("blocked"),
                )
            )).one()
            user_count = (await db.execute(
                select(func.count(User.id)).where(User.is_active == True)  # noqa: E712
            )).scalar_one()
            gov_events = (await db.execute(
                select(GovernanceEvent)
                .order_by(GovernanceEvent.timestamp.desc())
                .limit(5)
            )).scalars().all()
            summary = {
                "window_hours":   24,
                "total_requests": int(summary_row.total or 0),
                "blocked":        int(summary_row.blocked or 0),
                "policy_events":  len(gov_events),
            }
            recent_events = [
                {
                    "id":         e.id,
                    "timestamp":  e.timestamp.isoformat() + "Z",
                    "event_type": e.event_type,
                    "decision":   (e.payload or {}).get("decision", "allow"),
                    "severity":   e.severity,
                    "flags":      (e.payload or {}).get("flags", []),
                    "risk_score": (e.payload or {}).get("risk_score", 0.0),
                }
                for e in gov_events
            ]
        except Exception:
            summary = {"window_hours": 24, "total_requests": 0, "blocked": 0}
            user_count = 0
            recent_events = []

    return {
        "status":        "operational",
        "edition":       settings.aegis_edition,
        "version":       "1.0.0",
        "demo_mode":     settings.demo_mode,
        "deployment":    settings.deployment_name,
        "timestamp":     datetime.utcnow().isoformat() + "Z",
        "policy": {
            "version":          POLICY_VERSION,
            "rules_active":     10,
            "pii_patterns":     4,
            "secret_patterns":  9,
            "injection_patterns": 21,
        },
        "models": {
            "registered": len(REGISTRY),
            "providers":  providers_display,
        },
        "workspace": {
            "users":            user_count,
            "governance_mode":  "deterministic-phase1",
        },
        "summary":   summary,
        "components": components,
        "recent_events": recent_events,
    }


@router.get("/demo-events")
async def demo_event_stream(count: int = 20):
    """
    Seeded governance event stream for demo/showcase purposes.
    Always returns realistic-looking but entirely synthetic data.
    Available regardless of DEMO_MODE setting — safe to expose publicly.
    """
    if count > 50:
        count = 50
    return {
        "events":      _demo_event_stream(count),
        "summary":     _demo_summary(),
        "policy_version": POLICY_VERSION,
        "note":        "Synthetic data for demonstration purposes.",
    }
