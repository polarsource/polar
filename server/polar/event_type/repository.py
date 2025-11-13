from uuid import UUID

from sqlalchemy import select

from polar.kit.repository import RepositoryBase, RepositoryIDMixin
from polar.models import EventType


class EventTypeRepository(
    RepositoryBase[EventType], RepositoryIDMixin[EventType, UUID]
):
    model = EventType

    async def get_by_name_and_organization(
        self, name: str, organization_id: UUID
    ) -> EventType | None:
        statement = select(EventType).where(
            EventType.name == name,
            EventType.organization_id == organization_id,
            EventType.deleted_at.is_(None),
        )
        result = await self.session.execute(statement)
        return result.scalar_one_or_none()

    async def get_or_create(self, name: str, organization_id: UUID) -> EventType:
        existing = await self.get_by_name_and_organization(name, organization_id)
        if existing:
            return existing

        event_type = EventType(name=name, label=name, organization_id=organization_id)
        self.session.add(event_type)
        await self.session.flush()
        return event_type
