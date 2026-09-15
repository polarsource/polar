from collections.abc import Sequence
from typing import Literal
from uuid import UUID

from polar.exceptions import PolarError, ResourceNotFound
from polar.models import VoidEntitlement
from polar.postgres import AsyncReadSession, AsyncSession
from polar.void.organization.service import organization as organization_service

from .repository import EntitlementRepository
from .schemas import EntitlementCreate


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


class EntitlementService:
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
