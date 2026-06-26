"""
Workspaces API — governed team scopes.

GET    /workspaces                         — list my workspaces
POST   /workspaces                         — create
GET    /workspaces/{id}                    — detail
PUT    /workspaces/{id}                    — update (owner or admin)
DELETE /workspaces/{id}                    — delete (admin)
GET    /workspaces/{id}/members            — list members
POST   /workspaces/{id}/members            — add member
DELETE /workspaces/{id}/members/{user_id}  — remove member
GET    /workspaces/{id}/activity           — recent activity feed
"""
import re
import uuid
from datetime import datetime, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from models import AuditLog, Conversation, User, Workspace, WorkspaceMember
from routes.auth import get_current_user, require_admin

router = APIRouter(prefix="/workspaces", tags=["workspaces"])


def _slugify(name: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")
    return f"{slug}-{uuid.uuid4().hex[:6]}"


def _serialize(ws: Workspace, member_count: int = 0) -> dict:
    return {
        "id":               ws.id,
        "name":             ws.name,
        "slug":             ws.slug,
        "description":      ws.description,
        "budget_limit_usd": ws.budget_limit_usd,
        "risk_threshold":   ws.risk_threshold,
        "is_active":        ws.is_active,
        "created_by":       ws.created_by,
        "created_at":       ws.created_at.isoformat(),
        "updated_at":       ws.updated_at.isoformat(),
        "member_count":     member_count,
    }


def _serialize_member(m: WorkspaceMember, user: User) -> dict:
    return {
        "id":          m.id,
        "workspace_id": m.workspace_id,
        "user_id":     m.user_id,
        "user_name":   user.name,
        "user_email":  user.email,
        "role":        m.role,
        "joined_at":   m.joined_at.isoformat(),
    }


class WorkspaceCreate(BaseModel):
    name: str
    description: Optional[str] = None
    budget_limit_usd: Optional[float] = None
    risk_threshold: str = "medium"


class WorkspaceUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    budget_limit_usd: Optional[float] = None
    risk_threshold: Optional[str] = None
    is_active: Optional[bool] = None


class AddMemberRequest(BaseModel):
    email: str
    role: str = "member"


@router.get("")
async def list_workspaces(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    if user.role == "admin":
        result = await db.execute(
            select(Workspace).where(Workspace.is_active == True).order_by(Workspace.created_at.desc())  # noqa: E712
        )
        workspaces = result.scalars().all()
    else:
        member_ws_ids = (await db.execute(
            select(WorkspaceMember.workspace_id).where(WorkspaceMember.user_id == user.id)
        )).scalars().all()
        result = await db.execute(
            select(Workspace)
            .where(Workspace.id.in_(member_ws_ids), Workspace.is_active == True)  # noqa: E712
            .order_by(Workspace.created_at.desc())
        )
        workspaces = result.scalars().all()

    counts = {
        row[0]: row[1]
        for row in (await db.execute(
            select(WorkspaceMember.workspace_id, func.count(WorkspaceMember.id))
            .group_by(WorkspaceMember.workspace_id)
        )).all()
    }

    return [_serialize(ws, counts.get(ws.id, 0)) for ws in workspaces]


@router.post("")
async def create_workspace(
    body: WorkspaceCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    ws = Workspace(
        id=str(uuid.uuid4()),
        name=body.name,
        slug=_slugify(body.name),
        description=body.description,
        budget_limit_usd=body.budget_limit_usd,
        risk_threshold=body.risk_threshold,
        is_active=True,
        created_by=user.id,
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow(),
    )
    db.add(ws)

    member = WorkspaceMember(
        id=str(uuid.uuid4()),
        workspace_id=ws.id,
        user_id=user.id,
        role="owner",
        joined_at=datetime.utcnow(),
    )
    db.add(member)

    await db.commit()
    await db.refresh(ws)
    return _serialize(ws, 1)


@router.get("/{workspace_id}")
async def get_workspace(
    workspace_id: str,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    result = await db.execute(select(Workspace).where(Workspace.id == workspace_id))
    ws = result.scalar_one_or_none()
    if not ws:
        raise HTTPException(status_code=404, detail="Workspace not found.")

    if user.role != "admin":
        member_check = await db.execute(
            select(WorkspaceMember).where(
                WorkspaceMember.workspace_id == workspace_id,
                WorkspaceMember.user_id == user.id,
            )
        )
        if not member_check.scalar_one_or_none():
            raise HTTPException(status_code=403, detail="Access denied.")

    count = (await db.execute(
        select(func.count(WorkspaceMember.id)).where(WorkspaceMember.workspace_id == workspace_id)
    )).scalar_one()

    since_30d = datetime.utcnow() - timedelta(days=30)
    spend = (await db.execute(
        select(func.sum(AuditLog.estimated_cost))
        .join(User, User.id == AuditLog.user_id)
        .join(WorkspaceMember, WorkspaceMember.user_id == User.id)
        .where(
            WorkspaceMember.workspace_id == workspace_id,
            AuditLog.timestamp >= since_30d,
        )
    )).scalar_one() or 0.0

    serialized = _serialize(ws, count)
    serialized["spend_30d"] = round(spend, 4)
    return serialized


@router.put("/{workspace_id}")
async def update_workspace(
    workspace_id: str,
    body: WorkspaceUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    result = await db.execute(select(Workspace).where(Workspace.id == workspace_id))
    ws = result.scalar_one_or_none()
    if not ws:
        raise HTTPException(status_code=404, detail="Workspace not found.")

    if user.role != "admin":
        member_check = await db.execute(
            select(WorkspaceMember).where(
                WorkspaceMember.workspace_id == workspace_id,
                WorkspaceMember.user_id == user.id,
                WorkspaceMember.role == "owner",
            )
        )
        if not member_check.scalar_one_or_none():
            raise HTTPException(status_code=403, detail="Only workspace owner or admin can update.")

    for field, value in body.model_dump(exclude_none=True).items():
        setattr(ws, field, value)
    ws.updated_at = datetime.utcnow()
    await db.commit()
    await db.refresh(ws)
    return _serialize(ws)


@router.delete("/{workspace_id}")
async def delete_workspace(
    workspace_id: str,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin),
):
    result = await db.execute(select(Workspace).where(Workspace.id == workspace_id))
    ws = result.scalar_one_or_none()
    if not ws:
        raise HTTPException(status_code=404, detail="Workspace not found.")

    ws.is_active = False
    ws.updated_at = datetime.utcnow()
    await db.commit()
    return {"ok": True}


@router.get("/{workspace_id}/members")
async def list_members(
    workspace_id: str,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(WorkspaceMember, User)
        .join(User, User.id == WorkspaceMember.user_id)
        .where(WorkspaceMember.workspace_id == workspace_id)
        .order_by(WorkspaceMember.joined_at)
    )
    rows = result.all()
    return [_serialize_member(m, u) for m, u in rows]


@router.post("/{workspace_id}/members")
async def add_member(
    workspace_id: str,
    body: AddMemberRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    result = await db.execute(select(Workspace).where(Workspace.id == workspace_id))
    ws = result.scalar_one_or_none()
    if not ws:
        raise HTTPException(status_code=404, detail="Workspace not found.")

    if user.role != "admin":
        owner_check = await db.execute(
            select(WorkspaceMember).where(
                WorkspaceMember.workspace_id == workspace_id,
                WorkspaceMember.user_id == user.id,
                WorkspaceMember.role == "owner",
            )
        )
        if not owner_check.scalar_one_or_none():
            raise HTTPException(status_code=403, detail="Only workspace owner or admin can add members.")

    target = (await db.execute(select(User).where(User.email == body.email, User.is_active == True))).scalar_one_or_none()  # noqa: E712
    if not target:
        raise HTTPException(status_code=404, detail="User not found.")

    existing = (await db.execute(
        select(WorkspaceMember).where(
            WorkspaceMember.workspace_id == workspace_id,
            WorkspaceMember.user_id == target.id,
        )
    )).scalar_one_or_none()
    if existing:
        raise HTTPException(status_code=409, detail="User is already a member.")

    member = WorkspaceMember(
        id=str(uuid.uuid4()),
        workspace_id=workspace_id,
        user_id=target.id,
        role=body.role,
        joined_at=datetime.utcnow(),
    )
    db.add(member)
    await db.commit()
    await db.refresh(member)
    return _serialize_member(member, target)


@router.delete("/{workspace_id}/members/{target_user_id}")
async def remove_member(
    workspace_id: str,
    target_user_id: str,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    if user.role != "admin":
        owner_check = await db.execute(
            select(WorkspaceMember).where(
                WorkspaceMember.workspace_id == workspace_id,
                WorkspaceMember.user_id == user.id,
                WorkspaceMember.role == "owner",
            )
        )
        if not owner_check.scalar_one_or_none():
            raise HTTPException(status_code=403, detail="Only workspace owner or admin can remove members.")

    member = (await db.execute(
        select(WorkspaceMember).where(
            WorkspaceMember.workspace_id == workspace_id,
            WorkspaceMember.user_id == target_user_id,
        )
    )).scalar_one_or_none()
    if not member:
        raise HTTPException(status_code=404, detail="Member not found.")

    await db.delete(member)
    await db.commit()
    return {"ok": True}


@router.get("/{workspace_id}/activity")
async def workspace_activity(
    workspace_id: str,
    limit: int = Query(20, ge=1, le=50),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    member_ids = (await db.execute(
        select(WorkspaceMember.user_id).where(WorkspaceMember.workspace_id == workspace_id)
    )).scalars().all()

    result = await db.execute(
        select(AuditLog, User.email, User.name)
        .join(User, User.id == AuditLog.user_id)
        .where(AuditLog.user_id.in_(member_ids))
        .order_by(AuditLog.timestamp.desc())
        .limit(limit)
    )
    rows = result.all()

    return [
        {
            "id":         log.id,
            "timestamp":  log.timestamp.isoformat(),
            "actor":      email,
            "actor_name": name,
            "model":      log.model,
            "decision":   log.policy_decision or "allow",
            "cost":       round(log.estimated_cost or 0, 6),
            "event_type": log.event_type or "chat",
        }
        for log, email, name in rows
    ]
