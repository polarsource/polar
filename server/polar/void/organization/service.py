from uuid import UUID

from polar.exceptions import ResourceNotFound
from polar.models import Organization, VoidDeployment
from polar.postgres import AsyncReadSession, AsyncSession
from polar.void.schemas import VoidOrganization

from .repository import OrganizationRepository


async def selected_version(
    session: AsyncReadSession, organization_id: UUID, requested: str | None
) -> str | None:
    """An explicit version, or the active deployment's; None when nothing is active."""
    if requested is not None:
        return requested
    return await organization.active_version(session, organization_id)


class OrganizationService:
    async def lock(self, session: AsyncSession, organization_id: UUID) -> Organization:
        organization = await OrganizationRepository.from_session(session).lock(
            organization_id
        )
        if organization is None:
            raise ResourceNotFound()
        return organization

    async def active_deployment(
        self, session: AsyncReadSession, organization_id: UUID
    ) -> VoidDeployment | None:
        return await OrganizationRepository.from_session(session).active_deployment(
            organization_id
        )

    async def active_version(
        self, session: AsyncReadSession, organization_id: UUID
    ) -> str | None:
        deployment = await self.active_deployment(session, organization_id)
        return deployment.version_id if deployment is not None else None

    async def current(
        self, session: AsyncReadSession, organization: Organization
    ) -> VoidOrganization:
        deployment = await self.active_deployment(session, organization.id)
        return VoidOrganization(
            id=organization.id,
            name=organization.name,
            slug=organization.slug,
            created_at=organization.created_at,
            active_deployment_id=deployment.id if deployment is not None else None,
            active_version_id=(
                deployment.version_id if deployment is not None else None
            ),
            can_activate=organization.can_accept_payments,
        )


organization = OrganizationService()
