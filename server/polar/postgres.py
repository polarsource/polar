from polar.config import settings
from polar.ext.sqlalchemy import sql
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import NullPool


def create_sessionmaker(is_celery: bool = False) -> sessionmaker:
    engine_options = dict(echo=settings.DEBUG)
    if is_celery:
        # TODO: Change pooling strategy for celery workers.
        # In the meantime, we're using NullPool to avoid
        # issues with asyncio in Celery.
        engine_options.update(dict(poolclass=NullPool))

    engine = create_async_engine(settings.postgres_dsn, **engine_options)
    return sessionmaker(
        engine,
        autocommit=False,
        autoflush=False,
        expire_on_commit=False,
        class_=AsyncSession,
    )


AsyncSessionLocal = create_sessionmaker()


__all__ = ["sql", "AsyncSessionLocal", "AsyncSession"]
