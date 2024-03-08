from collections.abc import Sequence
from uuid import UUID

import structlog

from polar.kit.utils import utc_now
from polar.models.webhook_notifications import WebhookNotification
from polar.postgres import AsyncSession, sql

from .schemas import WebhookIntegrationCreate, WebhookIntegrationUpdate

log = structlog.get_logger()


class WebhookNotificationService:
    async def create(
        self, session: AsyncSession, create_schema: WebhookIntegrationCreate
    ) -> WebhookNotification:
        webhook_notification = WebhookNotification(
            integration=create_schema.integration,
            organization_id=create_schema.organization_id,
            url=create_schema.url,
        )
        session.add(webhook_notification)
        await session.flush()
        return webhook_notification

    async def get(
        self,
        session: AsyncSession,
        id: UUID,
    ) -> WebhookNotification | None:
        stmt = sql.select(WebhookNotification).where(
            WebhookNotification.id == id,
            WebhookNotification.deleted_at.is_(None),
        )

        res = await session.execute(stmt)
        return res.scalars().unique().one_or_none()

    async def search(
        self,
        session: AsyncSession,
        *,
        organization_id: UUID,
    ) -> Sequence[WebhookNotification]:
        stmt = sql.select(WebhookNotification).where(
            WebhookNotification.organization_id == organization_id,
            WebhookNotification.deleted_at.is_(None),
        )

        res = await session.execute(stmt)
        return res.scalars().unique().all()

    async def update(
        self,
        session: AsyncSession,
        webhook: WebhookNotification,
        update: WebhookIntegrationUpdate,
    ) -> WebhookNotification:
        webhook.url = update.url
        session.add(webhook)
        return webhook

    async def delete(
        self,
        session: AsyncSession,
        webhook: WebhookNotification,
    ) -> WebhookNotification:
        webhook.deleted_at = utc_now()
        session.add(webhook)
        return webhook


webhook_notifications_service = WebhookNotificationService()
