import uuid

import structlog
from sqlalchemy import func, select
from sqlalchemy.orm import joinedload, selectinload

from polar.exceptions import PolarTaskError
from polar.kit.utils import utc_now
from polar.locker import Locker
from polar.logging import Logger
from polar.models import (
    Customer,
    Organization,
    Product,
    Subscription,
    SubscriptionMeter,
)
from polar.product.repository import ProductRepository
from polar.subscription.repository import SubscriptionRepository
from polar.worker import (
    AsyncSessionMaker,
    RedisMiddleware,
    TaskPriority,
    actor,
    enqueue_job,
)

from .service import SubscriptionNotReadyForMigration
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
    actor_name="subscription.enqueue_stripe_subscription_migrate",
    priority=TaskPriority.LOW,
)
async def enqueue_stripe_subscription_migrate(
    max_subscriptions_count: int, limit: int
) -> None:
    async with AsyncSessionMaker() as session:
        subscription_repository = SubscriptionRepository.from_session(session)

        organizations_statement = (
            select(Organization.id)
            .join(Product, Product.organization_id == Organization.id, isouter=True)
            .join(
                Subscription,
                Subscription.product_id == Product.id,
                isouter=True,
            )
            .where(
                Subscription.stripe_subscription_id.is_not(None),
            )
            .group_by(Organization.id)
            .having(func.count(Subscription.id) < max_subscriptions_count)
            .order_by(func.count(Subscription.id).asc())
            .limit(limit)
        )

        subscriptions = subscription_repository.stream(
            subscription_repository.get_base_statement()
            .join(Customer, Customer.id == Subscription.customer_id)
            .where(
                Subscription.stripe_subscription_id.is_not(None),
                Customer.organization_id.in_(organizations_statement),
            )
        )
        async for subscription in subscriptions:
            enqueue_job("subscription.migrate_stripe_subscription", subscription.id)


@actor(actor_name="subscription.migrate_stripe_subscription", priority=TaskPriority.LOW)
async def migrate_stripe_subscription(subscription_id: uuid.UUID) -> None:
    async with AsyncSessionMaker() as session:
        repository = SubscriptionRepository.from_session(session)
        subscription = await repository.get_by_id(
            subscription_id,
            options=(
                joinedload(Subscription.product).joinedload(Product.organization),
                joinedload(Subscription.discount),
                joinedload(Subscription.customer).joinedload(Customer.organization),
            ),
        )
        if subscription is None:
            raise SubscriptionDoesNotExist(subscription_id)
        try:
            await subscription_service.migrate_stripe_subscription(
                session, subscription
            )
        except SubscriptionNotReadyForMigration:
            # Retry another time
            pass
