from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from models import Conversation, Message, User
from routes.auth import require_training

router = APIRouter(prefix="/conversations", tags=["conversations"])


@router.get("")
async def list_conversations(user: User = Depends(require_training), db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Conversation).where(Conversation.user_id == user.id).order_by(Conversation.updated_at.desc())
    )
    convs = result.scalars().all()
    return [
        {"id": c.id, "title": c.title, "model": c.model,
         "created_at": c.created_at.isoformat(), "updated_at": c.updated_at.isoformat()}
        for c in convs
    ]


@router.get("/{conversation_id}/messages")
async def get_messages(
    conversation_id: str,
    user: User = Depends(require_training),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Conversation).where(Conversation.id == conversation_id, Conversation.user_id == user.id)
    )
    conv = result.scalar_one_or_none()
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")

    msgs = (await db.execute(
        select(Message).where(Message.conversation_id == conversation_id).order_by(Message.created_at)
    )).scalars().all()

    return {
        "conversation": {"id": conv.id, "title": conv.title, "model": conv.model},
        "messages": [
            {"id": m.id, "role": m.role, "content": m.content,
             "created_at": m.created_at.isoformat(), "cost_usd": m.cost_usd}
            for m in msgs
        ],
    }


@router.delete("/{conversation_id}")
async def delete_conversation(
    conversation_id: str,
    user: User = Depends(require_training),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Conversation).where(Conversation.id == conversation_id, Conversation.user_id == user.id)
    )
    conv = result.scalar_one_or_none()
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")
    await db.delete(conv)
    await db.commit()
    return {"message": "Conversation deleted."}
