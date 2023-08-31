from __future__ import annotations

from functools import cache
from typing import Any, ClassVar, Self, Sequence, TypeVar

from sqlalchemy import Column
from sqlalchemy.orm import (
    InstrumentedAttribute,
)
from sqlalchemy.orm.properties import MappedColumn
from sqlalchemy.sql.selectable import FromClause

from polar.kit.schemas import Schema
from polar.postgres import AsyncSession, sql

SchemaType = TypeVar("SchemaType", bound=Schema)


# Active Record-ish
class ActiveRecordMixin:
    __mutables__: set[Column[Any]] | set[str] | None = None
    __table__: ClassVar[FromClause]

    @classmethod
    @cache
    def get_mutable_keys(cls) -> set[str]:
        def name(c: str | MappedColumn[Any] | Column[Any]) -> str:
            if isinstance(c, str):
                return c
            if hasattr(c, "name"):
                return c.name
            raise Exception("no mutable key name found")

        columns = cls.__mutables__
        if columns is not None:
            return {name(column) for column in columns}

        columnNames = {c.name for c in cls.__table__.c}
        pks = {pk.name for pk in cls.__table__.primary_key}
        return columnNames - pks

    @classmethod
    async def find(cls, session: AsyncSession, id: Any, key: str = "id") -> Self | None:
        params = {key: id}
        return await cls.find_by(session, **params)

    @classmethod
    async def find_by(
        cls,
        session: AsyncSession,
        **params: Any,
    ) -> Self | None:
        query = sql.select(cls).filter_by(**params)
        res = await session.execute(query)
        return res.scalars().unique().one_or_none()

    @classmethod
    async def create(
        cls,
        session: AsyncSession,
        autocommit: bool = True,
        **values: Any,
    ) -> Self:
        instance = cls()
        instance.fill(**values)

        return await instance.save(session, autocommit=autocommit)

    @classmethod
    async def upsert_many(
        cls,
        session: AsyncSession,
        objects: list[SchemaType],
        constraints: list[InstrumentedAttribute[Any]],
        # Defaults to the mutable keys as defined by on the Model
        mutable_keys: set[str] | None = None,
        autocommit: bool = True,
    ) -> Sequence[Self]:
        values = [obj.dict() for obj in objects]
        if not values:
            raise ValueError("Zero values provided")

        insert_stmt = sql.insert(cls).values(values)

        # Custom method to only get columns we've flagged as mutable on updates
        if mutable_keys is None:
            mutable_keys = cls.get_mutable_keys()

        # Update the insert statement with what to update on conflict, i.e mutable keys.
        upsert_stmt = (
            insert_stmt.on_conflict_do_update(
                index_elements=constraints,
                set_={k: getattr(insert_stmt.excluded, k) for k in mutable_keys},
            )
            .returning(cls)
            .execution_options(populate_existing=True)
        )

        res = await session.execute(upsert_stmt)
        instances = res.scalars().all()
        if autocommit:
            await session.commit()
        return instances

    @classmethod
    async def upsert(
        cls,
        session: AsyncSession,
        obj: SchemaType,
        constraints: list[InstrumentedAttribute[Any]],
        mutable_keys: set[str] | None = None,
        autocommit: bool = True,
    ) -> Self:
        """
        Usage of upsert is deprecated.
        If you need an upsert, add the functionality in the service instead of relying
        active record.
        """

        upserted: Sequence[Self] = await cls.upsert_many(
            session,
            [obj],
            constraints=constraints,
            mutable_keys=mutable_keys,
            autocommit=autocommit,
        )
        return upserted[0]

    def fill(
        self,
        include: set[str] | None = None,
        exclude: set[str] | None = None,
        **values: Any,
    ) -> Self:
        exclude = exclude or set()
        for col, value in values.items():
            if not hasattr(self, col):
                raise Exception(f"has no attr: {col}")

            if isinstance(include, set) and col not in include:
                continue

            if col not in exclude:
                setattr(self, col, value)
        return self

    async def save(self, session: AsyncSession, autocommit: bool = True) -> Self:
        session.add(self)
        if autocommit:
            await session.commit()
        return self

    async def update(
        self,
        session: AsyncSession,
        autocommit: bool = True,
        include: set[str] | None = None,
        exclude: set[str] | None = None,
        **values: Any,
    ) -> Self:
        if not include:
            include = self.get_mutable_keys()
        updated = self.fill(include=include, exclude=exclude, **values)
        return await updated.save(session, autocommit=autocommit)

    async def delete(self: Any, session: AsyncSession) -> None:
        # TODO: Can we get an affected rows or similar to verify delete?
        await session.delete(self)
        await session.commit()
