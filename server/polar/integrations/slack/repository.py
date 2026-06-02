from uuid import UUID

from sqlalchemy.dialects.postgresql import insert as pg_insert

from polar.kit.repository import RepositoryBase
from polar.models import Benefit, BenefitSlackIntegration


class BenefitSlackIntegrationRepository(
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

    async def delete(self, integration: BenefitSlackIntegration) -> None:
        await self.session.delete(integration)
        await self.session.flush()

    async def upsert_display_name(
        self, benefit: Benefit, display_name: str
    ) -> BenefitSlackIntegration:
        statement = (
            pg_insert(BenefitSlackIntegration)
            .values(
                benefit_id=benefit.id,
                organization_id=benefit.organization_id,
                display_name=display_name,
            )
            .on_conflict_do_update(
                index_elements=["benefit_id"],
                set_={"display_name": display_name},
            )
        )
        await self.session.execute(statement)
        await self.session.flush()
        integration = await self.get_by_benefit(benefit.id)
        assert integration is not None
        return integration
