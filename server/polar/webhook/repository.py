from collections.abc import Sequence
from datetime import datetime
from uuid import UUID

from polar.kit.repository import (
    RepositoryBase,
    RepositorySoftDeletionIDMixin,
    RepositorySoftDeletionMixin,
)
from polar.models.webhook_delivery import WebhookDelivery
from polar.models.webhook_event import WebhookEvent


class WebhookEventRepository(
    RepositorySoftDeletionIDMixin[WebhookEvent, UUID],
    RepositorySoftDeletionMixin[WebhookEvent],
    RepositoryBase[WebhookEvent],
):
    model = WebhookEvent

    async def get_all_undelivered(
        self, older_than: datetime | None = None
    ) -> Sequence[WebhookEvent]:
        statement = (
            self.get_base_statement()
            .join(
                WebhookDelivery,
                WebhookDelivery.webhook_event_id == WebhookEvent.id,
                isouter=True,
            )
            .where(
                WebhookDelivery.id.is_(None),
                WebhookEvent.payload.is_not(None),
            )
        )
        if older_than is not None:
            statement = statement.where(WebhookEvent.created_at < older_than)
        return await self.get_all(statement)
