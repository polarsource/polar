from __future__ import annotations

from functools import cache
from typing import Any, ClassVar, TypeVar

from blinker import Signal
from polar.postgres import AsyncSession, sql
from polar.schema.base import Schema
from sqlalchemy import Column, column
from sqlalchemy.orm import Mapped, declared_attr, query_expression, with_expression
from sqlalchemy.orm.properties import MappedColumn
from sqlalchemy.sql.selectable import FromClause

ModelType = TypeVar("ModelType", bound="ActiveRecordMixin")
SchemaType = TypeVar("SchemaType", bound=Schema)


# Active Record-ish
class ActiveRecordMixin:
    __mutables__: set[Column[Any]] | set[str] | None = None
    __table__: ClassVar[FromClause]

    on_created_signal: Signal | None = None
    on_updated_signal: Signal | None = None
    on_deleted_signal: Signal | None = None

    # Support Postgres upserts and being able to easily identify SQLAlchemy objects as
    # new (inserted) or updated (on conflict).
    #
    # Postgres has `xmax` as a system column containing the row lock in case of updates.
    #
    # https://www.cybertec-postgresql.com/en/whats-in-an-xmax/
    # https://stackoverflow.com/questions/59579151/how-do-i-select-a-postgresql-system-column-using-sqlalchemy
    @declared_attr
    @classmethod
    def xmax(cls) -> Mapped[int]:
        # Unless we use `with_expression` to get `xmax` this will be None
        return query_expression()

    @property
    def was_created(self) -> bool:
        return getattr(self, "_was_created", False)

    @was_created.setter
    def was_created(self, value: bool) -> None:
        self._was_created = value

    @property
    def was_updated(self) -> bool:
        return getattr(self, "_was_updated", False)

    @was_updated.setter
    def was_updated(self, value: bool) -> None:
        self._was_updated = value

    @classmethod
    @cache
    def get_mutable_keys(cls: type[ModelType]) -> set[str]:
        def name(c: str | MappedColumn[Any] | Column[Any]) -> str:
            if hasattr(c, "name"):
                return c.name
            return c

        columns = cls.__mutables__
        if columns is not None:
            return set(name(column) for column in columns)

        columns = {c.name for c in cls.__table__.c}
        pks = {pk.name for pk in cls.__table__.primary_key}
        return columns - pks

    @classmethod
    async def find(
        cls: type[ModelType], session: AsyncSession, id: Any, key: str = "id"
    ) -> ModelType | None:
        params = {}
        params[key] = id
        return await cls.find_by(session, **params)

    @classmethod
    async def find_by(
        cls: type[ModelType],
        session: AsyncSession,
        **params: Any,
    ) -> ModelType | None:
        query = sql.select(cls).filter_by(**params)
        res = await session.execute(query)
        return res.scalars().one_or_none()

    @classmethod
    async def create(
        cls: type[ModelType],
        session: AsyncSession,
        autocommit: bool = True,
        **values: Any,
    ) -> ModelType:
        instance = cls()
        instance.fill(**values)
        created = await instance.save(session, autocommit=autocommit)
        await created.on_created()
        return created

    @classmethod
    async def upsert_many(
        cls: type[ModelType],
        session: AsyncSession,
        objects: list[SchemaType],
        index_elements: list[Column[Any]],
    ) -> list[ModelType]:
        values = [obj.dict() for obj in objects]
        if not values:
            raise ValueError("Zero values provided")

        # Create a literal column for xmax to be able to select it in the ORM statement
        xmax = column("xmax", is_literal=True, _selectable=cls.__table__)

        insert_stmt = sql.insert(cls).values(values)
        # Custom method to only get columns we've flagged as mutable on updates
        mutable_keys = cls.get_mutable_keys()
        # Update the insert statement with what to update on conflict, i.e mutable keys.
        upsert_stmt = insert_stmt.on_conflict_do_update(
            index_elements=index_elements,
            set_={k: getattr(insert_stmt.excluded, k) for k in mutable_keys},
        ).returning(cls, xmax)
        # Our Postgres upsert query with the added xmax column to detect inserts
        # or updates per row and bind them to the SQLAlchemy objects.
        orm_stmt = (
            sql.select(cls, xmax)
            .from_statement(upsert_stmt)
            .options(with_expression(cls.xmax, xmax))
            .execution_options(populate_existing=True)
        )
        res = await session.execute(orm_stmt)
        instances = res.scalars().all()
        await session.commit()
        await cls.on_upserted(instances)
        return instances

    @classmethod
    async def upsert(
        cls: type[ModelType],
        session: AsyncSession,
        obj: SchemaType,
        index_elements: list[Column[Any]],
    ) -> ModelType:
        upserted: list[ModelType] = await cls.upsert_many(
            session, [obj], index_elements=index_elements
        )
        return upserted[0]

    @classmethod
    async def on_upserted(cls, instances: list[ModelType]) -> None:
        for instance in instances:
            if not isinstance(instance.xmax, int):
                continue

            if instance.xmax == 0:
                await instance.on_created()
            elif instance.xmax != 0:
                await instance.on_updated()

    def fill(
        self: ModelType,
        include: set[str] | None = None,
        exclude: set[str] | None = None,
        **values: Any,
    ) -> ModelType:
        exclude = exclude if exclude else set()
        for column, value in values.items():
            if isinstance(include, set) and column not in include:
                continue

            if column not in exclude:
                setattr(self, column, value)
        return self

    async def save(
        self: ModelType, session: AsyncSession, autocommit: bool = True
    ) -> ModelType:
        session.add(self)
        if autocommit:
            await session.commit()
        return self

    async def update(
        self: ModelType,
        session: AsyncSession,
        autocommit: bool = True,
        include: set[str] | None = None,
        exclude: set[str] | None = None,
        **values: Any,
    ) -> ModelType:
        if not include:
            include = self.get_mutable_keys()
        updated = self.fill(include=include, exclude=exclude, **values)
        res = await updated.save(session, autocommit=autocommit)
        await self.on_updated()
        return res

    async def delete(self: ModelType, session: AsyncSession) -> None:
        # TODO: Can we get an affected rows or similar to verify delete?
        await session.delete(self)
        await session.commit()
        await self.on_deleted()

    async def signal_state_change(self, state: str) -> None:
        signal = getattr(self, f"on_{state}_signal", None)
        if signal:
            await signal.send_async(self)

    async def on_updated(self) -> None:
        self.was_updated = True
        await self.signal_state_change("updated")

    async def on_created(self) -> None:
        self.was_created = True
        await self.signal_state_change("created")

    async def on_deleted(self) -> None:
        await self.signal_state_change("deleted")
