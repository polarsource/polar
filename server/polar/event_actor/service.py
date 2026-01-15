from uuid import UUID

from polar.kit.db.postgres import AsyncSession
from polar.models import Customer, EventActor

from .repository import EventActorRepository


class EventActorService:
    """Service for managing EventActor entities."""

    async def resolve(
        self,
        session: AsyncSession,
        organization_id: UUID | None,
        *,
        customer_id: UUID | None = None,
        external_customer_id: str | None = None,
        member_id: UUID | None = None,
        external_member_id: str | None = None,
    ) -> EventActor:
        """
        Find existing EventActor or create new one.

        Looks up an EventActor by any of the provided identifiers within the
        organization. If not found, creates a new EventActor with the provided
        identifiers.

        At least one identifier must be provided.

        Args:
            session: Database session
            organization_id: Organization ID (required)
            customer_id: Internal customer ID
            external_customer_id: External customer ID
            member_id: Internal member ID (for future multi-seat)
            external_member_id: External member ID (for future multi-seat)

        Returns:
            EventActor: Existing or newly created EventActor

        Raises:
            ValueError: If organization_id is None
        """
        if organization_id is None:
            raise ValueError("organization_id is required to resolve EventActor")

        repository = EventActorRepository.from_session(session)

        # Try to find existing EventActor by any identifier
        existing = await repository.get_by_any_identifier(
            organization_id,
            customer_id=customer_id,
            external_customer_id=external_customer_id,
            member_id=member_id,
            external_member_id=external_member_id,
        )
        if existing is not None:
            return existing

        # Create new EventActor
        actor = EventActor(
            organization_id=organization_id,
            customer_id=customer_id,
            external_customer_id=external_customer_id,
            member_id=member_id,
            external_member_id=external_member_id,
        )
        await repository.create(actor, flush=True)
        return actor

    async def link_customer(
        self, session: AsyncSession, customer: Customer
    ) -> EventActor | None:
        """
        Link customer_id to existing EventActor with matching external_customer_id.

        This should be called when a Customer is created with an external_id.
        If an EventActor already exists with that external_customer_id (from
        events ingested before the customer was created), this links the
        customer_id to that EventActor, making all those events automatically
        resolve to the customer.

        Args:
            session: Database session
            customer: Customer that was just created

        Returns:
            EventActor if one was found and linked, None otherwise
        """
        if customer.external_id is None:
            return None

        repository = EventActorRepository.from_session(session)

        # Find EventActor by external_customer_id
        existing = await repository.get_by_external_customer_id(
            customer.organization_id, customer.external_id
        )

        if existing is None:
            return None

        # Only update if customer_id is not already set
        if existing.customer_id is None:
            await repository.update(
                existing, update_dict={"customer_id": customer.id}, flush=True
            )

        return existing


event_actor_service = EventActorService()
