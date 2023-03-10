from uuid import UUID
from typing import AsyncGenerator

import pytest
from sqlalchemy import Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from polar.kit.utils import generate_uuid
from polar.kit.extensions.sqlalchemy import PostgresUUID
from polar.models import Model, StatusMixin
from polar.postgres import AsyncEngineLocal, AsyncSession, AsyncSessionLocal


class TestModel(StatusMixin, Model):
    __test__ = False  # This is a base class, not a test

    __tablename__ = "test_model"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    uuid: Mapped[UUID] = mapped_column(PostgresUUID, default=generate_uuid)
    int_column: Mapped[int | None] = mapped_column(Integer)
    str_column: Mapped[str | None] = mapped_column(String)

    # TODO: Reintroduce testing_ctx?
    # def __init__(self, *args: Any, **kwargs: Any) -> None:
    #     super().__init__(*args, **kwargs)
    #     self.testing_ctx: dict[str, Any] = {}


@pytest.fixture(scope="session", autouse=True)
async def initialize_test_database() -> None:
    async with AsyncEngineLocal.begin() as conn:
        await conn.run_sync(Model.metadata.drop_all)
        await conn.run_sync(Model.metadata.create_all)

    # with AsyncSessionLocal.begin() as conn:
    # await conn.run_sync(Model.metadata.create_all)


@pytest.fixture(scope="session")
async def session() -> AsyncGenerator[AsyncSession, None]:
    yield AsyncSessionLocal()
    # async with AsyncSessionLocal() as session:
    #   yield session
