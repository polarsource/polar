from collections.abc import AsyncGenerator, Sequence
from datetime import datetime
from typing import Any, Generic, Protocol, Self, TypeAlias, TypeVar

from sqlalchemy import Select, UnaryExpression, asc, desc, func, over, select
from sqlalchemy.orm import Mapped
from sqlalchemy.sql.base import ExecutableOption
from sqlalchemy.sql.expression import ColumnExpressionArgument

from polar.kit.db.postgres import AsyncSession
from polar.kit.sorting import PE, Sorting
from polar.kit.utils import utc_now

M = TypeVar("M")


class ModelDeletedAtProtocol(Protocol):
    deleted_at: Mapped[datetime | None]


MODEL_DELETED_AT = TypeVar("MODEL_DELETED_AT", bound=ModelDeletedAtProtocol)

ID_TYPE = TypeVar("ID_TYPE")


class ModelIDProtocol(Protocol[ID_TYPE]):
    id: Mapped[ID_TYPE]


MODEL_ID = TypeVar("MODEL_ID", bound=ModelIDProtocol)  # type: ignore[type-arg]


class ModelDeletedAtIDProtocol(Protocol[ID_TYPE]):
    id: Mapped[ID_TYPE]
    deleted_at: Mapped[datetime | None]


MODEL_DELETED_AT_ID = TypeVar("MODEL_DELETED_AT_ID", bound=ModelDeletedAtIDProtocol)  # type: ignore[type-arg]

Options: TypeAlias = Sequence[ExecutableOption]


class RepositoryProtocol(Protocol[M]):
    model: type[M]

    async def get_one_or_none(self, statement: Select[tuple[M]]) -> M | None: ...

    async def get_all(self, statement: Select[tuple[M]]) -> Sequence[M]: ...

    async def paginate(
        self, statement: Select[tuple[M]], *, limit: int, page: int
    ) -> tuple[list[M], int]: ...

    def get_base_statement(self) -> Select[tuple[M]]: ...

    async def create(self, object: M, *, flush: bool = False) -> M: ...

    async def update(
        self,
        object: M,
        *,
        update_dict: dict[str, Any] | None = None,
        flush: bool = False,
    ) -> M: ...


class RepositoryBase(Generic[M]):
    model: type[M]

    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def get_one_or_none(self, statement: Select[tuple[M]]) -> M | None:
        result = await self.session.execute(statement)
        return result.scalar_one_or_none()

    async def get_all(self, statement: Select[tuple[M]]) -> Sequence[M]:
        result = await self.session.execute(statement)
        return result.scalars().unique().all()

    async def stream(self, statement: Select[tuple[M]]) -> AsyncGenerator[M, None]:
        results = await self.session.stream(statement)
        async for result in results.unique().scalars():
            yield result

    async def paginate(
        self, statement: Select[tuple[M]], *, limit: int, page: int
    ) -> tuple[list[M], int]:
        offset = (page - 1) * limit
        paginated_statement: Select[tuple[M, int]] = (
            statement.add_columns(over(func.count())).limit(limit).offset(offset)
        )
        results = await self.session.stream(paginated_statement)

        items: list[M] = []
        count = 0
        async for result in results.unique():
            item, count = result._tuple()
            items.append(item)

        return items, count

    def get_base_statement(self) -> Select[tuple[M]]:
        return select(self.model)

    async def create(self, object: M, *, flush: bool = False) -> M:
        self.session.add(object)

        if flush:
            await self.session.flush()

        return object

    async def update(
        self,
        object: M,
        *,
        update_dict: dict[str, Any] | None = None,
        flush: bool = False,
    ) -> M:
        if update_dict is not None:
            for attr, value in update_dict.items():
                setattr(object, attr, value)

        self.session.add(object)

        if flush:
            await self.session.flush()

        return object

    @classmethod
    def from_session(cls, session: AsyncSession) -> Self:
        return cls(session)


class RepositorySoftDeletionProtocol(
    RepositoryProtocol[MODEL_DELETED_AT],
    Protocol[MODEL_DELETED_AT],
):
    def get_base_statement(
        self, *, include_deleted: bool = False
    ) -> Select[tuple[MODEL_DELETED_AT]]: ...

    async def soft_delete(
        self, object: MODEL_DELETED_AT, *, flush: bool = False
    ) -> MODEL_DELETED_AT: ...


class RepositorySoftDeletionMixin(Generic[MODEL_DELETED_AT]):
    def get_base_statement(
        self: RepositoryProtocol[MODEL_DELETED_AT],
        *,
        include_deleted: bool = False,
    ) -> Select[tuple[MODEL_DELETED_AT]]:
        statement = super().get_base_statement()  # type: ignore[safe-super]
        if not include_deleted:
            statement = statement.where(self.model.deleted_at.is_(None))
        return statement

    async def soft_delete(
        self: RepositoryProtocol[MODEL_DELETED_AT],
        object: MODEL_DELETED_AT,
        *,
        flush: bool = False,
    ) -> MODEL_DELETED_AT:
        return await self.update(
            object, update_dict={"deleted_at": utc_now()}, flush=flush
        )


class RepositoryIDMixin(Generic[MODEL_ID, ID_TYPE]):
    async def get_by_id(
        self: RepositoryProtocol[MODEL_ID],
        id: ID_TYPE,
        *,
        options: Options = (),
    ) -> MODEL_ID | None:
        statement = (
            self.get_base_statement().where(self.model.id == id).options(*options)
        )
        return await self.get_one_or_none(statement)


class RepositorySoftDeletionIDMixin(Generic[MODEL_DELETED_AT_ID, ID_TYPE]):
    async def get_by_id(
        self: RepositorySoftDeletionProtocol[MODEL_DELETED_AT_ID],
        id: ID_TYPE,
        *,
        options: Options = (),
        include_deleted: bool = False,
    ) -> MODEL_DELETED_AT_ID | None:
        statement = (
            self.get_base_statement(include_deleted=include_deleted)
            .where(self.model.id == id)
            .options(*options)
        )
        return await self.get_one_or_none(statement)


SortingClause: TypeAlias = ColumnExpressionArgument[Any] | UnaryExpression[Any]


class RepositorySortingMixin(Generic[M, PE]):
    sorting_enum: type[PE]

    def apply_sorting(
        self,
        statement: Select[tuple[M]],
        sorting: list[Sorting[PE]],
    ) -> Select[tuple[M]]:
        order_by_clauses: list[UnaryExpression[Any]] = []
        for criterion, is_desc in sorting:
            clause_function = desc if is_desc else asc
            order_by_clauses.append(clause_function(self.get_sorting_clause(criterion)))
        return statement.order_by(*order_by_clauses)

    def get_sorting_clause(self, property: PE) -> SortingClause:
        raise NotImplementedError()
