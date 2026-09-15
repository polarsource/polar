from collections.abc import Sequence
from uuid import UUID

from polar.exceptions import PolarError, ResourceNotFound
from polar.models import Organization, VoidBillingIdentity
from polar.postgres import AsyncReadSession, AsyncSession

from .repository import IdentityRepository
from .schemas import IdentityCreate


class DeletedIdentityConflict(PolarError):
    def __init__(self) -> None:
        super().__init__(
            "This identity external ID belongs to a deleted identity.", 409
        )


class IdentityHierarchyConflict(PolarError):
    def __init__(self) -> None:
        super().__init__("The identity's ancestry does not reach an active root.", 409)


class IdentityService:
    async def get(
        self,
        session: AsyncReadSession,
        organization_id: UUID,
        external_id: str,
    ) -> VoidBillingIdentity:
        result = await IdentityRepository.from_session(session).get_by_external_id(
            organization_id, external_id
        )
        if result is None:
            raise ResourceNotFound(f"No billing identity {external_id!r}")
        return result

    async def ensure(
        self,
        session: AsyncSession,
        organization: Organization,
        create_schema: IdentityCreate,
    ) -> tuple[VoidBillingIdentity, bool]:
        repository = IdentityRepository.from_session(session)
        await repository.lock_organization(organization.id)
        existing = await repository.get_by_external_id(
            organization.id, create_schema.external_id, include_deleted=True
        )
        if existing is not None:
            if existing.deleted_at is not None:
                raise DeletedIdentityConflict()
            return existing, False
        parent = (
            await self.get(session, organization.id, create_schema.parent_external_id)
            if create_schema.parent_external_id is not None
            else None
        )
        if parent is not None:
            await self.chain(session, parent)
        result = await repository.create(
            VoidBillingIdentity(
                organization=organization,
                external_id=create_schema.external_id,
                parent=parent,
                metadata_=create_schema.metadata,
            ),
            flush=True,
        )
        return result, True

    async def list(
        self,
        session: AsyncReadSession,
        organization_id: UUID,
        parent_external_id: str | None = None,
        roots: bool = False,
    ) -> Sequence[VoidBillingIdentity]:
        parent = (
            await self.get(session, organization_id, parent_external_id)
            if parent_external_id is not None
            else None
        )
        return await IdentityRepository.from_session(session).list(
            organization_id, parent_id=parent.id if parent else None, roots=roots
        )

    async def children(
        self, session: AsyncReadSession, identity: VoidBillingIdentity
    ) -> Sequence[VoidBillingIdentity]:
        return await IdentityRepository.from_session(session).list(
            identity.organization_id, parent_id=identity.id
        )

    async def chain(
        self, session: AsyncReadSession, identity: VoidBillingIdentity
    ) -> Sequence[VoidBillingIdentity]:
        result = await IdentityRepository.from_session(session).chain(identity)
        if not result or result[-1].parent_id is not None:
            raise IdentityHierarchyConflict()
        return result

    async def subtree(
        self, session: AsyncReadSession, identity: VoidBillingIdentity
    ) -> Sequence[VoidBillingIdentity]:
        return await IdentityRepository.from_session(session).subtree(identity)

    async def root_of(
        self, session: AsyncReadSession, identity: VoidBillingIdentity
    ) -> VoidBillingIdentity:
        return (await self.chain(session, identity))[-1]

    async def roots_of(
        self,
        session: AsyncReadSession,
        organization_id: UUID,
        external_ids: Sequence[str],
    ) -> dict[str, str]:
        return await IdentityRepository.from_session(session).roots_of(
            organization_id, external_ids
        )


identity = IdentityService()
