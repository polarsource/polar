from uuid import UUID

from polar.kit.repository import RepositoryBase, RepositorySoftDeletionMixin
from polar.models import WebhookEndpoint
from polar.models.webhook_endpoint import WebhookEventType, WebhookFormat


class MCPEventRepository(
    RepositorySoftDeletionMixin[WebhookEndpoint], RepositoryBase[WebhookEndpoint]
):
    model = WebhookEndpoint

    async def get_subscription(
        self, organization_id: UUID, url: str, event: WebhookEventType
    ) -> WebhookEndpoint | None:
        statement = self.get_base_statement().where(
            WebhookEndpoint.format == WebhookFormat.mcp,
            WebhookEndpoint.organization_id == organization_id,
            WebhookEndpoint.url == url,
            WebhookEndpoint.events == [event],
        )
        return await self.get_one_or_none(statement)
