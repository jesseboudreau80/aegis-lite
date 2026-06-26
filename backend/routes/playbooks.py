"""
Playbooks API — governed work templates.

GET    /playbooks                  — list active playbooks
POST   /playbooks                  — create (admin)
GET    /playbooks/executions        — list executions (mine or all if admin)
GET    /playbooks/{id}              — single playbook detail
PUT    /playbooks/{id}              — update (admin)
DELETE /playbooks/{id}              — deprecate (admin)
POST   /playbooks/{id}/launch       — launch execution → returns conversation_id
"""
import re
import uuid
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from models import Conversation, Playbook, PlaybookExecution, User
from routes.auth import get_current_user, require_admin

router = APIRouter(prefix="/playbooks", tags=["playbooks"])


def _slugify(name: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")
    return f"{slug}-{uuid.uuid4().hex[:6]}"


def _serialize(p: Playbook, execution_count: int = 0) -> dict:
    return {
        "id":               p.id,
        "name":             p.name,
        "slug":             p.slug,
        "description":      p.description,
        "purpose":          p.purpose,
        "instructions":     p.instructions,
        "approved_models":  p.approved_models or [],
        "agent_ids":        p.agent_ids or [],
        "knowledge_sources": p.knowledge_sources or [],
        "output_standards": p.output_standards,
        "category":         p.category,
        "visibility":       p.visibility,
        "status":           p.status,
        "workspace_id":     p.workspace_id,
        "created_by":       p.created_by,
        "created_at":       p.created_at.isoformat(),
        "updated_at":       p.updated_at.isoformat(),
        "execution_count":  execution_count,
    }


class PlaybookCreate(BaseModel):
    name: str
    description: Optional[str] = None
    purpose: Optional[str] = None
    instructions: Optional[str] = None
    approved_models: Optional[list[str]] = None
    agent_ids: Optional[list[str]] = None
    knowledge_sources: Optional[list[dict]] = None
    output_standards: Optional[str] = None
    category: Optional[str] = None
    visibility: str = "org"
    workspace_id: Optional[str] = None


class PlaybookUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    purpose: Optional[str] = None
    instructions: Optional[str] = None
    approved_models: Optional[list[str]] = None
    agent_ids: Optional[list[str]] = None
    knowledge_sources: Optional[list[dict]] = None
    output_standards: Optional[str] = None
    category: Optional[str] = None
    visibility: Optional[str] = None
    status: Optional[str] = None
    workspace_id: Optional[str] = None


class LaunchRequest(BaseModel):
    workspace_id: Optional[str] = None
    context: Optional[str] = None
    model: Optional[str] = None


@router.get("")
async def list_playbooks(
    category: Optional[str] = Query(None),
    status: str = Query("active"),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    q = select(Playbook).where(Playbook.status == status).order_by(Playbook.created_at.desc())
    if category:
        q = q.where(Playbook.category == category)

    result = await db.execute(q)
    playbooks = result.scalars().all()

    counts_result = await db.execute(
        select(PlaybookExecution.playbook_id, func.count(PlaybookExecution.id))
        .group_by(PlaybookExecution.playbook_id)
    )
    counts = {row[0]: row[1] for row in counts_result.all()}

    return [_serialize(p, counts.get(p.id, 0)) for p in playbooks]


@router.post("")
async def create_playbook(
    body: PlaybookCreate,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin),
):
    playbook = Playbook(
        id=str(uuid.uuid4()),
        name=body.name,
        slug=_slugify(body.name),
        description=body.description,
        purpose=body.purpose,
        instructions=body.instructions,
        approved_models=body.approved_models,
        agent_ids=body.agent_ids,
        knowledge_sources=body.knowledge_sources,
        output_standards=body.output_standards,
        category=body.category,
        visibility=body.visibility,
        workspace_id=body.workspace_id,
        status="active",
        created_by=admin.id,
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow(),
    )
    db.add(playbook)
    await db.commit()
    await db.refresh(playbook)
    return _serialize(playbook)


@router.get("/executions")
async def list_executions(
    limit: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    q = (
        select(PlaybookExecution, Playbook.name)
        .join(Playbook, Playbook.id == PlaybookExecution.playbook_id)
        .order_by(PlaybookExecution.started_at.desc())
    )
    if user.role != "admin":
        q = q.where(PlaybookExecution.user_id == user.id)

    rows = (await db.execute(q.limit(limit))).all()
    return [
        {
            "id":            ex.id,
            "playbook_id":   ex.playbook_id,
            "playbook_name": name,
            "user_id":       ex.user_id,
            "workspace_id":  ex.workspace_id,
            "conversation_id": ex.conversation_id,
            "status":        ex.status,
            "started_at":    ex.started_at.isoformat(),
            "completed_at":  ex.completed_at.isoformat() if ex.completed_at else None,
        }
        for ex, name in rows
    ]


@router.get("/{playbook_id}")
async def get_playbook(
    playbook_id: str,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    result = await db.execute(select(Playbook).where(Playbook.id == playbook_id))
    playbook = result.scalar_one_or_none()
    if not playbook:
        raise HTTPException(status_code=404, detail="Playbook not found.")

    count = (await db.execute(
        select(func.count(PlaybookExecution.id)).where(PlaybookExecution.playbook_id == playbook_id)
    )).scalar_one()

    return _serialize(playbook, count)


@router.put("/{playbook_id}")
async def update_playbook(
    playbook_id: str,
    body: PlaybookUpdate,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin),
):
    result = await db.execute(select(Playbook).where(Playbook.id == playbook_id))
    playbook = result.scalar_one_or_none()
    if not playbook:
        raise HTTPException(status_code=404, detail="Playbook not found.")

    for field, value in body.model_dump(exclude_none=True).items():
        setattr(playbook, field, value)
    playbook.updated_at = datetime.utcnow()

    await db.commit()
    await db.refresh(playbook)
    return _serialize(playbook)


@router.delete("/{playbook_id}")
async def deprecate_playbook(
    playbook_id: str,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin),
):
    result = await db.execute(select(Playbook).where(Playbook.id == playbook_id))
    playbook = result.scalar_one_or_none()
    if not playbook:
        raise HTTPException(status_code=404, detail="Playbook not found.")

    playbook.status = "deprecated"
    playbook.updated_at = datetime.utcnow()
    await db.commit()
    return {"ok": True}


@router.post("/{playbook_id}/launch")
async def launch_playbook(
    playbook_id: str,
    body: LaunchRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Playbook).where(Playbook.id == playbook_id, Playbook.status == "active")
    )
    playbook = result.scalar_one_or_none()
    if not playbook:
        raise HTTPException(status_code=404, detail="Playbook not found or inactive.")

    model = body.model or (
        playbook.approved_models[0] if playbook.approved_models else "claude_sonnet"
    )

    conversation = Conversation(
        id=str(uuid.uuid4()),
        user_id=user.id,
        title=playbook.name,
        model=model,
        workspace_id=body.workspace_id,
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow(),
    )
    db.add(conversation)

    execution = PlaybookExecution(
        id=str(uuid.uuid4()),
        playbook_id=playbook.id,
        user_id=user.id,
        workspace_id=body.workspace_id,
        conversation_id=conversation.id,
        status="running",
        started_at=datetime.utcnow(),
    )
    db.add(execution)

    conversation.playbook_execution_id = execution.id
    await db.commit()

    return {
        "execution_id":    execution.id,
        "conversation_id": conversation.id,
        "playbook_name":   playbook.name,
        "model":           model,
    }
