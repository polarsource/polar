from polar.enums import Platforms
from polar.kit.services import ResourceServiceReader
from polar.models import ExternalOrganization
from polar.postgres import AsyncSession


class ExternalOrganizationService(ResourceServiceReader[ExternalOrganization]):
    async def get_by_platform(
        self, session: AsyncSession, platform: Platforms, external_id: int
    ) -> ExternalOrganization | None:
        return await self.get_by(session, platform=platform, external_id=external_id)


external_organization = ExternalOrganizationService(ExternalOrganization)
