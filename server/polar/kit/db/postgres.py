from typing import Any

from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

from ..extensions.sqlalchemy import sql


def create_engine(*, dsn: str, debug: bool = False) -> AsyncEngine:
    engine_options: dict[str, Any] = dict(
        echo=debug,
    )
    return create_async_engine(dsn, **engine_options)


def create_sessionmaker(engine: AsyncEngine) -> async_sessionmaker[AsyncSession]:
    return async_sessionmaker(
        engine,
        autocommit=False,
        autoflush=False,
        expire_on_commit=False,
        class_=AsyncSession,
    )


__all__ = [
    "AsyncSession",
    "AsyncEngine",
    "async_sessionmaker",
    "create_engine",
    "create_sessionmaker",
    "sql",
]
