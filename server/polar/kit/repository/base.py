from collections.abc import Sequence
from datetime import datetime
from typing import Generic, Protocol, Self, TypeVar

from sqlalchemy import Select, select
from sqlalchemy.orm import Mapped

from polar.kit.db.postgres import AsyncSession

M = TypeVar("M")
ID_TYPE = TypeVar("ID_TYPE")


class ModelIDProtocol(Protocol[ID_TYPE]):
    id: Mapped[ID_TYPE]


MODEL_ID = TypeVar("MODEL_ID", bound=ModelIDProtocol)  # type: ignore[type-arg]


class ModelDeletedAtProtocol(Protocol):
    deleted_at: Mapped[datetime | None]


MODEL_DELETED_AT = TypeVar("MODEL_DELETED_AT", bound=ModelDeletedAtProtocol)


class RepositoryProtocol(Protocol[M]):
    model: type[M]

    async def get_one_or_none(self, statement: Select[tuple[M]]) -> M | None: ...

    async def get_all(self, statement: Select[tuple[M]]) -> Sequence[M]: ...

    def get_base_statement(self) -> Select[tuple[M]]: ...


class RepositoryBase(Generic[M]):
    model: type[M]

    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def get_one_or_none(self, statement: Select[tuple[M]]) -> M | None:
        result = await self.session.execute(statement)
        return result.scalar_one_or_none()

    async def get_all(self, statement: Select[tuple[M]]) -> Sequence[M]:
        result = await self.session.execute(statement)
        return result.scalars().all()

    def get_base_statement(self) -> Select[tuple[M]]:
        return select(self.model)

    @classmethod
    def from_session(cls, session: AsyncSession) -> Self:
        return cls(session)


class RepositoryIDMixin(Generic[MODEL_ID, ID_TYPE]):
    async def get_by_id(
        self: RepositoryProtocol[MODEL_ID], id: ID_TYPE
    ) -> MODEL_ID | None:
        statement = self.get_base_statement().where(self.model.id == id)
        return await self.get_one_or_none(statement)


class RepositorySoftDeletionMixin(Generic[MODEL_DELETED_AT]):
    def get_base_statement(
        self: RepositoryProtocol[MODEL_DELETED_AT],
    ) -> Select[tuple[MODEL_DELETED_AT]]:
        return super().get_base_statement().where(self.model.deleted_at.is_(None))  # type: ignore[safe-super]
