from collections.abc import Sequence
from datetime import datetime
from typing import Any

from sqlalchemy import select, update
from sqlalchemy.dialects.sqlite import insert
from sqlalchemy.ext.asyncio import AsyncSession

from polar.models import Event


class EventRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def buffer(self, bodies: list[dict[str, Any]]) -> tuple[int, int]:
        seen: set[str] = set()
        rows: list[dict[str, Any]] = []
        for body in bodies:
            external_id = body["external_id"]
            if external_id in seen:
                continue
            seen.add(external_id)
            rows.append({"external_id": external_id, "body": body})
        if not rows:
            return 0, len(bodies)
        statement = (
            insert(Event)
            .values(rows)
            .on_conflict_do_nothing(index_elements=["external_id"])
            .returning(Event.id)
        )
        result = await self.session.execute(statement)
        inserted = len(result.scalars().all())
        return inserted, len(bodies) - inserted

    async def get_unacknowledged(self, limit: int) -> Sequence[Event]:
        statement = (
            select(Event)
            .where(Event.acknowledged_at.is_(None))
            .order_by(Event.id)
            .limit(limit)
        )
        result = await self.session.execute(statement)
        return result.scalars().all()

    async def acknowledge(self, ids: list[int], acknowledged_at: datetime) -> None:
        statement = (
            update(Event)
            .where(Event.id.in_(ids))
            .values(acknowledged_at=acknowledged_at)
        )
        await self.session.execute(statement)
