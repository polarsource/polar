import pytest
from pytest_mock import MockerFixture

from polar.billing_interval.repository import BillingIntervalRepository
from polar.billing_interval.service import billing_interval as billing_interval_service
from polar.kit.trial import TrialInterval
from polar.kit.utils import utc_now
from polar.models import (
    BillingInterval,
    Customer,
    PaymentMethod,
    Product,
    Subscription,
)
from polar.models.billing_interval import UsagePolicy
from polar.models.checkout import CheckoutStatus
from polar.postgres import AsyncSession
from polar.subscription.service import SubscriptionUpdateContext
from polar.subscription.service import subscription as subscription_service
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import (
    create_active_subscription,
    create_checkout,
    create_trialing_subscription,
)


@pytest.fixture(autouse=True)
def mock_side_effects(mocker: MockerFixture) -> None:
    mocker.patch("polar.subscription.service.enqueue_job")
    mocker.patch("polar.subscription.service.publish_checkout_event")
    mocker.patch.object(subscription_service, "reset_meters")
    mocker.patch.object(subscription_service, "enqueue_benefits_grants")


async def create_recorded_subscription(
    session: AsyncSession,
    save_fixture: SaveFixture,
    product: Product,
    customer: Customer,
) -> Subscription:
    subscription = await create_active_subscription(
        save_fixture, product=product, customer=customer, scheduler_locked_at=utc_now()
    )
    assert subscription.started_at is not None
    await billing_interval_service.record_subscription(
        session, subscription, effective_at=subscription.started_at
    )
    return subscription


async def get_intervals(
    session: AsyncSession, subscription: Subscription
) -> list[BillingInterval]:
    repository = BillingIntervalRepository.from_session(session)
    intervals = await repository.get_by_subscription(subscription.id)
    return sorted(intervals, key=lambda interval: interval.period_start)


@pytest.mark.anyio
class TestCreateOrUpdateFromCheckout:
    async def test_opens_charge_interval(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        product_recurring_metered: Product,
        customer: Customer,
        payment_method: PaymentMethod,
    ) -> None:
        checkout = await create_checkout(
            save_fixture,
            products=[product_recurring_metered],
            status=CheckoutStatus.confirmed,
            customer=customer,
        )

        subscription, _ = await subscription_service.create_or_update_from_checkout(
            session, checkout, payment_method
        )

        [interval] = await get_intervals(session, subscription)
        assert interval.usage_policy == UsagePolicy.charge
        assert interval.period_start == subscription.started_at
        assert interval.period_end is None

    async def test_trial_opens_trial_interval(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        product_recurring_metered: Product,
        customer: Customer,
        payment_method: PaymentMethod,
    ) -> None:
        checkout = await create_checkout(
            save_fixture,
            products=[product_recurring_metered],
            status=CheckoutStatus.confirmed,
            customer=customer,
            trial_interval=TrialInterval.month,
            trial_interval_count=1,
        )

        subscription, _ = await subscription_service.create_or_update_from_checkout(
            session, checkout, payment_method
        )

        [interval] = await get_intervals(session, subscription)
        assert interval.usage_policy == UsagePolicy.trial
        assert interval.period_start == subscription.trial_start
        assert interval.period_end is None


@pytest.mark.anyio
class TestCycle:
    async def test_trial_end_replaces_trial_interval(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        product_recurring_metered: Product,
        customer: Customer,
    ) -> None:
        subscription = await create_trialing_subscription(
            save_fixture,
            product=product_recurring_metered,
            customer=customer,
            scheduler_locked_at=utc_now(),
        )
        assert subscription.trial_start is not None
        await billing_interval_service.record_subscription(
            session, subscription, effective_at=subscription.trial_start
        )
        cycle_at = subscription.current_period_end

        async with SubscriptionUpdateContext(
            session, subscription, subscription_service
        ) as ctx:
            await subscription_service.cycle(session, ctx, subscription)

        trial, charged = await get_intervals(session, subscription)
        assert trial.usage_policy == UsagePolicy.trial
        assert trial.period_end == cycle_at
        assert charged.usage_policy == UsagePolicy.charge
        assert charged.period_start == cycle_at
        assert charged.period_end is None

    async def test_renewal_keeps_interval_open(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        product_recurring_metered: Product,
        customer: Customer,
    ) -> None:
        subscription = await create_recorded_subscription(
            session, save_fixture, product_recurring_metered, customer
        )
        [opened] = await get_intervals(session, subscription)

        async with SubscriptionUpdateContext(
            session, subscription, subscription_service
        ) as ctx:
            await subscription_service.cycle(session, ctx, subscription)

        assert await get_intervals(session, subscription) == [opened]
        assert opened.period_end is None

    async def test_pause_replaces_interval_at_period_end(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        product_recurring_metered: Product,
        customer: Customer,
    ) -> None:
        subscription = await create_recorded_subscription(
            session, save_fixture, product_recurring_metered, customer
        )
        subscription.pause_at_period_end = True
        cycle_at = subscription.current_period_end

        async with SubscriptionUpdateContext(
            session, subscription, subscription_service
        ) as ctx:
            await subscription_service.cycle(session, ctx, subscription)

        charged, paused = await get_intervals(session, subscription)
        assert charged.usage_policy == UsagePolicy.charge
        assert charged.period_end == cycle_at
        assert paused.usage_policy == UsagePolicy.paused
        assert paused.period_start == cycle_at
        assert paused.period_end is None


@pytest.mark.anyio
class TestRevoke:
    async def test_closes_interval(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        product_recurring_metered: Product,
        customer: Customer,
    ) -> None:
        subscription = await create_recorded_subscription(
            session, save_fixture, product_recurring_metered, customer
        )

        async with SubscriptionUpdateContext(
            session, subscription, subscription_service
        ) as ctx:
            await subscription_service.revoke(session, ctx, subscription)

        [interval] = await get_intervals(session, subscription)
        assert interval.period_end == subscription.ended_at
