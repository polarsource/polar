from collections.abc import AsyncGenerator
from typing import Literal

from fastapi import Depends, Request

from polar.config import settings
from polar.kit.db.postgres import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_sessionmaker,
    sql,
)
from polar.kit.db.postgres import create_engine as _create_engine


def create_engine(
    process_name: Literal["app", "worker", "script", "backoffice"],
) -> AsyncEngine:
    return _create_engine(
        dsn=str(settings.postgres_dsn),
        application_name=f"{settings.ENV.value}.{process_name}",
        debug=settings.DEBUG,
    )


AsyncSessionMaker = async_sessionmaker[AsyncSession]


async def get_db_sessionmaker(
    request: Request,
) -> AsyncGenerator[AsyncSessionMaker, None]:
    sessionmaker: AsyncSessionMaker = request.state.sessionmaker
    yield sessionmaker


async def get_db_session(
    sessionmaker: AsyncSessionMaker = Depends(get_db_sessionmaker),
) -> AsyncGenerator[AsyncSession, None]:
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
    "sql",
    "create_engine",
    "create_sessionmaker",
    "get_db_session",
    "get_db_sessionmaker",
    "AsyncSessionMaker",
]
