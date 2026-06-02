from uuid import UUID

from polar.kit.repository import RepositoryBase
from polar.models import BenefitSlackIntegration


class BenefitSlackIntegrationRepository(
    RepositoryBase[BenefitSlackIntegration],
):
    model = BenefitSlackIntegration

    async def get_by_id(self, id: UUID) -> BenefitSlackIntegration | None:
        statement = self.get_base_statement().where(BenefitSlackIntegration.id == id)
        return await self.get_one_or_none(statement)

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

    async def delete(self, integration: BenefitSlackIntegration) -> None:
        await self.session.delete(integration)
        await self.session.flush()
