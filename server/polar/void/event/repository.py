from collections.abc import Sequence
from datetime import datetime
from uuid import UUID

from sqlalchemy import func, select, update
from sqlalchemy.dialects.postgresql import insert

from polar.kit.repository import RepositoryBase
from polar.models import Event as EventModel


class EventRepository(RepositoryBase[EventModel]):
    model = EventModel

    async def timestamp_range(
        self, organization_id: UUID
    ) -> tuple[datetime | None, datetime | None]:
        result = await self.session.execute(
            select(
                func.min(EventModel.timestamp), func.max(EventModel.timestamp)
            ).where(EventModel.organization_id == organization_id)
        )
        start, end = result.one()
        return start, end

    async def existing_external_ids(
        self, organization_id: UUID, external_ids: Sequence[str]
    ) -> set[str]:
        result = await self.session.execute(
            select(EventModel.external_id).where(
                EventModel.organization_id == organization_id,
                EventModel.external_id.in_(external_ids),
            )
        )
        return {
            external_id for external_id in result.scalars() if external_id is not None
        }

    async def insert_events(self, events: Sequence[EventModel]) -> int:
        if not events:
            return 0
        result = await self.session.execute(
            insert(EventModel)
            .values(
                [
                    {
                        "id": event.id,
                        "organization_id": event.organization_id,
                        "external_id": event.external_id,
                        "timestamp": event.timestamp,
                        "ingested_at": event.ingested_at,
                        "name": event.name,
                        "source": event.source,
                        "external_identity_id": event.external_identity_id,
                        "external_root_id": event.external_root_id,
                        "external_customer_id": event.external_customer_id,
                        "user_metadata": event.user_metadata,
                    }
                    for event in sorted(
                        events, key=lambda event: event.external_id or ""
                    )
                ]
            )
            .on_conflict_do_nothing(index_elements=["organization_id", "external_id"])
            .returning(EventModel.id)
        )
        return len(result.scalars().all())

    async def pending(
        self, organization_ids: set[UUID], *, limit: int
    ) -> Sequence[EventModel]:
        return await self.get_all(
            select(EventModel)
            .where(
                EventModel.organization_id.in_(organization_ids),
                EventModel.delivered_at.is_(None),
            )
            .order_by(EventModel.ingested_at, EventModel.id)
            .limit(limit)
            .with_for_update(skip_locked=True)
        )

    async def mark_delivered(self, events: Sequence[EventModel], at: datetime) -> None:
        await self.session.execute(
            update(EventModel)
            .where(EventModel.id.in_([event.id for event in events]))
            .values(delivered_at=at)
        )

    async def list_window(
        self,
        organization_id: UUID,
        identities: Sequence[str],
        start: datetime,
        end: datetime,
        event_names: Sequence[str] | None,
        limit: int,
    ) -> Sequence[EventModel]:
        """Newest first, so the cap keeps the most recent events of a busy window."""
        if not identities:
            return []
        statement = (
            select(EventModel)
            .where(
                EventModel.organization_id == organization_id,
                EventModel.external_identity_id.in_(list(identities)),
                EventModel.timestamp >= start,
                EventModel.timestamp <= end,
            )
            .order_by(EventModel.timestamp.desc(), EventModel.id.desc())
            .limit(limit)
        )
        if event_names is not None:
            statement = statement.where(EventModel.name.in_(list(event_names)))
        return await self.get_all(statement)
