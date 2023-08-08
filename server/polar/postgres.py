from typing import AsyncGenerator

from polar.config import settings
from polar.kit.db.postgres import AsyncEngine, AsyncSession, create_sessionmaker, sql
from polar.kit.db.postgres import create_engine as _create_engine


def create_engine() -> AsyncEngine:
    return _create_engine(
        dsn=str(settings.postgres_dsn),
        debug=settings.DEBUG,
    )


AsyncEngineLocal = create_engine()
AsyncSessionLocal = create_sessionmaker(engine=AsyncEngineLocal)


async def get_db_session() -> AsyncGenerator[AsyncSession, None]:
    async with AsyncSessionLocal() as db:
        try:
            yield db
        except Exception as e:
            await db.rollback()
            raise e
        finally:
            await db.close()


__all__ = [
    "AsyncSessionLocal",
    "AsyncSession",
    "AsyncEngineLocal",
    "sql",
    "create_engine",
    "create_sessionmaker",
    "get_db_session",
]
