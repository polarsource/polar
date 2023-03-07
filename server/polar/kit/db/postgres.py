from typing import Any

from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.pool import NullPool

from ..extensions.sqlalchemy import sql


def create_engine(
    *, dsn: str, is_celery: bool = False, debug: bool = False
) -> AsyncEngine:
    engine_options: dict[str, Any] = dict(echo=debug)
    if is_celery:
        # TODO: Change pooling strategy for celery workers.
        # In the meantime, we're using NullPool to avoid
        # issues with asyncio in Celery.
        engine_options.update(dict(poolclass=NullPool))

    return create_async_engine(dsn, **engine_options)


def create_sessionmaker(engine: AsyncEngine) -> async_sessionmaker[AsyncSession]:
    return async_sessionmaker(
        engine,
        autocommit=False,
        autoflush=False,
        expire_on_commit=False,
        class_=AsyncSession,
    )


__all__ = ["AsyncSession", "AsyncEngine", "create_engine", "create_sessionmaker", "sql"]
