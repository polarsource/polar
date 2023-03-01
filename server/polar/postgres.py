from typing import Any

from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.pool import NullPool

from polar.config import settings
from polar.ext.sqlalchemy import sql


def create_engine(is_celery: bool = False) -> AsyncEngine:
    engine_options: dict[str, Any] = dict(echo=settings.DEBUG)
    if is_celery:
        # TODO: Change pooling strategy for celery workers.
        # In the meantime, we're using NullPool to avoid
        # issues with asyncio in Celery.
        engine_options.update(dict(poolclass=NullPool))

    return create_async_engine(settings.postgres_dsn, **engine_options)


AsyncEngineLocal = create_engine()


def create_sessionmaker(
    engine: AsyncEngine = AsyncEngineLocal,
) -> async_sessionmaker[AsyncSession]:
    return async_sessionmaker(
        engine,
        autocommit=False,
        autoflush=False,
        expire_on_commit=False,
        class_=AsyncSession,
    )


AsyncSessionLocal = create_sessionmaker()


__all__ = ["sql", "AsyncSessionLocal", "AsyncSession", "AsyncEngineLocal"]
