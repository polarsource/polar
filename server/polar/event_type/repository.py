from collections.abc import Sequence
from uuid import UUID

from sqlalchemy import Select, select
from sqlalchemy.dialects.postgresql import insert
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
            ~EventType.is_deleted,
        )
        result = await self.session.execute(statement)
        return result.scalar_one_or_none()

    async def get_by_names_and_organization(
        self,
        names: list[str],
        organization_id: UUID | Sequence[UUID],
        *,
        include_deleted: bool = False,
    ) -> dict[tuple[UUID, str], EventType]:
        if not names:
            return {}
        org_filter = (
            EventType.organization_id.in_(organization_id)
            if isinstance(organization_id, Sequence)
            else EventType.organization_id == organization_id
        )
        statement = select(EventType).where(EventType.name.in_(names), org_filter)
        if not include_deleted:
            statement = statement.where(~EventType.is_deleted)
        result = await self.session.execute(statement)
        return {(et.organization_id, et.name): et for et in result.scalars().all()}

    async def get_or_create(self, name: str, organization_id: UUID) -> EventType:
        existing = await self.get_by_name_and_organization(name, organization_id)
        if existing:
            return existing

        event_type = EventType(name=name, label=name, organization_id=organization_id)
        try:
            async with self.session.begin_nested():
                self.session.add(event_type)
                await self.session.flush()
        except IntegrityError:
            existing = await self.get_by_name_and_organization(name, organization_id)
            if existing:
                return existing
            raise
        return event_type

    async def ensure_by_names(
        self, names: Sequence[str], organization_id: UUID
    ) -> dict[str, EventType]:
        unique_names = sorted(set(names))
        existing = await self.get_by_names_and_organization(
            unique_names, organization_id, include_deleted=True
        )
        for event_type in existing.values():
            if event_type.is_deleted:
                event_type.deleted_at = None
        missing_names = [
            name for name in unique_names if (organization_id, name) not in existing
        ]
        if missing_names:
            statement = insert(EventType).values(
                [
                    {
                        "name": name,
                        "label": name,
                        "organization_id": organization_id,
                    }
                    for name in missing_names
                ]
            )
            statement = statement.on_conflict_do_update(
                constraint="event_types_name_organization_id_key",
                set_={"deleted_at": None},
            )
            await self.session.execute(statement)
            existing = await self.get_by_names_and_organization(
                unique_names, organization_id
            )
        return {name: existing[(organization_id, name)] for name in unique_names}
