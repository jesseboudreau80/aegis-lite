"""
Knowledge Library API — shared organizational intelligence.

GET    /knowledge                  — list assets
POST   /knowledge                  — create draft
GET    /knowledge/{id}             — single asset
PUT    /knowledge/{id}             — update (owner or admin)
DELETE /knowledge/{id}             — admin only
POST   /knowledge/{id}/publish     — admin: publish asset
POST   /knowledge/{id}/reuse       — increment reuse count (any authenticated user)
"""
import uuid
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from models import KnowledgeAsset, KnowledgeAssetVersion, User
from routes.auth import get_current_user, require_admin

router = APIRouter(prefix="/knowledge", tags=["knowledge"])

VALID_TYPES = {"sop", "research", "policy", "compliance", "risk_assessment", "presentation", "other"}
VALID_STATUSES = {"draft", "pending_review", "approved", "published", "deprecated"}


def _serialize(a: KnowledgeAsset, requester_email: Optional[str] = None) -> dict:
    return {
        "id":           a.id,
        "title":        a.title,
        "type":         a.type,
        "summary":      a.summary,
        "content":      a.content,
        "source_type":  a.source_type,
        "source_id":    a.source_id,
        "tags":         a.tags or [],
        "status":       a.status,
        "version":      a.version,
        "reuse_count":  a.reuse_count,
        "workspace_id": a.workspace_id,
        "created_by":   a.created_by,
        "approved_by":  a.approved_by,
        "published_by": a.published_by,
        "created_at":   a.created_at.isoformat(),
        "updated_at":   a.updated_at.isoformat(),
        "approved_at":  a.approved_at.isoformat() if a.approved_at else None,
        "published_at": a.published_at.isoformat() if a.published_at else None,
    }


class AssetCreate(BaseModel):
    title: str
    type: str = "other"
    content: str
    summary: Optional[str] = None
    source_type: Optional[str] = None
    source_id: Optional[str] = None
    tags: Optional[list[str]] = None
    workspace_id: Optional[str] = None


class AssetUpdate(BaseModel):
    title: Optional[str] = None
    type: Optional[str] = None
    content: Optional[str] = None
    summary: Optional[str] = None
    tags: Optional[list[str]] = None
    status: Optional[str] = None
    change_note: Optional[str] = None


@router.get("")
async def list_assets(
    type: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    workspace_id: Optional[str] = Query(None),
    limit: int = Query(50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    q = select(KnowledgeAsset).order_by(KnowledgeAsset.updated_at.desc())
    if type:
        q = q.where(KnowledgeAsset.type == type)
    if status:
        q = q.where(KnowledgeAsset.status == status)
    if workspace_id:
        q = q.where(KnowledgeAsset.workspace_id == workspace_id)

    # Non-admins see published assets plus their own drafts
    if user.role != "admin":
        from sqlalchemy import or_
        q = q.where(or_(
            KnowledgeAsset.status == "published",
            KnowledgeAsset.created_by == user.id,
        ))

    result = await db.execute(q.limit(limit))
    return [_serialize(a) for a in result.scalars().all()]


@router.post("")
async def create_asset(
    body: AssetCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    asset_type = body.type if body.type in VALID_TYPES else "other"
    asset = KnowledgeAsset(
        id=str(uuid.uuid4()),
        title=body.title,
        type=asset_type,
        content=body.content,
        summary=body.summary,
        source_type=body.source_type,
        source_id=body.source_id,
        tags=body.tags,
        status="draft",
        version=1,
        reuse_count=0,
        workspace_id=body.workspace_id,
        created_by=user.id,
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow(),
    )
    db.add(asset)

    version = KnowledgeAssetVersion(
        id=str(uuid.uuid4()),
        asset_id=asset.id,
        version=1,
        content=body.content,
        change_note="Initial save",
        changed_by=user.id,
        created_at=datetime.utcnow(),
    )
    db.add(version)

    await db.commit()
    await db.refresh(asset)
    return _serialize(asset)


@router.get("/{asset_id}")
async def get_asset(
    asset_id: str,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    result = await db.execute(select(KnowledgeAsset).where(KnowledgeAsset.id == asset_id))
    asset = result.scalar_one_or_none()
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found.")

    if user.role != "admin" and asset.status not in ("published", "approved") and asset.created_by != user.id:
        raise HTTPException(status_code=403, detail="Access denied.")

    return _serialize(asset)


@router.put("/{asset_id}")
async def update_asset(
    asset_id: str,
    body: AssetUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    result = await db.execute(select(KnowledgeAsset).where(KnowledgeAsset.id == asset_id))
    asset = result.scalar_one_or_none()
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found.")

    if user.role != "admin" and asset.created_by != user.id:
        raise HTTPException(status_code=403, detail="Only the author or admin can edit this asset.")

    if body.status and body.status not in VALID_STATUSES:
        raise HTTPException(status_code=400, detail=f"Invalid status. Valid: {VALID_STATUSES}")

    old_content = asset.content

    for field, value in body.model_dump(exclude_none=True, exclude={"change_note"}).items():
        setattr(asset, field, value)
    asset.updated_at = datetime.utcnow()

    if body.content and body.content != old_content:
        asset.version += 1
        version = KnowledgeAssetVersion(
            id=str(uuid.uuid4()),
            asset_id=asset.id,
            version=asset.version,
            content=body.content,
            change_note=body.change_note,
            changed_by=user.id,
            created_at=datetime.utcnow(),
        )
        db.add(version)

    await db.commit()
    await db.refresh(asset)
    return _serialize(asset)


@router.delete("/{asset_id}")
async def delete_asset(
    asset_id: str,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin),
):
    result = await db.execute(select(KnowledgeAsset).where(KnowledgeAsset.id == asset_id))
    asset = result.scalar_one_or_none()
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found.")

    asset.status = "deprecated"
    asset.updated_at = datetime.utcnow()
    await db.commit()
    return {"ok": True}


@router.post("/{asset_id}/publish")
async def publish_asset(
    asset_id: str,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin),
):
    result = await db.execute(select(KnowledgeAsset).where(KnowledgeAsset.id == asset_id))
    asset = result.scalar_one_or_none()
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found.")

    asset.status = "published"
    asset.published_by = admin.id
    asset.published_at = datetime.utcnow()
    asset.updated_at = datetime.utcnow()
    await db.commit()
    await db.refresh(asset)
    return _serialize(asset)


@router.post("/{asset_id}/reuse")
async def reuse_asset(
    asset_id: str,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    result = await db.execute(select(KnowledgeAsset).where(KnowledgeAsset.id == asset_id))
    asset = result.scalar_one_or_none()
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found.")

    asset.reuse_count += 1
    asset.updated_at = datetime.utcnow()
    await db.commit()
    return {"reuse_count": asset.reuse_count}
