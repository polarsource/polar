from datetime import UTC, datetime, timedelta

import pytest

from polar.billing_interval.repository import BillingIntervalRepository
from polar.billing_interval.service import billing_interval as billing_interval_service
from polar.enums import SubscriptionRecurringInterval
from polar.models import Customer, Meter, Organization, Product, Subscription
from polar.models.billing_interval import UsagePolicy
from polar.models.subscription import SubscriptionStatus
from polar.postgres import AsyncSession
from polar.product.tiers import Tiers, TierType
from scripts.backfill_billing_intervals import (
    backfill_batch,
    count_subscriptions_without_intervals,
    record_active_period,
)
from scripts.repair_paused_billing_intervals import paused_from_pause_only_statement
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import (
    create_product,
    create_product_price_metered_tiers,
    create_subscription,
)

PERIOD_START = datetime(2026, 1, 1, tzinfo=UTC)
PERIOD_END = datetime(2026, 2, 1, tzinfo=UTC)
PAUSED_EARLY = PERIOD_START + timedelta(days=3)


async def create_period_subscription(
    save_fixture: SaveFixture,
    product: Product,
    customer: Customer,
    status: SubscriptionStatus,
    paused_at: datetime | None = None,
) -> Subscription:
    subscription = await create_subscription(
        save_fixture,
        product=product,
        customer=customer,
        status=status,
        started_at=PERIOD_START,
        current_period_start=PERIOD_START,
        current_period_end=PERIOD_END,
    )
    subscription.paused_at = paused_at
    await save_fixture(subscription)
    return subscription


async def get_history(
    session: AsyncSession, subscription: Subscription
) -> list[tuple[UsagePolicy, datetime, datetime | None]]:
    repository = BillingIntervalRepository.from_session(session)
    intervals = await repository.get_by_subscription(subscription.id)
    return [
        (interval.usage_policy, interval.period_start, interval.period_end)
        for interval in sorted(intervals, key=lambda interval: interval.period_start)
    ]


@pytest.mark.anyio
class TestBackfillBatch:
    @pytest.mark.parametrize(
        ("status", "paused_at", "history"),
        [
            (
                SubscriptionStatus.active,
                None,
                [(UsagePolicy.charge, PERIOD_START, None)],
            ),
            (
                SubscriptionStatus.trialing,
                None,
                [(UsagePolicy.trial, PERIOD_START, None)],
            ),
            (
                SubscriptionStatus.paused,
                PERIOD_END + timedelta(minutes=1),
                [
                    (UsagePolicy.charge, PERIOD_START, PERIOD_END),
                    (UsagePolicy.paused, PERIOD_END, None),
                ],
            ),
            (
                SubscriptionStatus.paused,
                PAUSED_EARLY,
                [
                    (UsagePolicy.charge, PERIOD_START, PAUSED_EARLY),
                    (UsagePolicy.paused, PAUSED_EARLY, None),
                ],
            ),
            (SubscriptionStatus.canceled, None, []),
        ],
    )
    async def test_records_the_current_state(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        product_recurring_metered: Product,
        customer: Customer,
        status: SubscriptionStatus,
        paused_at: datetime | None,
        history: list[tuple[UsagePolicy, datetime, datetime | None]],
    ) -> None:
        subscription = await create_period_subscription(
            save_fixture, product_recurring_metered, customer, status, paused_at
        )

        await backfill_batch(session, after_id=None, limit=10, dry_run=False)

        assert await get_history(session, subscription) == history
        assert await count_subscriptions_without_intervals(session) == 0

    async def test_records_tiered_metered_prices(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
        customer: Customer,
        meter: Meter,
    ) -> None:
        product = await create_product(
            save_fixture,
            organization=organization,
            recurring_interval=SubscriptionRecurringInterval.month,
            prices=[],
        )
        price = await create_product_price_metered_tiers(
            save_fixture,
            product=product,
            meter=meter,
            tiers=Tiers.model_validate(
                {
                    "type": TierType.volume,
                    "tiers": [{"bound": None, "unit_amount": "10"}],
                }
            ),
        )
        product.prices.append(price)
        subscription = await create_period_subscription(
            save_fixture, product, customer, SubscriptionStatus.active
        )

        count, _ = await backfill_batch(session, after_id=None, limit=10, dry_run=False)

        assert count == 1
        assert await get_history(session, subscription) == [
            (UsagePolicy.charge, PERIOD_START, None)
        ]

    async def test_skips_subscriptions_without_an_available_metered_price(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        product_recurring_metered: Product,
        product: Product,
        customer: Customer,
        meter: Meter,
    ) -> None:
        not_metered = await create_period_subscription(
            save_fixture, product, customer, SubscriptionStatus.active
        )
        recorded = await create_period_subscription(
            save_fixture,
            product_recurring_metered,
            customer,
            SubscriptionStatus.active,
        )
        await billing_interval_service.record_subscription(
            session, recorded, effective_at=PERIOD_END
        )
        archived = await create_period_subscription(
            save_fixture,
            product_recurring_metered,
            customer,
            SubscriptionStatus.paused,
        )
        meter.archived_at = PERIOD_END
        await save_fixture(meter)

        count, _ = await backfill_batch(session, after_id=None, limit=10, dry_run=False)

        assert count == 0
        assert await get_history(session, not_metered) == []
        assert await get_history(session, archived) == []
        assert await get_history(session, recorded) == [
            (UsagePolicy.charge, PERIOD_END, None)
        ]

    async def test_early_pause_can_be_resumed_at_period_end(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        product_recurring_metered: Product,
        customer: Customer,
    ) -> None:
        subscription = await create_period_subscription(
            save_fixture,
            product_recurring_metered,
            customer,
            SubscriptionStatus.paused,
            PAUSED_EARLY,
        )
        await backfill_batch(session, after_id=None, limit=10, dry_run=False)

        subscription.status = SubscriptionStatus.active
        await billing_interval_service.record_subscription(
            session, subscription, effective_at=PERIOD_END
        )

        assert await get_history(session, subscription) == [
            (UsagePolicy.charge, PERIOD_START, PAUSED_EARLY),
            (UsagePolicy.paused, PAUSED_EARLY, PERIOD_END),
            (UsagePolicy.charge, PERIOD_END, None),
        ]

    async def test_dry_run_records_nothing(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        product_recurring_metered: Product,
        customer: Customer,
    ) -> None:
        subscription = await create_period_subscription(
            save_fixture,
            product_recurring_metered,
            customer,
            SubscriptionStatus.active,
        )

        count, _ = await backfill_batch(session, after_id=None, limit=10, dry_run=True)

        assert count == 1
        assert await get_history(session, subscription) == []


@pytest.mark.anyio
class TestRepairPausedBillingIntervals:
    async def test_records_the_last_active_period(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        product_recurring_metered: Product,
        customer: Customer,
    ) -> None:
        subscription = await create_period_subscription(
            save_fixture,
            product_recurring_metered,
            customer,
            SubscriptionStatus.paused,
            PERIOD_END + timedelta(minutes=1),
        )
        await billing_interval_service.record_subscription(
            session, subscription, effective_at=PERIOD_END
        )

        result = await session.execute(paused_from_pause_only_statement())
        [(repaired, paused_from)] = result.all()
        await record_active_period(session, repaired, until=paused_from)

        assert await get_history(session, subscription) == [
            (UsagePolicy.charge, PERIOD_START, PERIOD_END),
            (UsagePolicy.paused, PERIOD_END, None),
        ]
        assert (await session.execute(paused_from_pause_only_statement())).all() == []
