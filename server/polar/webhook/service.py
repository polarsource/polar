from collections.abc import Sequence
from enum import Enum
from typing import Literal, Union
from uuid import UUID

from sqlalchemy.orm import joinedload

from polar.kit.db.postgres import AsyncSession
from polar.kit.extensions.sqlalchemy import sql
from polar.kit.schemas import Schema
from polar.models.organization import Organization
from polar.models.subscription import Subscription
from polar.models.subscription_tier import SubscriptionTier
from polar.models.user import User
from polar.models.webhook_endpoint import WebhookEndpoint
from polar.models.webhook_event import WebhookEvent
from polar.subscription.schemas import Subscription as SubscriptionSchema
from polar.worker import enqueue_job


class WebhookEventType(Enum):
    subscription_created = "subscription.created"
    subscription_updated = "subscription.updated"
    subscription_tier_created = "subscription_tier.created"
    subscription_tier_updated = "subscription_tier.updated"
    subscription_tier_deleted = "subscription_tier.deleted"
    benefit_created = "benefit.created"
    benefit_updated = "benefit.updated"
    benefit_deleted = "benefit.deleted"
    organization_updated = "organization.updated"
    pledge_created = "pledge.created"
    donation_created = "donation.created"


WebhookTypeObject = Union[  # noqa: UP007
    tuple[Literal[WebhookEventType.subscription_created], Subscription],
    tuple[Literal[WebhookEventType.subscription_updated], Subscription],
    tuple[Literal[WebhookEventType.subscription_tier_created], SubscriptionTier],
]


# class WebhookPayload:


class WebhookSubscriptionCreatedPayload(Schema):
    type: Literal[WebhookEventType.subscription_created]
    data: SubscriptionSchema


class WebhookSubscriptionUpdatedPayload(Schema):
    type: Literal[WebhookEventType.subscription_updated]
    data: SubscriptionSchema


WebhookPayload = Union[  # noqa: UP007
    WebhookSubscriptionCreatedPayload,
    WebhookSubscriptionUpdatedPayload,
]


class WebhookService:
    async def list_endpoints(
        self, session: AsyncSession, target: Organization | User
    ) -> Sequence[WebhookEndpoint]:
        stmt = sql.select(WebhookEndpoint)

        if isinstance(target, Organization):
            stmt = stmt.where(WebhookEndpoint.organization_id == target.id)
        else:
            stmt = stmt.where(WebhookEndpoint.user_id == target.id)

        res = await session.execute(stmt)
        return res.scalars().unique().all()

    async def get_event(self, session: AsyncSession, id: UUID) -> WebhookEvent | None:
        stmt = (
            sql.select(WebhookEvent)
            .where(
                WebhookEvent.id == id,
            )
            .options(joinedload(WebhookEvent.webhook_endpoint))
        )
        res = await session.execute(stmt)
        return res.scalars().unique().one_or_none()

    async def send(
        self,
        session: AsyncSession,
        target: Organization | User,
        we: WebhookTypeObject,
    ) -> None:
        endpoints = await self.list_endpoints(session, target)

        payload: WebhookPayload | None = None

        match we[0]:
            case WebhookEventType.subscription_created:
                payload = WebhookSubscriptionCreatedPayload(
                    type=we[0],
                    data=SubscriptionSchema.model_validate(we[1]),
                )
            case WebhookEventType.subscription_updated:
                payload = WebhookSubscriptionUpdatedPayload(
                    type=we[0],
                    data=SubscriptionSchema.model_validate(we[1]),
                )

        if payload is None:
            raise Exception("no payload")

        for e in endpoints:
            event = WebhookEvent(
                webhook_endpoint_id=e.id, payload=payload.model_dump_json()
            )
            session.add(event)
            await session.flush()

            enqueue_job("webhook_event.send", webhook_event_id=event.id)

        return


webhook_service = WebhookService()
