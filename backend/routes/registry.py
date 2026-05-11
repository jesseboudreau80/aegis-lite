"""AI System Registry — register and govern AI systems in your organization."""
import uuid
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from models import AISystem, User
from routes.auth import get_current_user, require_admin

router = APIRouter(prefix="/registry", tags=["registry"])


class CreateSystemRequest(BaseModel):
    name: str
    description: Optional[str] = None
    department: Optional[str] = None
    owner_email: Optional[str] = None
    use_case: Optional[str] = None
    model_used: Optional[str] = None
    risk_level: str = "medium"
    data_classification: str = "internal"


class UpdateSystemRequest(BaseModel):
    description: Optional[str] = None
    department: Optional[str] = None
    model_used: Optional[str] = None
    risk_level: Optional[str] = None
    status: Optional[str] = None
    data_classification: Optional[str] = None


@router.get("")
async def list_systems(db: AsyncSession = Depends(get_db), _: User = Depends(get_current_user)):
    result = await db.execute(select(AISystem).order_by(AISystem.name))
    systems = result.scalars().all()
    return [
        {
            "id":                  s.id,
            "name":                s.name,
            "description":         s.description,
            "department":          s.department,
            "risk_level":          s.risk_level,
            "status":              s.status,
            "data_classification": s.data_classification,
            "model_used":          s.model_used,
            "created_at":          s.created_at.isoformat(),
        }
        for s in systems
    ]


@router.post("")
async def create_system(
    req: CreateSystemRequest,
    user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    system = AISystem(
        id=str(uuid.uuid4()),
        name=req.name,
        description=req.description,
        department=req.department,
        owner_email=req.owner_email,
        use_case=req.use_case,
        model_used=req.model_used,
        risk_level=req.risk_level,
        status="draft",
        data_classification=req.data_classification,
        created_by=user.id,
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow(),
    )
    db.add(system)
    await db.commit()
    return {"id": system.id, "name": system.name, "status": system.status}


@router.patch("/{system_id}")
async def update_system(
    system_id: str,
    req: UpdateSystemRequest,
    _: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(AISystem).where(AISystem.id == system_id))
    system = result.scalar_one_or_none()
    if not system:
        raise HTTPException(status_code=404, detail="System not found.")
    for field, value in req.model_dump(exclude_none=True).items():
        setattr(system, field, value)
    system.updated_at = datetime.utcnow()
    await db.commit()
    return {"id": system.id, "status": system.status}
