"""
Seed script — creates demo users and initial routing matrix.
Normally this runs automatically on startup via main.py lifespan.
Run directly only if you need to re-seed a database.
"""
import asyncio
import uuid
from datetime import datetime

from sqlalchemy import select

async def main():
    import sys; sys.path.insert(0, ".")
    from database import AsyncSessionLocal, init_db
    from models import SupportRoutingMatrix, User

    print("Initializing database...")
    await init_db()

    demo_users = [
        {"name": "Admin User", "email": "admin@example.com", "role": "admin",
         "monthly_budget_usd": 100.0, "training_completed": True},
        {"name": "Demo User", "email": "demo@example.com", "role": "user",
         "monthly_budget_usd": 20.0, "training_completed": False},
    ]

    async with AsyncSessionLocal() as db:
        for u in demo_users:
            existing = await db.execute(select(User).where(User.email == u["email"]))
            if not existing.scalar_one_or_none():
                db.add(User(id=str(uuid.uuid4()), is_active=True, created_at=datetime.utcnow(), **u))
                print(f"  Created user: {u['email']}")
        await db.commit()

    print("Done. Run the backend with: uvicorn main:app --reload --port 8100")

if __name__ == "__main__":
    asyncio.run(main())
