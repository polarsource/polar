import uuid
from datetime import UTC, datetime

import structlog
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from polar.exceptions import PolarTaskError
from polar.logging import Logger
from polar.models import Subscription, SubscriptionMeter
from polar.models.subscription import SubscriptionStatus
from polar.product.repository import ProductRepository
from polar.subscription.repository import SubscriptionRepository
from polar.worker import AsyncSessionMaker, CronTrigger, TaskPriority, actor

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


@actor(actor_name="subscription.cycle", priority=TaskPriority.LOW)
async def subscription_cycle(subscription_id: uuid.UUID) -> None:
    async with AsyncSessionMaker() as session:
        repository = SubscriptionRepository.from_session(session)
        subscription = await repository.get_by_id(
            subscription_id, options=repository.get_eager_options()
        )
        if subscription is None:
            raise SubscriptionDoesNotExist(subscription_id)

        await subscription_service.cycle(session, subscription)


@actor(
    actor_name="subscription.subscription.update_product_benefits_grants",
    priority=TaskPriority.MEDIUM,
)
async def subscription_update_product_benefits_grants(
    subscription_tier_id: uuid.UUID,
) -> None:
    async with AsyncSessionMaker() as session:
        product_repository = ProductRepository.from_session(session)
        product = await product_repository.get_by_id(subscription_tier_id)
        if product is None:
            raise SubscriptionTierDoesNotExist(subscription_tier_id)

        await subscription_service.update_product_benefits_grants(session, product)


@actor(actor_name="subscription.update_meters", priority=TaskPriority.LOW)
async def subscription_update_meters(subscription_id: uuid.UUID) -> None:
    async with AsyncSessionMaker() as session:
        repository = SubscriptionRepository.from_session(session)
        subscription = await repository.get_by_id(
            subscription_id,
            options=(
                selectinload(Subscription.meters).joinedload(SubscriptionMeter.meter),
            ),
        )
        if subscription is None:
            raise SubscriptionDoesNotExist(subscription_id)
        await subscription_service.update_meters(session, subscription)


@actor(actor_name="subscription.cancel_customer", priority=TaskPriority.HIGH)
async def subscription_cancel_customer(customer_id: uuid.UUID) -> None:
    async with AsyncSessionMaker() as session:
        await subscription_service.cancel_customer(session, customer_id)


@actor(
    actor_name="subscription.convert_trials_to_active",
    cron_trigger=CronTrigger.from_crontab("0 * * * *"),  # Run every hour
    priority=TaskPriority.MEDIUM,
)
async def convert_trials_to_active() -> None:
    """Convert trial subscriptions to active once trial period ends."""
    async with AsyncSessionMaker() as session:
        repository = SubscriptionRepository.from_session(session)

        # Find all trialing subscriptions where trial has ended
        now = datetime.now(UTC)
        statement = select(Subscription).where(
            Subscription.status == SubscriptionStatus.trialing,
            Subscription.trial_ends_at.is_not(None),
            Subscription.trial_ends_at <= now,
            # Only for subscriptions using our billing engine (no Stripe ID)
            Subscription.stripe_subscription_id.is_(None),
        )

        subscriptions = await repository.get_all(statement)

        for subscription in subscriptions:
            # Update subscription status to active and set started_at
            subscription.status = SubscriptionStatus.active
            subscription.started_at = now

            # The subscription service will handle billing when status changes
            await subscription_service.activate_trial_subscription(
                session, subscription
            )
