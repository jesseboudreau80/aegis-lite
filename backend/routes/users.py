from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from models import User
from routes.auth import get_current_user, require_admin

router = APIRouter(prefix="/users", tags=["users"])


class UpdateBudgetRequest(BaseModel):
    monthly_budget_usd: float


class CreateUserRequest(BaseModel):
    name: str
    email: str
    role: str = "user"
    monthly_budget_usd: float = 20.0


@router.get("/me")
async def get_me(user: User = Depends(get_current_user)):
    return {
        "id":                 user.id,
        "name":               user.name,
        "email":              user.email,
        "role":               user.role,
        "monthly_budget_usd": user.monthly_budget_usd,
        "current_usage_usd":  round(user.current_usage_usd, 6),
        "training_completed": user.training_completed,
    }


@router.get("")
async def list_users(_: User = Depends(require_admin), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.is_active == True))  # noqa: E712
    users = result.scalars().all()
    return [
        {
            "id":                 u.id,
            "name":               u.name,
            "email":              u.email,
            "role":               u.role,
            "monthly_budget_usd": u.monthly_budget_usd,
            "current_usage_usd":  round(u.current_usage_usd, 6),
            "training_completed": u.training_completed,
        }
        for u in users
    ]


@router.patch("/{user_id}/budget")
async def update_budget(
    user_id: str,
    req: UpdateBudgetRequest,
    _: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user.monthly_budget_usd = req.monthly_budget_usd
    await db.commit()
    return {"message": "Budget updated", "monthly_budget_usd": user.monthly_budget_usd}


@router.post("/{user_id}/reset-usage")
async def reset_usage(
    user_id: str,
    _: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user.current_usage_usd = 0.0
    await db.commit()
    return {"message": "Usage reset successfully"}


@router.patch("/{user_id}/training")
async def mark_training_complete(
    user_id: str,
    _: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user.training_completed = True
    await db.commit()
    return {"message": "Training marked complete"}
