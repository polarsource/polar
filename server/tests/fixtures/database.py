from uuid import UUID
from typing import AsyncGenerator

import pytest_asyncio
from sqlalchemy import Integer, String
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import text


from polar.kit.utils import generate_uuid
from polar.kit.extensions.sqlalchemy import PostgresUUID
from polar.models import Model
from polar.postgres import AsyncEngineLocal, AsyncSession, AsyncSessionLocal


class TestModel(Model):
    __test__ = False  # This is a base class, not a test

    __tablename__ = "test_model"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    uuid: Mapped[UUID] = mapped_column(PostgresUUID, default=generate_uuid)
    int_column: Mapped[int | None] = mapped_column(Integer)
    str_column: Mapped[str | None] = mapped_column(String)


@pytest_asyncio.fixture(scope="module", autouse=True)
async def initialize_test_database(session: AsyncSession) -> None:
    await session.commit()

    async with AsyncEngineLocal.begin() as conn:
        await conn.run_sync(Model.metadata.drop_all)
        await conn.execute(text("CREATE EXTENSION IF NOT EXISTS citext"))
        await conn.run_sync(Model.metadata.create_all)


@pytest_asyncio.fixture(scope="function")
async def initialize_test_database_function(session: AsyncSession) -> None:
    await session.commit()

    async with AsyncEngineLocal.begin() as conn:
        await conn.run_sync(Model.metadata.drop_all)
        await conn.execute(text("CREATE EXTENSION IF NOT EXISTS citext"))
        await conn.run_sync(Model.metadata.create_all)


@pytest_asyncio.fixture(scope="session")
async def session() -> AsyncGenerator[AsyncSession, None]:
    async with AsyncSessionLocal() as session:
        yield session
