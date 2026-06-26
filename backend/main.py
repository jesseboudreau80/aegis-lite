import uuid
from contextlib import asynccontextmanager
from datetime import datetime

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import select

from config.agent_registry import BUILTIN_AGENTS
from config.model_costs import MODEL_INFO
from config.model_registry import ui_models
from config.settings import settings
from database import AsyncSessionLocal, init_db, run_column_migrations
from models import Agent, SupportRoutingMatrix, User


# ── Demo users seeded on startup ──────────────────────────────────────────────
_DEMO_USERS = [
    {
        "name":               "Admin User",
        "email":              "admin@example.com",
        "role":               "admin",
        "monthly_budget_usd": 100.0,
        "training_completed": True,
    },
    {
        "name":               "Demo User",
        "email":              "demo@example.com",
        "role":               "user",
        "monthly_budget_usd": 20.0,
        "training_completed": False,
    },
]

# ── Default support routing matrix ───────────────────────────────────────────
_DEFAULT_ROUTING_MATRIX = [
    {
        "department":       "HR",
        "issue_keywords":   ["payroll", "salary", "benefits", "pto", "vacation", "leave",
                             "onboarding", "offboarding", "performance review", "overtime"],
        "issue_categories": ["payroll", "benefits", "time_off", "onboarding", "performance"],
        "contact_email":    "hr@example.com",
        "contact_name":     "HR Team",
        "priority":         3,
    },
    {
        "department":       "IT",
        "issue_keywords":   ["login", "password", "vpn", "laptop", "software", "hardware",
                             "email", "slack", "system", "access", "account", "wifi"],
        "issue_categories": ["account_access", "hardware", "software", "connectivity"],
        "contact_email":    "it@example.com",
        "contact_name":     "IT Helpdesk",
        "priority":         2,
    },
    {
        "department":       "Finance",
        "issue_keywords":   ["expense", "reimbursement", "invoice", "budget", "purchase",
                             "vendor", "billing", "payment", "receipt"],
        "issue_categories": ["expenses", "invoicing", "budgets", "payments"],
        "contact_email":    "finance@example.com",
        "contact_name":     "Finance Team",
        "priority":         4,
    },
    {
        "department":       "Legal & Compliance",
        "issue_keywords":   ["contract", "legal", "compliance", "policy", "nda", "audit",
                             "gdpr", "privacy", "liability", "regulatory"],
        "issue_categories": ["legal", "compliance", "privacy", "contracts"],
        "contact_email":    "legal@example.com",
        "contact_name":     "Legal Team",
        "priority":         1,
    },
    {
        "department":       "Operations",
        "issue_keywords":   ["facilities", "office", "supply", "equipment", "travel",
                             "scheduling", "maintenance", "parking"],
        "issue_categories": ["facilities", "supplies", "travel", "scheduling"],
        "contact_email":    "ops@example.com",
        "contact_name":     "Operations Team",
        "priority":         5,
    },
]


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Initialize the database and seed demo data on startup."""
    import time
    app.state.start_time = time.time()
    await init_db()
    await run_column_migrations()

    async with AsyncSessionLocal() as db:
        # Seed demo users
        for u in _DEMO_USERS:
            result = await db.execute(select(User).where(User.email == u["email"]))
            if not result.scalar_one_or_none():
                db.add(User(
                    id=str(uuid.uuid4()),
                    name=u["name"],
                    email=u["email"],
                    role=u["role"],
                    monthly_budget_usd=u["monthly_budget_usd"],
                    training_completed=u["training_completed"],
                    is_active=True,
                    created_at=datetime.utcnow(),
                ))

        # Seed built-in agents (upsert: update name/description/prompt on each restart)
        for a in BUILTIN_AGENTS:
            result = await db.execute(select(Agent).where(Agent.slug == a["slug"]))
            existing = result.scalar_one_or_none()
            if existing:
                existing.name          = a["name"]
                existing.description   = a.get("description", "")
                existing.system_prompt = a["system_prompt"]
                existing.updated_at    = datetime.utcnow()
            else:
                db.add(Agent(
                    id=str(uuid.uuid4()),
                    name=a["name"],
                    slug=a["slug"],
                    description=a.get("description", ""),
                    system_prompt=a["system_prompt"],
                    model=a.get("allowed_models", ["claude_sonnet"])[0],
                    agent_type="builtin",
                    is_active=True,
                    budget_limit_usd=a.get("budget_limit_usd"),
                    allowed_models=a.get("allowed_models"),
                    created_at=datetime.utcnow(),
                    updated_at=datetime.utcnow(),
                ))

        # Seed support routing matrix
        for entry in _DEFAULT_ROUTING_MATRIX:
            result = await db.execute(
                select(SupportRoutingMatrix).where(SupportRoutingMatrix.department == entry["department"])
            )
            if not result.scalar_one_or_none():
                db.add(SupportRoutingMatrix(
                    id=str(uuid.uuid4()),
                    department=entry["department"],
                    issue_keywords=entry["issue_keywords"],
                    issue_categories=entry["issue_categories"],
                    contact_email=entry["contact_email"],
                    contact_name=entry["contact_name"],
                    priority=entry["priority"],
                    is_active=True,
                ))

        await db.commit()

    yield


app = FastAPI(
    title=settings.app_name,
    version="1.0.0",
    description="Aegis Lite — Open-source AI governance and orchestration workspace.",
    lifespan=lifespan,
)

# ── CORS ──────────────────────────────────────────────────────────────────────
allowed_origins = [o.strip() for o in settings.cors_origins.split(",") if o.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── JWT middleware ─────────────────────────────────────────────────────────────
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request


class JWTMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        from services.auth_service import decode_access_token
        auth = request.headers.get("Authorization", "")
        if auth.startswith("Bearer "):
            payload = decode_access_token(auth[7:])
            if payload:
                request.state.jwt_email = payload.get("sub")
        return await call_next(request)


app.add_middleware(JWTMiddleware)

# ── Routes ────────────────────────────────────────────────────────────────────
from routes.assistant import router as assistant_router
from routes.auth_routes import router as auth_router
from routes.early_access import router as early_access_router
from routes.agents import router as agents_router
from routes.audit import router as audit_router
from routes.chat import router as chat_router
from routes.conversations import router as conversations_router
from routes.executive import router as executive_router
from routes.governance import router as governance_router
from routes.knowledge import router as knowledge_router
from routes.playbooks import router as playbooks_router
from routes.registry import router as registry_router
from routes.research import router as research_router
from routes.status import router as status_router
from routes.support import router as support_router
from routes.training import router as training_router
from routes.usage import router as usage_router
from routes.users import router as users_router
from routes.workspaces import router as workspaces_router

app.include_router(assistant_router)
app.include_router(auth_router)
app.include_router(early_access_router)
app.include_router(agents_router)
app.include_router(audit_router)
app.include_router(chat_router)
app.include_router(conversations_router)
app.include_router(executive_router)
app.include_router(governance_router)
app.include_router(knowledge_router)
app.include_router(playbooks_router)
app.include_router(registry_router)
app.include_router(research_router)
app.include_router(status_router)
app.include_router(support_router)
app.include_router(training_router)
app.include_router(usage_router)
app.include_router(users_router)
app.include_router(workspaces_router)


# ── Health ────────────────────────────────────────────────────────────────────

@app.get("/health")
async def health():
    return {
        "status":    "ok",
        "edition":   settings.aegis_edition,
        "version":   "1.0.0",
        "demo_mode": settings.demo_mode,
        "models":    len(MODEL_INFO),
    }


@app.get("/whoami")
async def whoami():
    """Identity endpoint."""
    return {
        "app":         "Aegis Lite API",
        "version":     "1.0.0",
        "port":        8107,
        "edition":     settings.aegis_edition,
        "environment": "production",
        "owner":       "jesse",
    }


@app.get("/.well-known/aegis-meta")
async def aegis_meta():
    """Aegis Pack Specification V1 — machine-readable identity and capability declaration."""
    import time, os
    start_time = getattr(app.state, "start_time", None)
    uptime_s = int(time.time() - start_time) if start_time else None
    return {
        "pack_id":              "aegis-lite",
        "pack_name":            "Aegis Lite",
        "version":              "1.0.0",
        "environment":          "production",
        "frontend_port":        3007,
        "backend_port":         8107,
        "auth_required":        True,
        "governance_enabled":   True,
        "replay_supported":     False,
        "observability_supported": False,
        "systemd_service":      "aegis-lite.service",
        "tunnel_name":          "reselleros",
        "uptime_s":             uptime_s,
        "build_sha":            os.environ.get("GIT_SHA", None),
        "owner":                "jesse",
        "doctrine_version":     "2026-05-18",
        "runtime_type":         "nextjs+fastapi",
        "capabilities":         ["chat", "agents", "audit", "governance", "training", "research",
                                 "playbooks", "knowledge", "workspaces", "executive"],
    }


@app.get("/models")
async def list_models():
    return ui_models()
