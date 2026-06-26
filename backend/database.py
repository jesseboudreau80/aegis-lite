from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase

from config.settings import settings

engine = create_async_engine(
    settings.database_url,
    echo=settings.debug,
    pool_pre_ping=True,
)

AsyncSessionLocal = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


class Base(DeclarativeBase):
    pass


async def get_db():
    async with AsyncSessionLocal() as session:
        yield session


async def init_db():
    import models  # noqa: F401
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)


async def run_column_migrations():
    """Add new nullable columns to existing tables. Safe and idempotent."""
    _migrations = [
        ("users",            "department",            "VARCHAR(100)"),
        ("conversations",    "workspace_id",          "VARCHAR(36)"),
        ("conversations",    "playbook_execution_id", "VARCHAR(36)"),
        ("agent_executions", "workspace_id",          "VARCHAR(36)"),
        ("agent_executions", "playbook_execution_id", "VARCHAR(36)"),
        ("agent_executions", "parent_execution_id",   "VARCHAR(36)"),
    ]
    async with engine.begin() as conn:
        for table, column, col_type in _migrations:
            await _add_column_if_missing(conn, table, column, col_type)


async def _add_column_if_missing(conn, table: str, column: str, col_type: str) -> None:
    from sqlalchemy import text
    db_url = str(engine.url)
    if "postgresql" in db_url:
        await conn.execute(text(
            f"ALTER TABLE {table} ADD COLUMN IF NOT EXISTS {column} {col_type}"
        ))
    else:
        try:
            await conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {column} {col_type}"))
        except Exception:
            pass  # Column already exists
