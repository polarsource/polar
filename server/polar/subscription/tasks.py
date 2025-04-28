import uuid

import structlog
from sqlalchemy.orm import selectinload

from polar.exceptions import PolarTaskError
from polar.logging import Logger
from polar.models import Subscription, SubscriptionMeter
from polar.worker import AsyncSessionMaker, actor

from ..product.service.product import product as product_service
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


@actor(actor_name="subscription.subscription.update_product_benefits_grants")
async def subscription_update_product_benefits_grants(
    subscription_tier_id: uuid.UUID,
) -> None:
    async with AsyncSessionMaker() as session:
        subscription_tier = await product_service.get(session, subscription_tier_id)
        if subscription_tier is None:
            raise SubscriptionTierDoesNotExist(subscription_tier_id)

        await subscription_service.update_product_benefits_grants(
            session, subscription_tier
        )


@actor(actor_name="subscription.update_meters")
async def subscription_update_meters(subscription_id: uuid.UUID) -> None:
    async with AsyncSessionMaker() as session:
        subscription = await subscription_service.get(
            session,
            subscription_id,
            options=(
                selectinload(Subscription.meters).joinedload(SubscriptionMeter.meter),
            ),
        )
        if subscription is None:
            raise SubscriptionDoesNotExist(subscription_id)
        await subscription_service.update_meters(session, subscription)


@actor(actor_name="subscription.cancel_customer")
async def subscription_cancel_customer(customer_id: uuid.UUID) -> None:
    async with AsyncSessionMaker() as session:
        await subscription_service.cancel_customer(session, customer_id)
