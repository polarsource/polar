from uuid import UUID

from polar.kit.repository import (
    RepositoryBase,
    RepositorySoftDeletionIDMixin,
    RepositorySoftDeletionMixin,
)
from polar.models import OrganizationSlackIntegration


class OrganizationSlackIntegrationRepository(
    RepositorySoftDeletionIDMixin[OrganizationSlackIntegration, UUID],
    RepositorySoftDeletionMixin[OrganizationSlackIntegration],
    RepositoryBase[OrganizationSlackIntegration],
):
    model = OrganizationSlackIntegration

    async def get_by_organization(
        self, organization_id: UUID
    ) -> OrganizationSlackIntegration | None:
        statement = self.get_base_statement().where(
            OrganizationSlackIntegration.organization_id == organization_id
        )
        return await self.get_one_or_none(statement)

    async def get_by_app_id(
        self, slack_app_id: str
    ) -> OrganizationSlackIntegration | None:
        statement = self.get_base_statement().where(
            OrganizationSlackIntegration.slack_app_id == slack_app_id
        )
        return await self.get_one_or_none(statement)

    async def get_by_team_id(self, team_id: str) -> OrganizationSlackIntegration | None:
        statement = self.get_base_statement().where(
            OrganizationSlackIntegration.team_id == team_id
        )
        return await self.get_one_or_none(statement)
