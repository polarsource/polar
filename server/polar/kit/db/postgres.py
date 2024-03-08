from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

from ..extensions.sqlalchemy import sql


def create_engine(
    *, dsn: str, application_name: str | None = None, debug: bool = False
) -> AsyncEngine:
    return create_async_engine(
        dsn,
        echo=debug,
        connect_args={"server_settings": {"application_name": application_name}}
        if application_name
        else {},
    )


def create_sessionmaker(engine: AsyncEngine) -> async_sessionmaker[AsyncSession]:
    return async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)


__all__ = [
    "AsyncSession",
    "AsyncEngine",
    "async_sessionmaker",
    "create_engine",
    "create_sessionmaker",
    "sql",
]
