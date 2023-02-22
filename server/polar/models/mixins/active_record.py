from __future__ import annotations

from functools import cache
from typing import Any, ClassVar, TypeVar

from polar.postgres import AsyncSession, sql
from polar.schema.base import Schema
from sqlalchemy import TEXT, Column
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.orm.properties import MappedColumn
from sqlalchemy.sql.selectable import FromClause

ModelType = TypeVar("ModelType", bound="ActiveRecordMixin")
SchemaType = TypeVar("SchemaType", bound=Schema)


# Active Record-ish
class ActiveRecordMixin:
    __mutables__: set[Column[Any]] | set[str] | None = None
    __table__: ClassVar[FromClause]

    # We use upserts frequently, but would still like to know when a record was
    # created vs. updated.
    #
    # Postgres has `xmax` as a system column containing the row lock in case of updates.
    # For inserts no lock is needed so it's zero (0).
    #
    # https://www.cybertec-postgresql.com/en/whats-in-an-xmax/
    # https://stackoverflow.com/questions/59579151/how-do-i-select-a-postgresql-system-column-using-sqlalchemy
    _xmax: Mapped[int] = mapped_column("xmax", TEXT, system=True)

    @property
    def was_inserted(self) -> bool:
        return self._xmax == 0

    @property
    def was_updated(self) -> bool:
        return self._xmax != 0

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
        return await instance.save(session, autocommit=autocommit)

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
        return await updated.save(session, autocommit=autocommit)

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

        insert_stmt = sql.insert(cls).values(values)
        mutable_keys = cls.get_mutable_keys()
        upsert_stmt = insert_stmt.on_conflict_do_update(
            index_elements=index_elements,
            set_={k: getattr(insert_stmt.excluded, k) for k in mutable_keys},
        ).returning(cls)
        orm_stmt = (
            sql.select(cls)
            .from_statement(upsert_stmt)
            .execution_options(populate_existing=True)
        )
        res = await session.execute(orm_stmt)
        instances = res.scalars().all()
        await session.commit()
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

    async def delete(self: ModelType, session: AsyncSession) -> None:
        # TODO: Can we get an affected rows or similar to verify delete?
        await session.delete(self)
        await session.commit()
