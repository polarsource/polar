from polar.config import settings
from polar.kit.db.postgres import AsyncEngine, AsyncSession
from polar.kit.db.postgres import create_engine as _create_engine
from polar.kit.db.postgres import create_sessionmaker, sql


def create_engine(is_celery: bool = False) -> AsyncEngine:
    return _create_engine(
        dsn=str(settings.postgres_dsn),
        is_celery=is_celery,
        debug=settings.DEBUG,
    )


AsyncEngineLocal = create_engine()
AsyncSessionLocal = create_sessionmaker(engine=AsyncEngineLocal)


__all__ = [
    "AsyncSessionLocal",
    "AsyncSession",
    "AsyncEngineLocal",
    "sql",
    "create_engine",
    "create_sessionmaker",
]
