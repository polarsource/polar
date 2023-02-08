import uuid
from typing import Any, AsyncGenerator

import pytest
from sqlalchemy import Integer, String, text
from sqlalchemy.orm import Mapped, mapped_column

from polar.ext.sqlalchemy import GUID
from polar.models import Model, StatusMixin
from polar.postgres import AsyncSession, AsyncSessionLocal, engine


class TestModel(StatusMixin, Model):
    __tablename__ = "test_model"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    guid: Mapped[uuid.UUID] = mapped_column(GUID, default=GUID.generate)
    int_column: Mapped[int | None] = mapped_column(Integer)
    str_column: Mapped[str | None] = mapped_column(String)

    def __init__(self, *args: Any, **kwargs: Any) -> None:
        super().__init__(*args, **kwargs)
        self.testing_ctx: dict[str, Any] = {}


@pytest.fixture(scope="session", autouse=True)
async def initialize_test_database() -> None:
    async with engine.begin() as conn:
        await conn.run_sync(Model.metadata.drop_all)

    async with engine.begin() as conn:
        await conn.run_sync(Model.metadata.create_all)


@pytest.fixture()
async def session() -> AsyncGenerator[AsyncSession, None]:
    async with AsyncSessionLocal() as session:
        yield session
