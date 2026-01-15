from collections.abc import Sequence
from uuid import UUID

from sqlalchemy import Select, or_, select

from polar.kit.repository import (
    RepositoryBase,
    RepositorySoftDeletionIDMixin,
    RepositorySoftDeletionMixin,
)
from polar.models import EventActor


class EventActorRepository(
    RepositorySoftDeletionIDMixin[EventActor, UUID],
    RepositorySoftDeletionMixin[EventActor],
    RepositoryBase[EventActor],
):
    model = EventActor

    async def get_by_customer_id(
        self, organization_id: UUID, customer_id: UUID
    ) -> EventActor | None:
        """Find EventActor by customer_id within organization."""
        statement = self.get_base_statement().where(
            EventActor.organization_id == organization_id,
            EventActor.customer_id == customer_id,
        )
        return await self.get_one_or_none(statement)

    async def get_by_external_customer_id(
        self, organization_id: UUID, external_customer_id: str
    ) -> EventActor | None:
        """Find EventActor by external_customer_id within organization."""
        statement = self.get_base_statement().where(
            EventActor.organization_id == organization_id,
            EventActor.external_customer_id == external_customer_id,
        )
        return await self.get_one_or_none(statement)

    async def get_by_any_identifier(
        self,
        organization_id: UUID,
        *,
        customer_id: UUID | None = None,
        external_customer_id: str | None = None,
        member_id: UUID | None = None,
        external_member_id: str | None = None,
    ) -> EventActor | None:
        """
        Find EventActor by any matching identifier within organization.

        Returns the first EventActor that matches any of the provided identifiers.
        At least one identifier must be provided.
        """
        identifier_conditions = []

        if customer_id is not None:
            identifier_conditions.append(EventActor.customer_id == customer_id)
        if external_customer_id is not None:
            identifier_conditions.append(
                EventActor.external_customer_id == external_customer_id
            )
        if member_id is not None:
            identifier_conditions.append(EventActor.member_id == member_id)
        if external_member_id is not None:
            identifier_conditions.append(
                EventActor.external_member_id == external_member_id
            )

        if not identifier_conditions:
            return None

        statement = self.get_base_statement().where(
            EventActor.organization_id == organization_id,
            or_(*identifier_conditions),
        )
        return await self.get_one_or_none(statement)

    async def get_ids_by_customer_ids(
        self, customer_ids: Sequence[UUID]
    ) -> Sequence[UUID]:
        """Get EventActor IDs for a list of customer IDs."""
        statement = select(EventActor.id).where(
            EventActor.customer_id.in_(customer_ids),
            EventActor.deleted_at.is_(None),
        )
        result = await self.session.scalars(statement)
        return list(result)

    async def get_ids_by_external_customer_ids(
        self, organization_id: UUID, external_customer_ids: Sequence[str]
    ) -> Sequence[UUID]:
        """Get EventActor IDs for a list of external customer IDs within org."""
        statement = select(EventActor.id).where(
            EventActor.organization_id == organization_id,
            EventActor.external_customer_id.in_(external_customer_ids),
            EventActor.deleted_at.is_(None),
        )
        result = await self.session.scalars(statement)
        return list(result)

    def get_by_customer_ids_statement(
        self, customer_ids: Sequence[UUID]
    ) -> Select[tuple[EventActor]]:
        """Get statement for EventActors by customer IDs."""
        return self.get_base_statement().where(
            EventActor.customer_id.in_(customer_ids),
        )

    def get_by_external_customer_ids_statement(
        self, organization_id: UUID, external_customer_ids: Sequence[str]
    ) -> Select[tuple[EventActor]]:
        """Get statement for EventActors by external customer IDs within org."""
        return self.get_base_statement().where(
            EventActor.organization_id == organization_id,
            EventActor.external_customer_id.in_(external_customer_ids),
        )
