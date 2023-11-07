from collections.abc import AsyncIterator
from uuid import UUID

import pytest_asyncio
from sqlalchemy import Integer, String
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import text

from polar.kit.db.postgres import AsyncEngine, AsyncSession
from polar.kit.extensions.sqlalchemy import PostgresUUID
from polar.kit.utils import generate_uuid
from polar.models import Model
from polar.postgres import create_engine


class TestModel(Model):
    __test__ = False  # This is a base class, not a test

    __tablename__ = "test_model"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, default=None)
    uuid: Mapped[UUID] = mapped_column(PostgresUUID, default=generate_uuid)
    int_column: Mapped[int | None] = mapped_column(Integer, default=None, nullable=True)
    str_column: Mapped[str | None] = mapped_column(String, default=None, nullable=True)


@pytest_asyncio.fixture(scope="session")
async def engine() -> AsyncIterator[AsyncEngine]:
    engine = create_engine()
    yield engine
    await engine.dispose()


@pytest_asyncio.fixture(scope="session", autouse=True)
async def initialize_test_database(engine: AsyncEngine) -> None:
    async with engine.begin() as conn:
        await conn.run_sync(Model.metadata.drop_all)
        await conn.execute(text("CREATE EXTENSION IF NOT EXISTS citext"))
        await conn.run_sync(Model.metadata.create_all)


@pytest_asyncio.fixture
async def session(engine: AsyncEngine) -> AsyncIterator[AsyncSession]:
    connection = await engine.connect()
    transaction = await connection.begin()

    session = AsyncSession(
        bind=connection,
        expire_on_commit=False,
        autocommit=False,
        autoflush=False,
    )

    yield session

    await transaction.rollback()
    await connection.close()
