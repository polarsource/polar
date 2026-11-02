from datetime import UTC, datetime, timedelta
from decimal import Decimal
from uuid import UUID

import pytest
from freezegun import freeze_time
from pytest_mock import MockerFixture

from polar.billing_interval.repository import BillingIntervalRepository
from polar.billing_interval.service import billing_interval as billing_interval_service
from polar.enums import SubscriptionProrationBehavior, SubscriptionRecurringInterval
from polar.kit.trial import TrialInterval
from polar.models import (
    Customer,
    Meter,
    Organization,
    PaymentMethod,
    Product,
    Subscription,
)
from polar.models.billing_interval import UsagePolicy
from polar.models.checkout import CheckoutStatus
from polar.models.subscription import SubscriptionStatus
from polar.postgres import AsyncSession
from polar.subscription.service import SubscriptionUpdateContext
from polar.subscription.service import subscription as subscription_service
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import (
    create_checkout,
    create_product,
    create_subscription,
    create_trialing_subscription,
)

START = datetime(2026, 1, 15, 12, tzinfo=UTC)
LATER = START + timedelta(days=3)

type History = list[tuple[UUID, UsagePolicy, datetime, datetime | None]]


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
    *,
    status: SubscriptionStatus = SubscriptionStatus.active,
    cancel_at_period_end: bool = False,
) -> Subscription:
    subscription = await create_subscription(
        save_fixture,
        product=product,
        customer=customer,
        status=status,
        started_at=START,
        current_period_start=START,
        cancel_at_period_end=cancel_at_period_end,
    )
    await billing_interval_service.record_subscription(
        session, subscription, effective_at=START
    )
    return subscription


async def get_history(session: AsyncSession, subscription: Subscription) -> History:
    repository = BillingIntervalRepository.from_session(session)
    intervals = await repository.get_by_subscription(subscription.id)
    return [
        (
            interval.product_price_id,
            interval.usage_policy,
            interval.period_start,
            interval.period_end,
        )
        for interval in sorted(intervals, key=lambda interval: interval.period_start)
    ]


async def cycle(session: AsyncSession, subscription: Subscription) -> None:
    async with SubscriptionUpdateContext(
        session, subscription, subscription_service
    ) as ctx:
        await subscription_service.cycle(session, ctx, subscription)


@pytest.mark.anyio
class TestCreateOrUpdateFromCheckout:
    @freeze_time(START)
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

        assert await get_history(session, subscription) == [
            (product_recurring_metered.prices[0].id, UsagePolicy.charge, START, None)
        ]

    @freeze_time(START)
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

        assert await get_history(session, subscription) == [
            (product_recurring_metered.prices[0].id, UsagePolicy.trial, START, None)
        ]


@pytest.mark.anyio
class TestCycle:
    @freeze_time(START)
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
        history = await get_history(session, subscription)

        await cycle(session, subscription)

        assert await get_history(session, subscription) == history

    @freeze_time(START)
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
        price_id = product_recurring_metered.prices[0].id

        await cycle(session, subscription)

        assert await get_history(session, subscription) == [
            (price_id, UsagePolicy.charge, START, cycle_at),
            (price_id, UsagePolicy.paused, cycle_at, None),
        ]

    @freeze_time(START)
    async def test_trial_conversion_replaces_interval_at_period_end(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        product_recurring_metered: Product,
        customer: Customer,
    ) -> None:
        subscription = await create_recorded_subscription(
            session,
            save_fixture,
            product_recurring_metered,
            customer,
            status=SubscriptionStatus.trialing,
        )
        cycle_at = subscription.current_period_end
        price_id = product_recurring_metered.prices[0].id

        await cycle(session, subscription)

        assert await get_history(session, subscription) == [
            (price_id, UsagePolicy.trial, START, cycle_at),
            (price_id, UsagePolicy.charge, cycle_at, None),
        ]

    @freeze_time(START)
    async def test_cancellation_closes_interval_at_period_end(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        product_recurring_metered: Product,
        customer: Customer,
    ) -> None:
        subscription = await create_recorded_subscription(
            session,
            save_fixture,
            product_recurring_metered,
            customer,
            cancel_at_period_end=True,
        )
        cycle_at = subscription.current_period_end

        await cycle(session, subscription)

        assert await get_history(session, subscription) == [
            (
                product_recurring_metered.prices[0].id,
                UsagePolicy.charge,
                START,
                cycle_at,
            )
        ]


