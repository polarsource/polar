import uuid
from datetime import timedelta

import structlog
from sqlalchemy.orm import selectinload

from polar.exceptions import PolarTaskError
from polar.kit.utils import utc_now
from polar.logging import Logger
from polar.models import Subscription, SubscriptionMeter
from polar.product.repository import ProductRepository
from polar.subscription.repository import SubscriptionRepository
from polar.worker import (
    AsyncSessionMaker,
    CronTrigger,
    TaskPriority,
    actor,
    enqueue_job,
)

from .service import SubscriptionUpdateContext
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
async def subscription_cycle(subscription_id: uuid.UUID, force: bool = False) -> None:
    async with AsyncSessionMaker() as session:
        repository = SubscriptionRepository.from_session(session)
        subscription = await repository.get_by_id(
            subscription_id,
            options=repository.get_eager_options(),
            for_update=True,
        )
        if subscription is None:
            raise SubscriptionDoesNotExist(subscription_id)

        now = utc_now()
        billing_due = force or (
            subscription.current_period_end is not None
            and subscription.current_period_end <= now
        )
        meter_due = (
            subscription.current_meter_period_end is not None
            and subscription.current_meter_period_end <= now
        )

        if not subscription.active or not (billing_due or meter_due):
            log.info(
                "Subscription has already been cycled",
                subscription_id=subscription_id,
            )
            subscription = await repository.update(
                subscription, update_dict={"scheduler_locked_at": None}
            )
            return

        if billing_due:
            # Billing boundary wins: the full cycle settles the final meter
            # period and re-arms the meter clock.
            async with SubscriptionUpdateContext(
                session, subscription, subscription_service
            ) as ctx:
                await subscription_service.cycle(session, ctx, subscription)
        else:
            # A meter clock lagging more than one period raises
            # SubscriptionMeterCycleLag; we let it propagate. cycle_meters leaves
            # the scheduler lock set, so the subscription stays halted until a
            # human catches it up.
            await subscription_service.cycle_meters(session, subscription)


@actor(
    actor_name="subscription.cancel_for_organization",
    priority=TaskPriority.LOW,
)
async def subscription_cancel_for_organization(organization_id: uuid.UUID) -> None:
    """Cancel all billable subscriptions of a denied/blocked/offboarded org,
    enqueued per-organization by ``organization.cancel_expired_subscriptions``.

    Cancels one batch per run and re-enqueues itself while subscriptions remain,
    so a large org winds down across several short jobs instead of one that would
    exceed the worker's 60s time limit and roll back without progress.
    """
    async with AsyncSessionMaker() as session:
        has_more = await subscription_service.cancel_for_organization(
            session, organization_id
        )

    if has_more:
        enqueue_job(
            "subscription.cancel_for_organization", organization_id=organization_id
        )


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


@actor(
    actor_name="subscription.enqueue_benefits_grants",
    priority=TaskPriority.MEDIUM,
)
async def subscription_enqueue_benefits_grants(subscription_id: uuid.UUID) -> None:
    async with AsyncSessionMaker() as session:
        repository = SubscriptionRepository.from_session(session)
        subscription = await repository.get_by_id(subscription_id)
        if subscription is None:
            raise SubscriptionDoesNotExist(subscription_id)

        await subscription_service.enqueue_benefits_grants(session, subscription)


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
    actor_name="subscription.scan_renewal_reminders",
    cron_trigger=CronTrigger.from_crontab("30 * * * *"),
    priority=TaskPriority.LOW,
)
async def scan_renewal_reminders() -> None:
    """Scan for subscriptions needing renewal reminders and fan out."""
    now = utc_now()
    reminder_window_end = now + timedelta(days=7)

    async with AsyncSessionMaker() as session:
        repository = SubscriptionRepository.from_session(session)
        subscriptions = await repository.get_subscriptions_needing_renewal_reminder(
            now, reminder_window_end, options=repository.get_eager_options()
        )

    for sub in subscriptions:
        enqueue_job("subscription.send_renewal_reminder", sub.id)


@actor(actor_name="subscription.send_renewal_reminder", priority=TaskPriority.LOW)
async def send_renewal_reminder(subscription_id: uuid.UUID) -> None:
    async with AsyncSessionMaker() as session:
        repository = SubscriptionRepository.from_session(session)
        subscription = await repository.get_by_id(
            subscription_id, options=repository.get_eager_options()
        )
        if subscription is None:
            raise SubscriptionDoesNotExist(subscription_id)

        if not subscription.active:
            log.info(
                "Subscription is no longer active, skipping renewal reminder",
                subscription_id=subscription_id,
            )
            return

        await subscription_service.send_renewal_reminder_email(session, subscription)


@actor(
    actor_name="subscription.scan_trial_conversion_reminders",
    cron_trigger=CronTrigger.from_crontab("30 * * * *"),
    priority=TaskPriority.LOW,
)
async def scan_trial_conversion_reminders() -> None:
    """Scan for trialing subscriptions needing conversion reminders and fan out."""
    now = utc_now()

    async with AsyncSessionMaker() as session:
        repository = SubscriptionRepository.from_session(session)
        subscriptions = (
            await repository.get_subscriptions_needing_trial_conversion_reminder(
                now, options=repository.get_eager_options()
            )
        )

    for sub in subscriptions:
        enqueue_job("subscription.send_trial_conversion_reminder", sub.id)


@actor(
    actor_name="subscription.send_trial_conversion_reminder", priority=TaskPriority.LOW
)
async def send_trial_conversion_reminder(subscription_id: uuid.UUID) -> None:
    async with AsyncSessionMaker() as session:
        repository = SubscriptionRepository.from_session(session)
        subscription = await repository.get_by_id(
            subscription_id, options=repository.get_eager_options()
        )
        if subscription is None:
            raise SubscriptionDoesNotExist(subscription_id)

        if subscription.status != "trialing":
            log.info(
                "Subscription is no longer trialing, skipping conversion reminder",
                subscription_id=subscription_id,
            )
            return

        await subscription_service.send_trial_conversion_reminder_email(
            session, subscription
        )
