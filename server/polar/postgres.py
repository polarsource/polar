from collections.abc import AsyncGenerator
from typing import Literal, TypeAlias

from fastapi import Depends, Request

from polar.config import settings
from polar.kit.db.postgres import (
    AsyncEngine,
    AsyncSession,
    AsyncSessionMaker,
    Engine,
    sql,
)
from polar.kit.db.postgres import (
    create_async_engine as _create_async_engine,
)
from polar.kit.db.postgres import (
    create_sync_engine as _create_sync_engine,
)

ProcessName: TypeAlias = Literal["app", "worker", "script", "backoffice"]


def create_async_engine(process_name: ProcessName) -> AsyncEngine:
    return _create_async_engine(
        dsn=str(settings.get_postgres_dsn("asyncpg")),
        application_name=f"{settings.ENV.value}.{process_name}",
        debug=settings.DEBUG,
    )


def create_sync_engine(process_name: ProcessName) -> Engine:
    return _create_sync_engine(
        dsn=str(settings.get_postgres_dsn("psycopg2")),
        application_name=f"{settings.ENV.value}.{process_name}",
        debug=settings.DEBUG,
    )


async def get_db_sessionmaker(
    request: Request,
) -> AsyncGenerator[AsyncSessionMaker, None]:
    async_sessionmaker: AsyncSessionMaker = request.state.async_sessionmaker
    yield async_sessionmaker


async def get_db_session(
    sessionmaker: AsyncSessionMaker = Depends(get_db_sessionmaker),
) -> AsyncGenerator[AsyncSession, None]:
    async with sessionmaker() as session:
        try:
            yield session
        except:
            await session.rollback()
            raise
        else:
            await session.commit()


__all__ = [
    "AsyncSession",
    "sql",
    "create_async_engine",
    "create_sync_engine",
    "get_db_session",
    "get_db_sessionmaker",
]
