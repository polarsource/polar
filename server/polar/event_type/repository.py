from collections.abc import Sequence
from uuid import UUID

from sqlalchemy import Select, select
from sqlalchemy.exc import IntegrityError

from polar.authz.types import AccessibleOrganizationID
from polar.kit.repository import RepositoryBase, RepositoryIDMixin
from polar.models import EventType


class EventTypeRepository(
    RepositoryBase[EventType], RepositoryIDMixin[EventType, UUID]
):
    model = EventType

    def get_statement_by_org_ids(
        self, org_ids: set[AccessibleOrganizationID]
    ) -> Select[tuple[EventType]]:
        return self.get_base_statement().where(EventType.organization_id.in_(org_ids))

    async def get_by_name_and_organization(
        self, name: str, organization_id: UUID
    ) -> EventType | None:
        statement = select(EventType).where(
            EventType.name == name,
            EventType.organization_id == organization_id,
            EventType.is_deleted.is_(False),
        )
        result = await self.session.execute(statement)
        return result.scalar_one_or_none()

    async def get_by_names_and_organization(
        self, names: list[str], organization_id: UUID | Sequence[UUID]
    ) -> dict[tuple[UUID, str], EventType]:
        if not names:
            return {}
        org_filter = (
            EventType.organization_id.in_(organization_id)
            if isinstance(organization_id, Sequence)
            else EventType.organization_id == organization_id
        )
        statement = select(EventType).where(
            EventType.name.in_(names),
            org_filter,
            EventType.is_deleted.is_(False),
        )
        result = await self.session.execute(statement)
        return {(et.organization_id, et.name): et for et in result.scalars().all()}

    async def get_or_create(self, name: str, organization_id: UUID) -> EventType:
        existing = await self.get_by_name_and_organization(name, organization_id)
        if existing:
            return existing

        event_type = EventType(name=name, label=name, organization_id=organization_id)
        nested = await self.session.begin_nested()
        try:
            self.session.add(event_type)
            await self.session.flush()
        except IntegrityError:
            await nested.rollback()
            existing = await self.get_by_name_and_organization(name, organization_id)
            if existing:
                return existing
            raise
        return event_type
