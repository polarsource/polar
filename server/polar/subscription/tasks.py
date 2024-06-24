import uuid

import structlog
from discord_webhook import AsyncDiscordWebhook, DiscordEmbed

from polar.config import settings
from polar.exceptions import PolarTaskError
from polar.kit.money import get_cents_in_dollar_string
from polar.logging import Logger
from polar.organization.service import organization as organization_service
from polar.worker import AsyncSessionMaker, JobContext, PolarWorkerContext, task

from ..product.service.product import product as product_service
from ..product.service.product_price import product_price as product_price_service
from .service import subscription as subscription_service

log: Logger = structlog.get_logger()


class SubscriptionTaskError(PolarTaskError): ...


class SubscriptionDoesNotExist(SubscriptionTaskError):
    def __init__(self, subscription_id: uuid.UUID) -> None:
        self.subscription_id = subscription_id
        message = f"The subscription with id {subscription_id} does not exist."
        super().__init__(message)


class SubscriptionTierDoesNotExist(SubscriptionTaskError):
    def __init__(self, subscription_tier_id: uuid.UUID) -> None:
        self.subscription_tier_id = subscription_tier_id
        message = (
            f"The subscription tier with id {subscription_tier_id} does not exist."
        )
        super().__init__(message)


@task("subscription.subscription.update_product_benefits_grants")
async def subscription_update_product_benefits_grants(
    ctx: JobContext, subscription_tier_id: uuid.UUID, polar_context: PolarWorkerContext
) -> None:
    async with AsyncSessionMaker(ctx) as session:
        subscription_tier = await product_service.get(session, subscription_tier_id)
        if subscription_tier is None:
            raise SubscriptionTierDoesNotExist(subscription_tier_id)

        await subscription_service.update_product_benefits_grants(
            session, subscription_tier
        )


@task("subscription.user_webhook_notifications")
async def subscription_user_webhook_notifications(
    ctx: JobContext,
    subscription_id: uuid.UUID,
    polar_context: PolarWorkerContext,
) -> None:
    async with AsyncSessionMaker(ctx) as session:
        subscription = await subscription_service.get(session, subscription_id)
        if subscription is None:
            raise SubscriptionDoesNotExist(subscription_id)

        await subscription_service.user_webhook_notifications(session, subscription)
