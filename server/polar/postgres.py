from typing import AsyncGenerator

from fastapi import Request

from polar.config import settings
from polar.kit.db.postgres import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_sessionmaker,
    sql,
)
from polar.kit.db.postgres import create_engine as _create_engine


def create_engine() -> AsyncEngine:
    return _create_engine(
        dsn=str(settings.postgres_dsn),
        debug=settings.DEBUG,
    )


AsyncEngineLocal = create_engine()


async def get_db_session(request: Request) -> AsyncGenerator[AsyncSession, None]:
    sessionmaker: async_sessionmaker[AsyncSession] = request.state.sessionmaker
    async with sessionmaker() as session:
        try:
            yield session
        except Exception as e:
            await session.rollback()
            raise e
        finally:
            await session.close()


__all__ = [
    "AsyncSession",
    "AsyncEngineLocal",
    "sql",
    "create_engine",
    "create_sessionmaker",
    "get_db_session",
]
