import uuid

import structlog
from sqlalchemy.orm import selectinload

from polar.exceptions import PolarTaskError
from polar.kit.utils import utc_now
from polar.locker import Locker
from polar.logging import Logger
from polar.models import Subscription, SubscriptionMeter
from polar.product.repository import ProductRepository
from polar.subscription.repository import SubscriptionRepository
from sqlalchemy import select

from polar.models.subscription import SubscriptionStatus
from polar.models.subscription_reminder import SubscriptionReminder, SubscriptionReminderType
from polar.subscription.reminder_repository import SubscriptionReminderRepository
from polar.worker import (
    AsyncSessionMaker,
    CronTrigger,
    RedisMiddleware,
    TaskPriority,
    actor,
    enqueue_job,
)

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
    redis = RedisMiddleware.get()
    locker = Locker(redis)
    lock_name = f"subscription:cycle:{subscription_id}"

    if await locker.is_locked(lock_name):
        log.info(
            "Subscription is already being cycled by another worker",
            subscription_id=subscription_id,
        )
        return

    async with locker.lock(lock_name, timeout=1.0, blocking_timeout=0.1):
        async with AsyncSessionMaker() as session:
            repository = SubscriptionRepository.from_session(session)
            subscription = await repository.get_by_id(
                subscription_id, options=repository.get_eager_options()
            )
            if subscription is None:
                raise SubscriptionDoesNotExist(subscription_id)

            if not subscription.active or (
                not force
                and subscription.current_period_end
                and subscription.current_period_end > utc_now()
            ):
                log.info(
                    "Subscription has already been cycled",
                    subscription_id=subscription_id,
                )
                subscription = await repository.update(
                    subscription, update_dict={"scheduler_locked_at": None}
                )
                return

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
    actor_name="subscription.send_renewal_reminders",
    cron_trigger=CronTrigger.from_crontab("30 * * * *"),
    priority=TaskPriority.LOW,
)
async def send_renewal_reminders() -> None:
    async with AsyncSessionMaker() as session:
        repository = SubscriptionRepository.from_session(session)
        subscriptions = await repository.get_subscriptions_needing_renewal_reminder()

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

        # Guard: still eligible
        if (
            subscription.status != SubscriptionStatus.active
            or subscription.cancel_at_period_end
        ):
            return

        assert subscription.current_period_end is not None

        # Check not already sent (race condition guard)
        reminder_repository = SubscriptionReminderRepository.from_session(session)
        result = await session.execute(
            select(SubscriptionReminder).where(
                SubscriptionReminder.subscription_id == subscription_id,
                SubscriptionReminder.type == SubscriptionReminderType.renewal,
                SubscriptionReminder.target_date == subscription.current_period_end,
            )
        )
        if result.scalar_one_or_none() is not None:
            return

        await subscription_service.send_renewal_reminder_email(session, subscription)

        await reminder_repository.create(
            SubscriptionReminder(
                subscription_id=subscription_id,
                type=SubscriptionReminderType.renewal,
                target_date=subscription.current_period_end,
                sent_at=utc_now(),
            )
        )


@actor(
    actor_name="subscription.send_trial_conversion_reminders",
    cron_trigger=CronTrigger.from_crontab("30 * * * *"),
    priority=TaskPriority.LOW,
)
async def send_trial_conversion_reminders() -> None:
    async with AsyncSessionMaker() as session:
        repository = SubscriptionRepository.from_session(session)
        subscriptions = (
            await repository.get_subscriptions_needing_trial_conversion_reminder()
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

        # Guard: still eligible
        if (
            subscription.status != SubscriptionStatus.trialing
            or subscription.cancel_at_period_end
        ):
            return

        conversion_date = subscription.trial_end or subscription.current_period_end
        assert conversion_date is not None

        # Check not already sent (race condition guard)
        reminder_repository = SubscriptionReminderRepository.from_session(session)
        result = await session.execute(
            select(SubscriptionReminder).where(
                SubscriptionReminder.subscription_id == subscription_id,
                SubscriptionReminder.type == SubscriptionReminderType.trial_conversion,
                SubscriptionReminder.target_date == conversion_date,
            )
        )
        if result.scalar_one_or_none() is not None:
            return

        await subscription_service.send_trial_conversion_reminder_email(
            session, subscription
        )

        await reminder_repository.create(
            SubscriptionReminder(
                subscription_id=subscription_id,
                type=SubscriptionReminderType.trial_conversion,
                target_date=conversion_date,
                sent_at=utc_now(),
            )
        )
