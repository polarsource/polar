from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker

from polar.config import settings
from polar.ext.sqlalchemy import sql

engine = create_async_engine(settings.postgres_dsn)
AsyncSessionLocal = sessionmaker(
    engine,
    autocommit=False,
    autoflush=False,
    expire_on_commit=False,
    class_=AsyncSession,
)

__all__ = ["sql", "engine", "AsyncSessionLocal", "AsyncSession"]
