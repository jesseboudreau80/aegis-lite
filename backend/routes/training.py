from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from models import User
from routes.auth import get_current_user

router = APIRouter(prefix="/training", tags=["training"])


@router.get("/status")
async def get_training_status(user: User = Depends(get_current_user)):
    return {"training_completed": user.training_completed, "user_name": user.name}


@router.post("/complete")
async def complete_training(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    user.training_completed = True
    await db.commit()
    return {"message": "Training completed. You may now access the AI workspace.", "training_completed": True}
