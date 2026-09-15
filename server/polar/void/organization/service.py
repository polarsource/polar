from uuid import UUID

from polar.exceptions import PolarError, ResourceNotFound
from polar.models import Organization, VoidOrganizationSettings
from polar.postgres import AsyncReadSession, AsyncSession
from polar.void.schemas import VoidOrganization

from .repository import OrganizationRepository
from .schemas import OrganizationUpdate


class InvalidDefaultVariant(PolarError):
    def __init__(self) -> None:
        super().__init__(
            "The default must be an available product or meter variant in this organization.",
            400,
        )


async def selected_variant(
    session: AsyncReadSession, organization_id: UUID, requested: str | None
) -> str | None:
    if requested is not None:
        return requested or None
    return await organization.default_variant(session, organization_id)


class OrganizationService:
    async def lock(self, session: AsyncSession, organization_id: UUID) -> Organization:
        organization = await OrganizationRepository.from_session(session).lock(
            organization_id
        )
        if organization is None:
            raise ResourceNotFound()
        return organization

    async def default_variant(
        self, session: AsyncReadSession, organization_id: UUID
    ) -> str | None:
        settings = await OrganizationRepository.from_session(session).get_settings(
            organization_id
        )
        return settings.default_variant_id if settings is not None else None

    async def current(
        self, session: AsyncReadSession, organization: Organization
    ) -> VoidOrganization:
        return VoidOrganization(
            id=organization.id,
            name=organization.name,
            slug=organization.slug,
            created_at=organization.created_at,
            default_variant_id=await self.default_variant(session, organization.id),
        )

    async def update(
        self,
        session: AsyncSession,
        organization: Organization,
        body: OrganizationUpdate,
    ) -> VoidOrganization:
        await self.set_default_variant(
            session, organization.id, body.default_variant_id
        )
        return await self.current(session, organization)

    async def set_default_variant(
        self, session: AsyncSession, organization_id: UUID, variant_id: str | None
    ) -> None:
        organization = await self.lock(session, organization_id)
        repository = OrganizationRepository.from_session(session)
        if variant_id is not None and not await repository.has_variant(
            organization_id, variant_id
        ):
            raise InvalidDefaultVariant()
        settings = await repository.get_settings(organization_id)
        if settings is None:
            if variant_id is None:
                return
            settings = VoidOrganizationSettings(
                organization=organization, default_variant_id=variant_id
            )
            await repository.create(settings)
        else:
            settings.default_variant_id = variant_id
        await session.flush()


organization = OrganizationService()
