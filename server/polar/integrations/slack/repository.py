from uuid import UUID

from polar.kit.repository import RepositoryBase
from polar.models import SlackApp


class SlackAppRepository(
    RepositoryBase[SlackApp],
):
    model = SlackApp

    async def get_by_id(self, id: UUID) -> SlackApp | None:
        statement = self.get_base_statement().where(SlackApp.id == id)
        return await self.get_one_or_none(statement)

    async def get_by_app_id(self, slack_app_id: str) -> SlackApp | None:
        statement = self.get_base_statement().where(
            SlackApp.slack_app_id == slack_app_id
        )
        return await self.get_one_or_none(statement)

    async def list_by_organization_id(self, organization_id: UUID) -> list[SlackApp]:
        statement = (
            self.get_base_statement()
            .where(SlackApp.organization_id == organization_id)
            .order_by(SlackApp.created_at.desc())
        )
        return list(await self.get_all(statement))

    async def delete(self, integration: SlackApp) -> None:
        await self.session.delete(integration)
        await self.session.flush()