@pytest.mark.anyio
class TestUpdateProduct:
    @pytest.fixture
    async def new_product(
        self, save_fixture: SaveFixture, organization: Organization, meter: Meter
    ) -> Product:
        return await create_product(
            save_fixture,
            organization=organization,
            recurring_interval=SubscriptionRecurringInterval.month,
            prices=[(meter, Decimal(200), None, "usd")],
        )

    async def test_immediate_change_replaces_interval(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        product_recurring_metered: Product,
        new_product: Product,
        customer: Customer,
    ) -> None:
        with freeze_time(START):
            subscription = await create_recorded_subscription(
                session, save_fixture, product_recurring_metered, customer
            )

        with freeze_time(LATER):
            async with SubscriptionUpdateContext(
                session, subscription, subscription_service
            ) as ctx:
                await subscription_service.update_product(
                    session,
                    ctx,
                    subscription,
                    product_id=new_product.id,
                    proration_behavior=SubscriptionProrationBehavior.prorate,
                )

        assert await get_history(session, subscription) == [
            (product_recurring_metered.prices[0].id, UsagePolicy.charge, START, LATER),
            (new_product.prices[0].id, UsagePolicy.charge, LATER, None),
        ]

    @freeze_time(START)
    async def test_scheduled_change_replaces_interval_at_period_end(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        product_recurring_metered: Product,
        new_product: Product,
        customer: Customer,
    ) -> None:
        subscription = await create_recorded_subscription(
            session, save_fixture, product_recurring_metered, customer
        )
        cycle_at = subscription.current_period_end
        async with SubscriptionUpdateContext(
            session, subscription, subscription_service
        ) as ctx:
            await subscription_service.update_product(
                session,
                ctx,
                subscription,
                product_id=new_product.id,
                proration_behavior=SubscriptionProrationBehavior.next_period,
            )

        await cycle(session, subscription)

        assert await get_history(session, subscription) == [
            (
                product_recurring_metered.prices[0].id,
                UsagePolicy.charge,
                START,
                cycle_at,
            ),
            (new_product.prices[0].id, UsagePolicy.charge, cycle_at, None),
        ]

    async def test_ending_trial_replaces_trial_interval_at_change(
        self,
        mocker: MockerFixture,
        session: AsyncSession,
        save_fixture: SaveFixture,
        product_recurring_metered: Product,
        product_recurring_fixed_and_metered: Product,
        customer: Customer,
    ) -> None:
        mocker.patch.object(subscription_service, "_create_subscription_update_order")
        subscription = await create_trialing_subscription(
            save_fixture, product=product_recurring_metered, customer=customer
        )
        trial_start = subscription.trial_start
        assert trial_start is not None
        await billing_interval_service.record_subscription(
            session, subscription, effective_at=trial_start
        )

        async with SubscriptionUpdateContext(
            session, subscription, subscription_service
        ) as ctx:
            await subscription_service.update_product(
                session,
                ctx,
                subscription,
                product_id=product_recurring_fixed_and_metered.id,
                trial_end="now",
            )

        changed_at = subscription.current_period_start
        new_price_id = next(
            price.id
            for price in product_recurring_fixed_and_metered.prices
            if price.is_metered
        )
        assert await get_history(session, subscription) == [
            (
                product_recurring_metered.prices[0].id,
                UsagePolicy.trial,
                trial_start,
                changed_at,
            ),
            (new_price_id, UsagePolicy.charge, changed_at, None),
        ]


@pytest.mark.anyio
class TestUpdateTrial:
    async def test_new_trial_replaces_interval(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        product_recurring_metered: Product,
        customer: Customer,
    ) -> None:
        with freeze_time(START):
            subscription = await create_recorded_subscription(
                session, save_fixture, product_recurring_metered, customer
            )
        price_id = product_recurring_metered.prices[0].id

        with freeze_time(LATER):
            async with SubscriptionUpdateContext(
                session, subscription, subscription_service
            ) as ctx:
                await subscription_service.update_trial(
                    session,
                    ctx,
                    subscription,
                    trial_end=subscription.current_period_end + timedelta(days=7),
                )

        assert await get_history(session, subscription) == [
            (price_id, UsagePolicy.charge, START, LATER),
            (price_id, UsagePolicy.trial, LATER, None),
        ]


@pytest.mark.anyio
class TestResume:
    async def test_replaces_paused_interval(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        product_recurring_metered: Product,
        customer: Customer,
    ) -> None:
        with freeze_time(START):
            subscription = await create_recorded_subscription(
                session,
                save_fixture,
                product_recurring_metered,
                customer,
                status=SubscriptionStatus.paused,
            )
        price_id = product_recurring_metered.prices[0].id

        with freeze_time(LATER):
            async with SubscriptionUpdateContext(
                session, subscription, subscription_service
            ) as ctx:
                await subscription_service.resume(session, ctx, subscription)

        assert await get_history(session, subscription) == [
            (price_id, UsagePolicy.paused, START, LATER),
            (price_id, UsagePolicy.charge, LATER, None),
        ]


@pytest.mark.anyio
class TestReinstate:
    async def test_opens_new_interval_after_gap(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        product_recurring_metered: Product,
        customer: Customer,
    ) -> None:
        revoked_at = START + timedelta(days=1)
        with freeze_time(START):
            subscription = await create_recorded_subscription(
                session, save_fixture, product_recurring_metered, customer
            )
        with freeze_time(revoked_at):
            async with SubscriptionUpdateContext(
                session, subscription, subscription_service
            ) as ctx:
                await subscription_service.revoke(session, ctx, subscription)
        price_id = product_recurring_metered.prices[0].id

        with freeze_time(LATER):
            async with SubscriptionUpdateContext(
                session, subscription, subscription_service
            ) as ctx:
                await subscription_service.reinstate(session, ctx, subscription)

        assert await get_history(session, subscription) == [
            (price_id, UsagePolicy.charge, START, revoked_at),
            (price_id, UsagePolicy.charge, LATER, None),
        ]


@pytest.mark.anyio
class TestActivateImported:
    async def test_replaces_paused_interval_at_cutover(
        self,
        mocker: MockerFixture,
        session: AsyncSession,
        save_fixture: SaveFixture,
        product_recurring_metered: Product,
        customer: Customer,
    ) -> None:
        mocker.patch.object(subscription_service, "_on_subscription_migrated")
        with freeze_time(START):
            subscription = await create_recorded_subscription(
                session,
                save_fixture,
                product_recurring_metered,
                customer,
                status=SubscriptionStatus.paused,
            )
        price_id = product_recurring_metered.prices[0].id

        with freeze_time(LATER):
            await subscription_service.activate_imported(
                session,
                subscription,
                current_period_start=START,
                current_period_end=LATER + timedelta(days=10),
                trial_end=None,
                payment_method=None,
                provider="stripe",
                provider_subscription_id="sub_1",
            )

        assert await get_history(session, subscription) == [
            (price_id, UsagePolicy.paused, START, LATER),
            (price_id, UsagePolicy.charge, LATER, None),
        ]
