from uuid import UUID

from polar.kit.repository import (
    RepositoryBase,
    RepositorySoftDeletionIDMixin,
    RepositorySoftDeletionMixin,
)
from polar.models import BenefitSlackIntegration


class BenefitSlackIntegrationRepository(
    RepositorySoftDeletionIDMixin[BenefitSlackIntegration, UUID],
    RepositorySoftDeletionMixin[BenefitSlackIntegration],
    RepositoryBase[BenefitSlackIntegration],
):
    model = BenefitSlackIntegration

    async def get_by_benefit(self, benefit_id: UUID) -> BenefitSlackIntegration | None:
        statement = self.get_base_statement().where(
            BenefitSlackIntegration.benefit_id == benefit_id
        )
        return await self.get_one_or_none(statement)

    async def get_by_app_id(self, slack_app_id: str) -> BenefitSlackIntegration | None:
        statement = self.get_base_statement().where(
            BenefitSlackIntegration.slack_app_id == slack_app_id
        )
        return await self.get_one_or_none(statement)

    async def get_by_team_id(self, team_id: str) -> BenefitSlackIntegration | None:
        statement = self.get_base_statement().where(
            BenefitSlackIntegration.team_id == team_id
        )
        return await self.get_one_or_none(statement)
