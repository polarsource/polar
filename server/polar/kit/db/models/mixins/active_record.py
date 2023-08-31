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


# Active Record-ish
class ActiveRecordMixin:
    __table__: ClassVar[FromClause]

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
        updated = self.fill(include=include, exclude=exclude, **values)
        return await updated.save(session, autocommit=autocommit)

    async def delete(self: Any, session: AsyncSession) -> None:
        # TODO: Can we get an affected rows or similar to verify delete?
        await session.delete(self)
        await session.commit()
