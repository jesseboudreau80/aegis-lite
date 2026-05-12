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
from database import AsyncSessionLocal, init_db
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
    await init_db()

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

        # Seed built-in agents
        for a in BUILTIN_AGENTS:
            result = await db.execute(select(Agent).where(Agent.slug == a["slug"]))
            if not result.scalar_one_or_none():
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
from routes.auth_routes import router as auth_router
from routes.agents import router as agents_router
from routes.audit import router as audit_router
from routes.chat import router as chat_router
from routes.conversations import router as conversations_router
from routes.governance import router as governance_router
from routes.registry import router as registry_router
from routes.research import router as research_router
from routes.status import router as status_router
from routes.support import router as support_router
from routes.training import router as training_router
from routes.usage import router as usage_router
from routes.users import router as users_router

app.include_router(auth_router)
app.include_router(agents_router)
app.include_router(audit_router)
app.include_router(chat_router)
app.include_router(conversations_router)
app.include_router(governance_router)
app.include_router(registry_router)
app.include_router(research_router)
app.include_router(status_router)
app.include_router(support_router)
app.include_router(training_router)
app.include_router(usage_router)
app.include_router(users_router)


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


@app.get("/models")
async def list_models():
    return ui_models()
