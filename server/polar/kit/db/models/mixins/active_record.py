from __future__ import annotations

from typing import Any, ClassVar, Self

from sqlalchemy.sql.selectable import FromClause

from polar.postgres import AsyncSession


# Active Record-ish
class ActiveRecordMixin:
    __table__: ClassVar[FromClause]

    def fill(self, **values: Any) -> Self:
        for col, value in values.items():
            if not hasattr(self, col):
                raise Exception(f"has no attr: {col}")
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
        **values: Any,
    ) -> Self:
        updated = self.fill(**values)
        return await updated.save(session, autocommit=autocommit)

    async def delete(self: Any, session: AsyncSession) -> None:
        # TODO: Can we get an affected rows or similar to verify delete?
        await session.delete(self)
        await session.commit()
