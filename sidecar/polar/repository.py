from collections.abc import Sequence
from datetime import datetime
from typing import Any

from sqlalchemy import or_, select, update
from sqlalchemy.dialects.sqlite import insert
from sqlalchemy.ext.asyncio import AsyncSession

from polar.models import CustomerMeter, Event


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

    async def record_polar_ids(self, polar_ids: dict[str, str]) -> None:
        for external_id, polar_event_id in polar_ids.items():
            statement = (
                update(Event)
                .where(Event.external_id == external_id)
                .values(polar_event_id=polar_event_id)
            )
            await self.session.execute(statement)

    async def get_local_id_for_polar_event(self, polar_event_id: str) -> int | None:
        statement = select(Event.id).where(Event.polar_event_id == polar_event_id)
        result = await self.session.execute(statement)
        return result.scalar_one_or_none()

    async def get_customer_delta_events(
        self,
        *,
        customer_id: str | None,
        external_customer_id: str | None,
        watermark_local_id: int | None,
    ) -> Sequence[Event]:
        conditions = []
        if external_customer_id is not None:
            conditions.append(
                Event.body["external_customer_id"].as_string() == external_customer_id
            )
        if customer_id is not None:
            conditions.append(Event.body["customer_id"].as_string() == customer_id)
        statement = select(Event).where(or_(*conditions))
        if watermark_local_id is not None:
            statement = statement.where(
                or_(Event.polar_event_id.is_(None), Event.id > watermark_local_id)
            )
        result = await self.session.execute(statement.order_by(Event.id))
        return result.scalars().all()


class CustomerMeterRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def upsert(self, customer_meter: CustomerMeter) -> None:
        await self.session.merge(customer_meter)

    async def get_by_id(self, id: str) -> CustomerMeter | None:
        statement = select(CustomerMeter).where(CustomerMeter.id == id)
        result = await self.session.execute(statement)
        return result.scalar_one_or_none()

    async def get_by_customer_id(self, customer_id: str) -> Sequence[CustomerMeter]:
        statement = select(CustomerMeter).where(
            CustomerMeter.customer_id == customer_id
        )
        result = await self.session.execute(statement)
        return result.scalars().all()
