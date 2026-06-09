from collections.abc import Sequence
from datetime import datetime
from typing import Any

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from polar.models import Event


class EventRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def buffer(self, bodies: list[dict[str, Any]]) -> list[Event]:
        events = [
            Event(external_id=body.get("external_id"), body=body) for body in bodies
        ]
        self.session.add_all(events)
        await self.session.flush()
        return events

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
