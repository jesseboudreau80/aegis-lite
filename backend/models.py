import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Integer, JSON, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from database import Base


def _uuid() -> str:
    return str(uuid.uuid4())


# ── Core gateway models ────────────────────────────────────────────────────────

class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    name: Mapped[str] = mapped_column(String(100))
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    role: Mapped[str] = mapped_column(String(20), default="user")  # admin | user
    monthly_budget_usd: Mapped[float] = mapped_column(Float, default=20.0)
    current_usage_usd: Mapped[float] = mapped_column(Float, default=0.0)
    training_completed: Mapped[bool] = mapped_column(Boolean, default=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    conversations: Mapped[list["Conversation"]] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )
    audit_logs: Mapped[list["AuditLog"]] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )
    rate_limits: Mapped[list["RateLimitEntry"]] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )
    agent_executions: Mapped[list["AgentExecution"]] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )
    research_sessions: Mapped[list["ResearchSession"]] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )
    support_sessions: Mapped[list["SupportSession"]] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )


class Conversation(Base):
    __tablename__ = "conversations"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"), index=True)
    title: Mapped[str] = mapped_column(String(200), default="New Conversation")
    model: Mapped[str] = mapped_column(String(50), default="claude_sonnet")
    system_id: Mapped[Optional[str]] = mapped_column(String(36), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user: Mapped["User"] = relationship(back_populates="conversations")
    messages: Mapped[list["Message"]] = relationship(
        back_populates="conversation", cascade="all, delete-orphan"
    )


class Message(Base):
    __tablename__ = "messages"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    conversation_id: Mapped[str] = mapped_column(String(36), ForeignKey("conversations.id"), index=True)
    role: Mapped[str] = mapped_column(String(20))  # user | assistant
    content: Mapped[str] = mapped_column(Text)
    model: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    cost_usd: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    input_tokens: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    output_tokens: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    conversation: Mapped["Conversation"] = relationship(back_populates="messages")


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    user_id: Mapped[Optional[str]] = mapped_column(String(36), ForeignKey("users.id"), nullable=True, index=True)
    event_type: Mapped[str] = mapped_column(String(50), default="chat", index=True)
    model: Mapped[Optional[str]] = mapped_column(String(50), nullable=True, index=True)
    prompt: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    response: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    estimated_input_tokens: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    estimated_output_tokens: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    estimated_cost: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    status: Mapped[str] = mapped_column(String(20), default="success")  # success | blocked | error
    policy_decision: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    metadata_: Mapped[Optional[dict]] = mapped_column("metadata", JSON, nullable=True)
    timestamp: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, index=True)

    user: Mapped[Optional["User"]] = relationship(back_populates="audit_logs")


class RateLimitEntry(Base):
    __tablename__ = "rate_limit_entries"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"), index=True)
    model: Mapped[str] = mapped_column(String(50))
    date: Mapped[str] = mapped_column(String(10), index=True)  # YYYY-MM-DD
    request_count: Mapped[int] = mapped_column(Integer, default=0)

    user: Mapped["User"] = relationship(back_populates="rate_limits")


# ── Agent models ───────────────────────────────────────────────────────────────

