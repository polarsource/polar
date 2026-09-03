from collections.abc import AsyncGenerator
from typing import Literal

from fastapi import Request

from polar.config import settings
from polar.kit.db.postgres import (
    AsyncEngine,
    AsyncReadSession,
    AsyncReadSessionMaker,
    AsyncSession,
    AsyncSessionMaker,
    Engine,
    sql,
)
from polar.kit.db.postgres import create_async_engine as _create_async_engine
from polar.kit.db.postgres import create_sync_engine as _create_sync_engine

type ProcessName = Literal["app", "worker", "scheduler", "script"]


def create_async_engine(
    process_name: ProcessName,
    *,
    pool_logging_name: str | None = None,
    pool_pre_ping: bool = False,
) -> AsyncEngine:
    return _create_async_engine(
        dsn=str(settings.get_postgres_dsn("asyncpg")),
        application_name=f"{settings.ENV.value}.{process_name}",
        pool_logging_name=pool_logging_name or process_name,
        debug=settings.SQLALCHEMY_DEBUG,
        pool_size=settings.DATABASE_POOL_SIZE,
        pool_recycle=settings.DATABASE_POOL_RECYCLE_SECONDS,
        pool_pre_ping=pool_pre_ping,
        command_timeout=settings.DATABASE_COMMAND_TIMEOUT_SECONDS,
        connect_timeout=settings.DATABASE_CONNECT_TIMEOUT_SECONDS,
        ssl="require" if settings.POSTGRES_SSL else None,
    )


def create_async_read_engine(
    process_name: ProcessName, *, pool_pre_ping: bool = False
) -> AsyncEngine:
    return _create_async_engine(
        dsn=str(settings.get_postgres_read_dsn("asyncpg")),
        application_name=f"{settings.ENV.value}.{process_name}",
        pool_logging_name=f"{process_name}_read",
        debug=settings.SQLALCHEMY_DEBUG,
        pool_size=settings.DATABASE_POOL_SIZE,
        pool_recycle=settings.DATABASE_POOL_RECYCLE_SECONDS,
        pool_pre_ping=pool_pre_ping,
        command_timeout=settings.DATABASE_COMMAND_TIMEOUT_SECONDS,
        connect_timeout=settings.DATABASE_CONNECT_TIMEOUT_SECONDS,
        ssl="require" if settings.POSTGRES_SSL else None,
    )


def create_sync_engine(process_name: ProcessName) -> Engine:
    return _create_sync_engine(
        dsn=str(settings.get_postgres_dsn("psycopg2")),
        application_name=f"{settings.ENV.value}.{process_name}",
        pool_logging_name=f"{process_name}_sync",
        debug=settings.SQLALCHEMY_DEBUG,
        pool_size=settings.DATABASE_SYNC_POOL_SIZE,
        pool_recycle=settings.DATABASE_POOL_RECYCLE_SECONDS,
        command_timeout=settings.DATABASE_COMMAND_TIMEOUT_SECONDS,
        connect_timeout=settings.DATABASE_CONNECT_TIMEOUT_SECONDS,
        sslmode="require" if settings.POSTGRES_SSL else None,
    )


async def get_db_sessionmaker(request: Request) -> AsyncSessionMaker:
    return request.state.async_sessionmaker


async def get_db_session(request: Request) -> AsyncSession:
    try:
        return request.state.async_session
    except AttributeError as e:
        raise RuntimeError(
            "Session is not present in the request state. "
            "Did you forget to add TransactionalMiddleware?"
        ) from e


async def get_db_read_session(request: Request) -> AsyncGenerator[AsyncReadSession]:
    sessionmaker: AsyncReadSessionMaker = request.state.async_read_sessionmaker
    async with sessionmaker() as session:
        yield session


__all__ = [
    "AsyncEngine",
    "AsyncReadSession",
    "AsyncSession",
    "create_async_engine",
    "create_async_read_engine",
    "create_sync_engine",
    "get_db_read_session",
    "get_db_session",
    "get_db_sessionmaker",
    "sql",
]
