from typing import AsyncGenerator
from fastapi import Request

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


async def get_db_session(request: Request) -> AsyncGenerator[AsyncSession, None]:
    async with AsyncSession(
        request.state.db_engine,
        expire_on_commit=False,
        autocommit=False,
        autoflush=False,
    ) as session:
        try:
            yield session
        except Exception as e:
            await session.rollback()
            raise e
        finally:
            await session.close()


__all__ = [
    "AsyncSessionLocal",
    "AsyncSession",
    "AsyncEngineLocal",
    "sql",
    "create_engine",
    "create_sessionmaker",
    "get_db_session",
]
