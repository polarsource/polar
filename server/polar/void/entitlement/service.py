from collections.abc import Sequence
from typing import Literal
from uuid import UUID

from polar.exceptions import PolarError, ResourceNotFound
from polar.kit.utils import utc_now
from polar.models import VoidEntitlement, VoidEvent
from polar.postgres import AsyncReadSession, AsyncSession
from polar.void.event.schemas import EventCreate, EventSource
from polar.void.event.service import event as event_service
from polar.void.identity.service import identity as identity_service
from polar.void.meter.repository import MeterRepository
from polar.void.meter.versions import meters_in_version
from polar.void.organization.service import organization as organization_service
from polar.void.reducer.schemas import ReducerCreate
from polar.void.reducer.service import reducer as reducer_service

from .repository import EntitlementRepository
from .schemas import EntitlementAssignment, EntitlementCreate, EntitlementUpdate


class EntitlementSlugTaken(PolarError):
    def __init__(self) -> None:
        super().__init__(
            "This entitlement slug is reserved by a deleted definition", 409
        )


def classify(
    current: VoidEntitlement | None, create_schema: EntitlementCreate
) -> Literal["create", "update", "unchanged"]:
    name = create_schema.name or create_schema.slug
    if current is None:
        return "create"
    if current.name == name and current.description == create_schema.description:
        return "unchanged"
    return "update"


class EntitlementAssignmentInvalid(PolarError):
    def __init__(self, message: str) -> None:
        super().__init__(message, 400)


class EntitlementAssignmentConflict(PolarError):
    def __init__(self, message: str) -> None:
        super().__init__(message, 409)


def persisted_assignment(
    event: VoidEvent, external_identity_id: str
) -> EntitlementAssignment:
    if (
        event.payload["name"] != "identity.entitlements.updated"
        or event.payload["external_identity_id"] != external_identity_id
        or event.payload["source"] != "system"
    ):
        raise EntitlementAssignmentConflict(
            "This event id belongs to another operation"
        )
    return EntitlementAssignment.model_validate_json(event.payload["metadata"])


class EntitlementService:
    async def assignments(
        self,
        session: AsyncSession,
        organization_id: UUID,
    ) -> dict[str, EntitlementAssignment]:
        """The ordinary last-record projection, rebuilt by the reducer worker."""
        reducer = await EntitlementRepository.from_session(session).assignment_reducer(
            organization_id
        )
        if reducer is None:
            return {}
        return {
            record.external_identity_id: EntitlementAssignment.model_validate(
                record.data
            )
            for record in await reducer_service.records(
                session, organization_id, reducer.id
            )
            if record.external_identity_id is not None
        }

    async def assign(
        self,
        session: AsyncSession,
        organization_id: UUID,
        external_identity_id: str,
        update: EntitlementUpdate,
    ) -> EntitlementAssignment:
        await organization_service.lock(session, organization_id)
        repository = EntitlementRepository.from_session(session)
        existing_event = await repository.assignment_event(
            organization_id, update.external_id
        )
        if existing_event is not None:
            return persisted_assignment(existing_event, external_identity_id)
        await identity_service.get(session, organization_id, external_identity_id)
        assignment = EntitlementAssignment.model_validate(
            update.model_dump(exclude={"external_id"})
        )
        known_features = {e.slug for e in await self.list(session, organization_id)}
        if any(slug not in known_features for slug in assignment.features or []):
            raise EntitlementAssignmentInvalid("Unknown feature entitlement")
        known_meters = meters_in_version(
            await MeterRepository.from_session(session).list(organization_id),
            await organization_service.active_version(session, organization_id),
        )
        for entry in assignment.meters or []:
            if entry.meter not in known_meters:
                raise EntitlementAssignmentInvalid(f"Unknown meter {entry.meter!r}")
            if entry.cap is not None:
                reducer = await reducer_service.get(
                    session, organization_id, known_meters[entry.meter].usage_reducer_id
                )
                if reducer.aggregation.func not in ("sum", "count"):
                    raise EntitlementAssignmentInvalid(
                        "Usage caps require a sum or count meter"
                    )
        existing = await repository.assignment_reducer(organization_id)
        definition = ReducerCreate.model_validate(
            {
                "slug": "void-identity-entitlements",
                "filter": {
                    "conjunction": "and",
                    "clauses": [
                        {
                            "property": "name",
                            "operator": "eq",
                            "value": "identity.entitlements.updated",
                        }
                    ],
                },
                "aggregation": {"func": "last"},
            }
        )
        if existing is None:
            await reducer_service.create(session, organization_id, definition)
        elif ReducerCreate.model_validate(existing, from_attributes=True) != definition:
            raise EntitlementAssignmentInvalid(
                "The identity entitlement reducer definition differs"
            )
        saved, _ = await event_service.ingest(
            session,
            organization_id,
            [
                EventCreate(
                    external_id=update.external_id,
                    external_identity_id=external_identity_id,
                    name="identity.entitlements.updated",
                    timestamp=utc_now(),
                    metadata=assignment.model_dump(mode="json"),
                )
            ],
            EventSource.system,
        )
        if saved == 0:
            existing_event = await repository.assignment_event(
                organization_id, update.external_id
            )
            assert existing_event is not None
            return persisted_assignment(existing_event, external_identity_id)
        return assignment

    async def list(
        self, session: AsyncReadSession, organization_id: UUID
    ) -> Sequence[VoidEntitlement]:
        return await EntitlementRepository.from_session(session).list(organization_id)

    async def get(
        self, session: AsyncReadSession, organization_id: UUID, id: UUID
    ) -> VoidEntitlement:
        entitlement = await EntitlementRepository.from_session(session).get(
            organization_id, id
        )
        if entitlement is None:
            raise ResourceNotFound()
        return entitlement

    async def get_by_slug(
        self, session: AsyncReadSession, organization_id: UUID, slug: str
    ) -> VoidEntitlement | None:
        return await EntitlementRepository.from_session(session).get_by_slug(
            organization_id, slug
        )

    async def upsert(
        self,
        session: AsyncSession,
        organization_id: UUID,
        create_schema: EntitlementCreate,
    ) -> tuple[VoidEntitlement, Literal["create", "update", "unchanged"]]:
        organization = await organization_service.lock(session, organization_id)
        repository = EntitlementRepository.from_session(session)
        current = await repository.get_by_slug(
            organization_id, create_schema.slug, include_deleted=True
        )
        if current is not None and current.deleted_at is not None:
            raise EntitlementSlugTaken()
        action = classify(current, create_schema)
        if current is None:
            current = VoidEntitlement(
                slug=create_schema.slug,
                name=create_schema.name or create_schema.slug,
                description=create_schema.description,
                organization=organization,
            )
            await repository.create(current, flush=True)
        elif action == "update":
            current.name = create_schema.name or create_schema.slug
            current.description = create_schema.description
            await session.flush()
        return current, action


entitlement = EntitlementService()
