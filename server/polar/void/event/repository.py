from collections.abc import Sequence
from datetime import datetime
from uuid import UUID

from sqlalchemy import select, update
from sqlalchemy.dialects.postgresql import insert

from polar.kit.repository import RepositoryBase
from polar.models import VoidEvent


class EventRepository(RepositoryBase[VoidEvent]):
    model = VoidEvent

    async def existing_external_ids(
        self, organization_id: UUID, external_ids: Sequence[str]
    ) -> set[str]:
        result = await self.session.execute(
            select(VoidEvent.external_id).where(
                VoidEvent.organization_id == organization_id,
                VoidEvent.external_id.in_(external_ids),
            )
        )
        return set(result.scalars())

    async def insert_events(self, events: Sequence[VoidEvent]) -> int:
        if not events:
            return 0
        result = await self.session.execute(
            insert(VoidEvent)
            .values(
                [
                    {
                        "id": event.id,
                        "organization_id": event.organization_id,
                        "external_id": event.external_id,
                        "timestamp": event.timestamp,
                        "payload": event.payload,
                    }
                    for event in sorted(events, key=lambda event: event.external_id)
                ]
            )
            .on_conflict_do_nothing(index_elements=["organization_id", "external_id"])
            .returning(VoidEvent.id)
        )
        return len(result.scalars().all())

    async def pending(
        self, organization_ids: set[UUID], *, limit: int
    ) -> Sequence[VoidEvent]:
        return await self.get_all(
            select(VoidEvent)
            .where(
                VoidEvent.organization_id.in_(organization_ids),
                VoidEvent.delivered_at.is_(None),
            )
            .order_by(VoidEvent.created_at, VoidEvent.id)
            .limit(limit)
            .with_for_update(skip_locked=True)
        )

    async def mark_delivered(self, events: Sequence[VoidEvent], at: datetime) -> None:
        await self.session.execute(
            update(VoidEvent)
            .where(VoidEvent.id.in_([event.id for event in events]))
            .values(delivered_at=at)
        )