class Agent(Base):
    __tablename__ = "agents"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    name: Mapped[str] = mapped_column(String(100))
    slug: Mapped[str] = mapped_column(String(50), unique=True, index=True)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    system_prompt: Mapped[str] = mapped_column(Text)
    model: Mapped[str] = mapped_column(String(50), default="claude_sonnet")
    agent_type: Mapped[str] = mapped_column(String(20), default="user_created")  # builtin | user_created
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    budget_limit_usd: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    allowed_models: Mapped[Optional[list]] = mapped_column(JSON, nullable=True)
    created_by: Mapped[Optional[str]] = mapped_column(String(36), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    versions: Mapped[list["AgentVersion"]] = relationship(
        back_populates="agent", cascade="all, delete-orphan"
    )
    executions: Mapped[list["AgentExecution"]] = relationship(
        back_populates="agent", cascade="all, delete-orphan"
    )


class AgentVersion(Base):
    __tablename__ = "agent_versions"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    agent_id: Mapped[str] = mapped_column(String(36), ForeignKey("agents.id"), index=True)
    version: Mapped[int] = mapped_column(Integer, default=1)
    system_prompt: Mapped[str] = mapped_column(Text)
    model: Mapped[str] = mapped_column(String(50))
    change_note: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_by: Mapped[Optional[str]] = mapped_column(String(36), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    agent: Mapped["Agent"] = relationship(back_populates="versions")


class AgentExecution(Base):
    __tablename__ = "agent_executions"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    agent_id: Mapped[str] = mapped_column(String(36), ForeignKey("agents.id"), index=True)
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"), index=True)
    prompt: Mapped[str] = mapped_column(Text)
    response: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    model: Mapped[str] = mapped_column(String(50))
    cost_usd: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    status: Mapped[str] = mapped_column(String(20), default="success")  # success | blocked | error
    policy_decision: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    execution_trace: Mapped[Optional[list]] = mapped_column(JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    agent: Mapped["Agent"] = relationship(back_populates="executions")
    user: Mapped["User"] = relationship(back_populates="agent_executions")


# ── Research models ────────────────────────────────────────────────────────────

class ResearchSession(Base):
    __tablename__ = "research_sessions"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"), index=True)
    query: Mapped[str] = mapped_column(Text)
    model: Mapped[str] = mapped_column(String(50))
    status: Mapped[str] = mapped_column(String(20), default="completed")
    cost_usd: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    user: Mapped["User"] = relationship(back_populates="research_sessions")
    reports: Mapped[list["ResearchReport"]] = relationship(
        back_populates="session", cascade="all, delete-orphan"
    )


class ResearchReport(Base):
    __tablename__ = "research_reports"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    session_id: Mapped[str] = mapped_column(String(36), ForeignKey("research_sessions.id"), index=True)
    content: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    session: Mapped["ResearchSession"] = relationship(back_populates="reports")
    citations: Mapped[list["Citation"]] = relationship(
        back_populates="report", cascade="all, delete-orphan"
    )


class Citation(Base):
    __tablename__ = "citations"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    report_id: Mapped[str] = mapped_column(String(36), ForeignKey("research_reports.id"), index=True)
    url: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    title: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    snippet: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    report: Mapped["ResearchReport"] = relationship(back_populates="citations")


# ── Support models ─────────────────────────────────────────────────────────────

class SupportSession(Base):
    __tablename__ = "support_sessions"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"), index=True)
    status: Mapped[str] = mapped_column(String(20), default="open")  # open | resolved | escalated
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user: Mapped["User"] = relationship(back_populates="support_sessions")
    messages: Mapped[list["SupportMessage"]] = relationship(
        back_populates="session", cascade="all, delete-orphan"
    )
    routing_decisions: Mapped[list["SupportRoutingDecision"]] = relationship(
        back_populates="session", cascade="all, delete-orphan"
    )


class SupportMessage(Base):
    __tablename__ = "support_messages"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    session_id: Mapped[str] = mapped_column(String(36), ForeignKey("support_sessions.id"), index=True)
    role: Mapped[str] = mapped_column(String(20))  # user | assistant
    content: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    session: Mapped["SupportSession"] = relationship(back_populates="messages")


class SupportRoutingMatrix(Base):
    __tablename__ = "support_routing_matrix"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    department: Mapped[str] = mapped_column(String(100))
    issue_keywords: Mapped[list] = mapped_column(JSON, default=list)
    issue_categories: Mapped[list] = mapped_column(JSON, default=list)
    contact_email: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    contact_name: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    priority: Mapped[int] = mapped_column(Integer, default=5)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)


class SupportRoutingDecision(Base):
    __tablename__ = "support_routing_decisions"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    session_id: Mapped[str] = mapped_column(String(36), ForeignKey("support_sessions.id"), index=True)
    department: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    confidence: Mapped[float] = mapped_column(Float, default=0.0)
    routing_reason: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    session: Mapped["SupportSession"] = relationship(back_populates="routing_decisions")


class SupportFeedback(Base):
    __tablename__ = "support_feedback"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    session_id: Mapped[str] = mapped_column(String(36), nullable=True)
    rating: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)  # 1–5
    comment: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


# ── Governance models ──────────────────────────────────────────────────────────

class GovernanceEvent(Base):
    __tablename__ = "governance_events"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    timestamp: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, index=True)
    event_type: Mapped[str] = mapped_column(String(50), index=True)
    actor_id: Mapped[Optional[str]] = mapped_column(String(36), nullable=True, index=True)
    actor_email: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    subject_type: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    subject_id: Mapped[Optional[str]] = mapped_column(String(36), nullable=True)
    payload: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    severity: Mapped[str] = mapped_column(String(20), default="info")  # info | warning | critical


# ── AI System Registry ─────────────────────────────────────────────────────────

class AISystem(Base):
    __tablename__ = "ai_systems"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    name: Mapped[str] = mapped_column(String(100))
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    department: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    owner_email: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    use_case: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    model_used: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    risk_level: Mapped[str] = mapped_column(String(20), default="medium")  # low | medium | high | critical
    status: Mapped[str] = mapped_column(String(20), default="draft")  # draft | active | deprecated
    data_classification: Mapped[str] = mapped_column(String(20), default="internal")
    created_by: Mapped[Optional[str]] = mapped_column(String(36), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
