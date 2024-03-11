from __future__ import annotations

from typing import Any, ClassVar

from sqlalchemy.sql.selectable import FromClause

from polar.postgres import AsyncSession


# Active Record-ish
class ActiveRecordMixin:
    __table__: ClassVar[FromClause]

    async def delete(self: Any, session: AsyncSession) -> None:
        # TODO: Can we get an affected rows or similar to verify delete?
        await session.delete(self)
        await session.commit()
