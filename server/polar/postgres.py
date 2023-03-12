from typing import AsyncGenerator

from polar.config import settings
from polar.kit.db.postgres import AsyncEngine, AsyncSession
from polar.kit.db.postgres import create_engine as _create_engine
from polar.kit.db.postgres import create_sessionmaker, sql


def create_engine() -> AsyncEngine:
    return _create_engine(
        dsn=str(settings.postgres_dsn),
        debug=settings.DEBUG,
    )


AsyncEngineLocal = create_engine()
AsyncSessionLocal = create_sessionmaker(engine=AsyncEngineLocal)


async def get_db_session() -> AsyncGenerator[AsyncSession, None]:
    async with AsyncSessionLocal() as db:
        yield db


__all__ = [
    "AsyncSessionLocal",
    "AsyncSession",
    "AsyncEngineLocal",
    "sql",
    "create_engine",
    "create_sessionmaker",
    "get_db_session",
]
