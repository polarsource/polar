import typing
import uuid
from collections.abc import Sequence
from datetime import UTC, datetime, timedelta
from decimal import Decimal
from unittest.mock import AsyncMock, MagicMock
from uuid import UUID

import freezegun
import pytest
from dateutil.relativedelta import relativedelta
from pytest_mock import MockerFixture

from polar.billing_entry.repository import BillingEntryRepository
from polar.enums import SubscriptionProrationBehavior, SubscriptionRecurringInterval
from polar.event.repository import EventRepository
from polar.event.system import SystemEvent
from polar.models import (
    BillingEntry,
    Customer,
    Discount,
    Event,
    Meter,
    Organization,
    Product,
    Subscription,
)
from polar.models.billing_entry import BillingEntryDirection, BillingEntryType
from polar.models.discount import DiscountDuration, DiscountType
from polar.models.product_price import SeatTierType
from polar.models.subscription import SubscriptionStatus
from polar.postgres import AsyncSession
from polar.product.guard import (
    is_fixed_price,
    is_free_price,
    is_seat_price,
)
from polar.subscription.repository import SubscriptionUpdateRepository
from polar.subscription.service import SubscriptionUpdateContext
from polar.subscription.service import subscription as subscription_service
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import (
    create_active_subscription,
    create_discount,
    create_product,
    create_product_fixed_and_seat,
    create_product_price_fixed,
    create_subscription,
    create_subscription_with_seats,
)

# Sonar Atlas graduated seat schedule: 1–50 @ $0 (included), 51–100 @ $20,
# 101–200 @ $17.50, 201+ @ $15.
SONAR_SEAT_TIERS: list[dict[str, object]] = [
    {"min_seats": 1, "max_seats": 50, "price_per_seat": 0},
    {"min_seats": 51, "max_seats": 100, "price_per_seat": 2000},
    {"min_seats": 101, "max_seats": 200, "price_per_seat": 1750},
    {"min_seats": 201, "max_seats": None, "price_per_seat": 1500},
]

# Example B: $200 base, 1–10 @ $0 (included), 11+ @ $20.
INCLUDED_SEAT_TIERS: list[dict[str, object]] = [
    {"min_seats": 1, "max_seats": 10, "price_per_seat": 0},
    {"min_seats": 11, "max_seats": None, "price_per_seat": 2000},
]

# This tests Subscription updates with prorations, where the subscription is
# not a subscription in Stripe.
#
# - ✅ Tests normal upgrade/downgrade
# - ✅ Tests switch from monthly to yearly
# - ✅ Tests subscriptions with meters
# - ✅ Tests a customer with multiple subscriptions
# - ✅ Tests multiple switches within a cycle
# - ✅ Tests switch from yearly to monthly
# - Tests switch from a subscription where a discount is applied
#    - Once
#    - For 3 months
#    - In perpetuity
# - ✅ Tests both "invoice immediately" and "prorations on next invoice" options
#   - ✅ through the setting on the organization
#   - ✅ through specific parameter in the API (overrides org setting)
# ? Tests that benefits are granted ? (maybe this should just be covered in `test_service.py`)
# ? Tests free and "choose your own price" ?
# ? Tests a canceled subscription ?
# ? Tests tax ?
#
# All of these tests are checked both with the organisation having
# chosen to invoice immediately, or add prorations to the next invoice.


@pytest.fixture
def enqueue_benefits_grants_mock(mocker: MockerFixture) -> MagicMock:
    return mocker.patch.object(subscription_service, "enqueue_benefits_grants")


async def assert_system_events(
    session: AsyncSession,
    subscription: Subscription,
    customer: Customer,
    num_events_expected: int,
) -> list[Event]:
    event_repository = EventRepository.from_session(session)
    events = await event_repository.get_all_by_name(
        SystemEvent.subscription_product_updated
    )
    assert len(events) == num_events_expected

    events = sorted(events, key=lambda e: e.ingested_at)

    for event in events:
        assert event.user_metadata["subscription_id"] == str(subscription.id)
        assert event.customer_id == customer.id
        assert event.organization_id == customer.organization_id

    return events


type ExpectedBillingEntry = tuple[UUID, BillingEntryDirection, int, datetime, datetime]


async def assert_billing_entries(
    session: AsyncSession,
    subscription: Subscription,
    expected_billing_entries: list[ExpectedBillingEntry],
) -> None:
    billing_entry_repository = BillingEntryRepository.from_session(session)
    billing_entries = await billing_entry_repository.get_pending_by_subscription(
        subscription.id
    )
    assert len(billing_entries) == len(expected_billing_entries)

    billing_entries = sorted(
        billing_entries, key=lambda e: (e.start_timestamp, e.direction)
    )

    for billing_entry, expected_billing_entry in zip(
        billing_entries, expected_billing_entries
    ):
        event_id, direction, amount, start_timestamp, end_timestamp = (
            expected_billing_entry
        )

        assert billing_entry.event_id == event_id
        assert billing_entry.direction == direction
        assert billing_entry.amount == amount
        assert billing_entry.start_timestamp == start_timestamp
        assert billing_entry.end_timestamp == end_timestamp
        # assert billing_entry.customer_id == customer.id
        # assert billing_entry.product_price_id == old_price.id
        # assert billing_entry.currency == old_price.price_currency


@pytest.mark.asyncio
class TestUpdateProductProrations:
    @pytest.mark.parametrize(
        (
            "old_product_param",
            "new_product_param",
            "cycle_start",
            "time_of_update",
            "entry_0_amount",
            "entry_1_amount",
        ),
        [
            ######################################
            #### Basic monthly to Pro monthly ####
            ######################################
            pytest.param(
                (SubscriptionRecurringInterval.month, 10000),
                (SubscriptionRecurringInterval.month, 30000),
                # - Start subscription on June 1st (June has 30 days)
                # - Update subscription at the end of June 15th (== start of 16th)
                # = 50% of price on both entries
                datetime(2025, 6, 1, tzinfo=UTC),
                datetime(2025, 6, 16, tzinfo=UTC),
                5000,
                15000,
                id="monthly-basic-to-pro-middle-of-month",
            ),
            pytest.param(
                (SubscriptionRecurringInterval.month, 10000),
                (SubscriptionRecurringInterval.month, 30000),
                # - Start subscription on June 1st (June has 30 days)
                # - Update subscription at the end of June 10th (== start of 11th)
                # = 66.67% of price on both entries
                datetime(2025, 6, 1, tzinfo=UTC),
                datetime(2025, 6, 11, tzinfo=UTC),
                6667,
                20000,
                id="monthly-basic-to-pro-third-of-month",
            ),
            pytest.param(
                (SubscriptionRecurringInterval.month, 10000),
                (SubscriptionRecurringInterval.month, 30000),
                # - Start subscription on February 18st 2024 (leap year, 29 days)
                # - Update subscription at the end of February 25th
                # = (29 - 7) / 29 = 0.7586206897% of price on both entries
                datetime(2024, 2, 18, tzinfo=UTC),
                datetime(2024, 2, 25, tzinfo=UTC),
                7586,
                22759,
                id="monthly-basic-to-pro-february-leap-year",
            ),
            ####################################
            #### Basic yearly to Pro yearly ####
            ####################################
            pytest.param(
                (SubscriptionRecurringInterval.year, 100000),
                (SubscriptionRecurringInterval.year, 300000),
                # - Start subscription on August 1st
                # - Update subscription on October 1st
                # (365 - (30 + 31)) / 365 = 83.28767123% of price on both entries
                datetime(2024, 8, 1, tzinfo=UTC),
                datetime(2024, 10, 1, tzinfo=UTC),
                83288,
                249863,
                id="yearly-basic-to-pro-two-months",
            ),
            pytest.param(
                (SubscriptionRecurringInterval.year, 100000),
                (SubscriptionRecurringInterval.year, 300000),
                # - Start subscription on February 18st 2024 (leap year, 366 days)
                # - Update subscription on September 5th (200 days past Feb 18th)
                # = (366 - 200) / 366 = 45.36% of price on both entries
                datetime(2024, 2, 18, tzinfo=UTC),
                datetime(2024, 9, 5, tzinfo=UTC),
                45355,
                136066,
                id="yearly-basic-to-pro-february-leap-year",
            ),
            pytest.param(
                (SubscriptionRecurringInterval.year, 100000),
                (SubscriptionRecurringInterval.year, 300000),
                # - Start subscription on February 18st 2023 (non-leap year, 365 days)
                # - Update subscription on September 5th (199 days past Feb 18th)
                # = (365 - 199) / 365 = 45.48% of price on both entries
                datetime(2023, 2, 18, tzinfo=UTC),
                datetime(2023, 9, 5, tzinfo=UTC),
                45479,
                136438,
                id="yearly-basic-to-pro-february-non-leap-year",
            ),
            #######################################
            #### Basic monthly to Basic yearly ####
            #######################################
            pytest.param(
                (SubscriptionRecurringInterval.month, 10000),
                (SubscriptionRecurringInterval.year, 100000),
                # - Start subscription on June 1st (June has 30 days)
                # - Update subscription at the end of June 15th (== start of 16th)
                # = Credit 50% of price on monthly
                # = Debit 100% of price on yearly as the new cycle starts at the time of the update
                datetime(2025, 6, 1, tzinfo=UTC),
                datetime(2025, 6, 16, tzinfo=UTC),
                5000,
                100000,
                id="monthly-to-yearly-middle-of-month",
            ),
            pytest.param(
                (SubscriptionRecurringInterval.month, 10000),
                (SubscriptionRecurringInterval.year, 100000),
                # - Start subscription on June 1st (June has 30 days)
                # - Update subscription at the end of June 10th (== start of 11th)
                # = Credit 66.67% of price on monthly
                # = Debit 100% of price on yearly as the new cycle starts at the time of the update
                datetime(2025, 6, 1, tzinfo=UTC),
                datetime(2025, 6, 11, tzinfo=UTC),
                6667,
                100000,
                id="monthly-to-yearly-third-of-month",
            ),
            pytest.param(
                (SubscriptionRecurringInterval.month, 10000),
                (SubscriptionRecurringInterval.year, 100000),
                # - Start subscription on February 18st 2024 (leap year, 29 days)
                # - Update subscription at the end of February 25th
                # = Credit (29 - 7) / 29 = 75.86206897% of price on monthly
                # = Debit 100% of price on yearly as the new cycle starts at the time of the update
                datetime(2024, 2, 18, tzinfo=UTC),
                datetime(2024, 2, 25, tzinfo=UTC),
                7586,
                100000,
                id="monthly-to-yearly-february-leap-year",
            ),
            #######################################
            #### Basic yearly to Basic monthly ####
            #######################################
            pytest.param(
                (SubscriptionRecurringInterval.year, 100000),
                (SubscriptionRecurringInterval.month, 10000),
                # - Start subscription on June 1st (June has 30 days)
                # - Update subscription at the end of August 13th (== start of 14th) = 73 days = 20% of year
                # = Credit 80% of price on yearly
                # = Debit 100% of price on monthly as the new cycle starts at the time of the update
                datetime(2025, 6, 1, tzinfo=UTC),
                datetime(2025, 8, 13, tzinfo=UTC),
                80000,
                10000,
                id="yearly-to-monthly-fifth-of-year",
            ),
            pytest.param(
                (SubscriptionRecurringInterval.year, 100000),
                (SubscriptionRecurringInterval.month, 10000),
                # - Start subscription on February 18st 2024 (leap year, 366 days)
                # - Update subscription at the end of April 18th = 61 days = 1/6 of year
                # = Credit 5/6 = 83.33% of price on yearly
                # = Debit 100% of price on monrhly as the new cycle starts at the time of the update
                datetime(2024, 2, 18, tzinfo=UTC),
                datetime(2024, 4, 19, tzinfo=UTC),
                83333,
                10000,
                id="yearly-to-monthly-february-leap-year",
            ),
        ],
    )
    async def test_upgrade_base_cases(
        self,
        session: AsyncSession,
        mocker: MockerFixture,
        save_fixture: SaveFixture,
        enqueue_benefits_grants_mock: MagicMock,
        organization: Organization,
        customer: Customer,
        old_product_param: tuple[SubscriptionRecurringInterval, int],
        new_product_param: tuple[SubscriptionRecurringInterval, int],
        cycle_start: datetime,
        time_of_update: datetime,
        entry_0_amount: int,
        entry_1_amount: int,
    ) -> None:
        create_subscription_update_order_mock = mocker.patch.object(
            subscription_service, "_create_subscription_update_order", new=AsyncMock()
        )

        old_product = await create_product(
            save_fixture,
            organization=organization,
            recurring_interval=old_product_param[0],
            prices=[(old_product_param[1], "usd")],
        )
        new_product = await create_product(
            save_fixture,
            organization=organization,
            recurring_interval=new_product_param[0],
            prices=[(new_product_param[1], "usd")],
        )

        with freezegun.freeze_time(cycle_start) as frozen_time:
            # Assert default setting: "Invoice later"
            assert (
                organization.subscription_settings["proration_behavior"]
                == SubscriptionProrationBehavior.prorate
            )
            expected_proration = SubscriptionProrationBehavior.prorate

            subscription = await create_active_subscription(
                save_fixture,
                product=old_product,
                customer=customer,
            )

            previous_period_start = subscription.current_period_start
            previous_period_end = subscription.current_period_end

            frozen_time.move_to(time_of_update)

            # Actually update subscription
            async with SubscriptionUpdateContext(
                session, subscription, subscription_service
            ) as ctx:
                updated_subscription = await subscription_service.update_product(
                    session,
                    ctx,
                    subscription,
                    product_id=new_product.id,
                )

            assert updated_subscription.ended_at is None
            if old_product.recurring_interval == new_product.recurring_interval:
                assert (
                    updated_subscription.current_period_start == previous_period_start
                )
                assert updated_subscription.current_period_end == previous_period_end
            else:
                # When switching monthly to yearly or yearly to monthly:
                # - we reset the billing cycle
                # - we always invoice
                expected_proration = SubscriptionProrationBehavior.invoice
                assert updated_subscription.current_period_start == time_of_update

                if (
                    new_product.recurring_interval
                    == SubscriptionRecurringInterval.month
                ):
                    assert (
                        updated_subscription.current_period_end
                        == time_of_update + relativedelta(months=1)
                    )
                if new_product.recurring_interval == SubscriptionRecurringInterval.year:
                    assert (
                        updated_subscription.current_period_end
                        == time_of_update + relativedelta(years=1)
                    )

            event_repository = EventRepository.from_session(session)
            events = await event_repository.get_all_by_name(
                SystemEvent.subscription_product_updated
            )
            assert len(events) == 1
            event = events[0]
            assert event.user_metadata["subscription_id"] == str(subscription.id)
            assert event.customer_id == customer.id
            assert event.organization_id == customer.organization_id

            old_price = old_product.prices[0]
            new_price = new_product.prices[0]
            assert is_fixed_price(old_price)
            assert is_fixed_price(new_price)
            billing_entry_repository = BillingEntryRepository.from_session(session)
            billing_entries = (
                await billing_entry_repository.get_pending_by_subscription(
                    subscription.id
                )
            )
            assert len(billing_entries) == 2

            billing_entries = sorted(
                billing_entries, key=lambda e: (e.start_timestamp, e.direction)
            )

            # fmt: off
            assert billing_entries[0].start_timestamp == time_of_update
            assert billing_entries[0].end_timestamp == previous_period_end
            assert billing_entries[0].direction == BillingEntryDirection.credit
            assert billing_entries[0].customer_id == customer.id
            assert billing_entries[0].product_price_id == old_price.id
            assert billing_entries[0].event_id == event.id
            assert billing_entries[0].amount == entry_0_amount
            assert billing_entries[0].currency == old_price.price_currency
            # fmt: on

            # fmt: off
            assert billing_entries[1].start_timestamp == time_of_update
            assert billing_entries[1].end_timestamp == updated_subscription.current_period_end
            assert billing_entries[1].direction == BillingEntryDirection.debit
            assert billing_entries[1].customer_id == customer.id
            assert billing_entries[1].product_price_id == new_price.id
            if old_product.recurring_interval == new_product.recurring_interval:
                assert billing_entries[1].event_id == event.id
            assert billing_entries[1].amount == entry_1_amount
            assert billing_entries[1].currency == new_price.price_currency
            # fmt: on

            enqueue_benefits_grants_mock.assert_called_once_with(session, subscription)

            if (
                old_product.recurring_interval != new_product.recurring_interval
                or expected_proration == SubscriptionProrationBehavior.invoice
            ):
                create_subscription_update_order_mock.assert_awaited_once_with(
                    session, subscription
                )
            else:
                create_subscription_update_order_mock.assert_not_awaited()

    async def test_fixed_to_free_price(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
        customer: Customer,
    ) -> None:
        old_product = await create_product(
            save_fixture,
            organization=organization,
            recurring_interval=SubscriptionRecurringInterval.month,
            prices=[(100_00, "usd")],
        )
        new_product = await create_product(
            save_fixture,
            organization=organization,
            recurring_interval=SubscriptionRecurringInterval.month,
            prices=[(None, "usd")],
        )

        subscription = await create_active_subscription(
            save_fixture,
            product=old_product,
            customer=customer,
            current_period_start=datetime(2025, 6, 1, tzinfo=UTC),
            current_period_end=datetime(2025, 7, 1, tzinfo=UTC),
        )
        previous_period_end = subscription.current_period_end

        update_time = datetime(2025, 6, 16, tzinfo=UTC)
        with freezegun.freeze_time(update_time):
            async with SubscriptionUpdateContext(
                session, subscription, subscription_service
            ) as ctx:
                await subscription_service.update_product(
                    session,
                    ctx,
                    subscription,
                    product_id=new_product.id,
                )

            old_price = old_product.prices[0]
            new_price = new_product.prices[0]
            assert is_fixed_price(old_price)
            assert is_free_price(new_price)
            billing_entry_repository = BillingEntryRepository.from_session(session)
            billing_entries = (
                await billing_entry_repository.get_pending_by_subscription(
                    subscription.id
                )
            )
            assert len(billing_entries) == 1

            billing_entry = billing_entries[0]
            assert billing_entry.start_timestamp == update_time
            assert billing_entry.end_timestamp == previous_period_end
            assert billing_entry.direction == BillingEntryDirection.credit
            assert billing_entry.amount == 50_00
            assert billing_entry.currency == old_price.price_currency
            assert billing_entry.customer_id == customer.id
            assert billing_entry.product_price_id == old_price.id

    async def test_free_to_fixed_price(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
        customer: Customer,
    ) -> None:
        old_product = await create_product(
            save_fixture,
            organization=organization,
            recurring_interval=SubscriptionRecurringInterval.month,
            prices=[(None, "usd")],
        )
        new_product = await create_product(
            save_fixture,
            organization=organization,
            recurring_interval=SubscriptionRecurringInterval.month,
            prices=[(100_00, "usd")],
        )

        subscription = await create_active_subscription(
            save_fixture,
            product=old_product,
            customer=customer,
            current_period_start=datetime(2025, 6, 1, tzinfo=UTC),
            current_period_end=datetime(2025, 7, 1, tzinfo=UTC),
        )
        previous_period_end = subscription.current_period_end

        update_time = datetime(2025, 6, 16, tzinfo=UTC)
        with freezegun.freeze_time(update_time):
            async with SubscriptionUpdateContext(
                session, subscription, subscription_service
            ) as ctx:
                await subscription_service.update_product(
                    session,
                    ctx,
                    subscription,
                    product_id=new_product.id,
                )

            old_price = old_product.prices[0]
            new_price = new_product.prices[0]
            assert is_free_price(old_price)
            assert is_fixed_price(new_price)
            billing_entry_repository = BillingEntryRepository.from_session(session)
            billing_entries = (
                await billing_entry_repository.get_pending_by_subscription(
                    subscription.id
                )
            )
            assert len(billing_entries) == 1

            billing_entry = billing_entries[0]
            assert billing_entry.start_timestamp == update_time
            assert billing_entry.end_timestamp == previous_period_end
            assert billing_entry.direction == BillingEntryDirection.debit
            assert billing_entry.amount == 50_00
            assert billing_entry.currency == new_price.price_currency
            assert billing_entry.customer_id == customer.id
            assert billing_entry.product_price_id == new_price.id

    async def test_archived_price_update(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
        customer: Customer,
    ) -> None:
        product = await create_product(
            save_fixture,
            organization=organization,
            recurring_interval=SubscriptionRecurringInterval.month,
            prices=[(100_00, "usd")],
        )

        # Simulate an archived price
        old_price = await create_product_price_fixed(
            save_fixture,
            product=product,
            amount=50_00,
            is_archived=True,
        )
        subscription = await create_active_subscription(
            save_fixture,
            product=product,
            prices=[old_price],
            customer=customer,
            current_period_start=datetime(2025, 6, 1, tzinfo=UTC),
            current_period_end=datetime(2025, 7, 1, tzinfo=UTC),
        )
        previous_period_end = subscription.current_period_end

        update_time = datetime(2025, 6, 16, tzinfo=UTC)
        with freezegun.freeze_time(update_time):
            async with SubscriptionUpdateContext(
                session, subscription, subscription_service
            ) as ctx:
                await subscription_service.update_product(
                    session,
                    ctx,
                    subscription,
                    product_id=product.id,
                )

            new_price = product.prices[0]
            assert not new_price.is_archived
            assert is_fixed_price(old_price)
            assert is_fixed_price(new_price)
            billing_entry_repository = BillingEntryRepository.from_session(session)
            billing_entries = (
                await billing_entry_repository.get_pending_by_subscription(
                    subscription.id
                )
            )

            assert len(billing_entries) == 2
            billing_entries = sorted(
                billing_entries, key=lambda e: (e.start_timestamp, e.direction)
            )

            billing_entry = billing_entries[0]
            assert billing_entry.start_timestamp == update_time
            assert billing_entry.end_timestamp == previous_period_end
            assert billing_entry.direction == BillingEntryDirection.credit
            assert billing_entry.amount == 25_00
            assert billing_entry.currency == old_price.price_currency
            assert billing_entry.customer_id == customer.id
            assert billing_entry.product_price_id == old_price.id

            billing_entry = billing_entries[1]
            assert billing_entry.start_timestamp == update_time
            assert billing_entry.end_timestamp == previous_period_end
            assert billing_entry.direction == BillingEntryDirection.debit
            assert billing_entry.amount == 50_00
            assert billing_entry.currency == new_price.price_currency
            assert billing_entry.customer_id == customer.id
            assert billing_entry.product_price_id == new_price.id

    async def test_reset_behavior(
        self,
        mocker: MockerFixture,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
        customer: Customer,
    ) -> None:
        create_subscription_update_order_mock = mocker.patch.object(
            subscription_service, "_create_subscription_update_order", new=AsyncMock()
        )

        old_product = await create_product(
            save_fixture,
            organization=organization,
            recurring_interval=SubscriptionRecurringInterval.month,
            prices=[(50_00, "usd")],
        )
        new_product = await create_product(
            save_fixture,
            organization=organization,
            recurring_interval=SubscriptionRecurringInterval.month,
            prices=[(100_00, "usd")],
        )

        subscription = await create_active_subscription(
            save_fixture,
            product=old_product,
            customer=customer,
            current_period_start=datetime(2025, 6, 1, tzinfo=UTC),
            current_period_end=datetime(2025, 7, 1, tzinfo=UTC),
        )

        update_time = datetime(2025, 6, 16, tzinfo=UTC)
        with freezegun.freeze_time(update_time):
            new_anchor_day = update_time.day
            new_period_end = subscription.recurring_interval.get_next_period(
                update_time, new_anchor_day, subscription.recurring_interval_count
            )

            async with SubscriptionUpdateContext(
                session, subscription, subscription_service
            ) as ctx:
                updated_subscription = await subscription_service.update_product(
                    session,
                    ctx,
                    subscription,
                    product_id=new_product.id,
                    proration_behavior=SubscriptionProrationBehavior.reset,
                )

            create_subscription_update_order_mock.assert_awaited_once_with(
                session, subscription
            )

            assert updated_subscription.current_period_start == update_time
            assert updated_subscription.current_period_end == new_period_end
            assert updated_subscription.anchor_day == new_anchor_day

            new_price = new_product.prices[0]
            billing_entry_repository = BillingEntryRepository.from_session(session)
            billing_entries = await billing_entry_repository.get_all_by_subscription(
                subscription.id
            )
            assert len(billing_entries) == 1

            billing_entry = billing_entries[0]
            assert billing_entry.start_timestamp == update_time
            assert billing_entry.end_timestamp == new_period_end
            assert billing_entry.direction == BillingEntryDirection.debit
            assert billing_entry.amount == 100_00
            assert billing_entry.currency == new_price.price_currency
            assert billing_entry.customer_id == customer.id
            assert billing_entry.product_price_id == new_price.id

    @pytest.mark.parametrize(
        "proration_behavior",
        [
            (
                SubscriptionProrationBehavior.invoice,
                SubscriptionProrationBehavior.invoice,
            ),
            (
                SubscriptionProrationBehavior.prorate,
                SubscriptionProrationBehavior.invoice,
            ),
            (
                SubscriptionProrationBehavior.prorate,
                SubscriptionProrationBehavior.prorate,
            ),
            (
                SubscriptionProrationBehavior.invoice,
                SubscriptionProrationBehavior.prorate,
            ),
            (None, SubscriptionProrationBehavior.invoice),
            (None, SubscriptionProrationBehavior.prorate),
        ],
    )
    async def test_call_proration_overrides_org_proration(
        self,
        session: AsyncSession,
        mocker: MockerFixture,
        save_fixture: SaveFixture,
        organization: Organization,
        customer: Customer,
        proration_behavior: tuple[
            SubscriptionProrationBehavior | None, SubscriptionProrationBehavior
        ],
    ) -> None:
        """Test that the `proration_behavior` passed as an arg to `update_product()`
        is used -- if it's `None` then we fall back to the organization setting.
        """
        create_subscription_update_order_mock = mocker.patch.object(
            subscription_service, "_create_subscription_update_order", new=AsyncMock()
        )

        cycle_start = datetime(2025, 6, 1, tzinfo=UTC)
        time_of_update = datetime(2025, 6, 16, tzinfo=UTC)
        old_product = await create_product(
            save_fixture,
            organization=organization,
            recurring_interval=SubscriptionRecurringInterval.month,
            prices=[(10000, "usd")],
        )
        new_product = await create_product(
            save_fixture,
            organization=organization,
            recurring_interval=SubscriptionRecurringInterval.month,
            prices=[(30000, "usd")],
        )

        call_proration, org_proration = proration_behavior
        expected_proration = call_proration or org_proration

        organization.subscription_settings["proration_behavior"] = org_proration
        session.add(organization)
        await session.flush()

        with freezegun.freeze_time(cycle_start) as frozen_time:
            subscription = await create_active_subscription(
                save_fixture,
                product=old_product,
                customer=customer,
            )

            frozen_time.move_to(time_of_update)

            # Actually update subscription
            async with SubscriptionUpdateContext(
                session, subscription, subscription_service
            ) as ctx:
                await subscription_service.update_product(
                    session,
                    ctx,
                    subscription,
                    product_id=new_product.id,
                    proration_behavior=call_proration,
                )

            if expected_proration == SubscriptionProrationBehavior.invoice:
                create_subscription_update_order_mock.assert_awaited_once_with(
                    session, subscription
                )
            else:
                create_subscription_update_order_mock.assert_not_awaited()

    async def test_customer_with_multiple_subscriptions(
        self,
        session: AsyncSession,
        mocker: MockerFixture,
        save_fixture: SaveFixture,
        organization: Organization,
        customer: Customer,
    ) -> None:
        """Test that we can update 1 subscription on a customer that has 3
        subscriptions.
        """
        create_subscription_update_order_mock = mocker.patch.object(
            subscription_service, "_create_subscription_update_order", new=AsyncMock()
        )

        time_of_update = datetime(2025, 6, 17, tzinfo=UTC)
        products = [
            await create_product(
                save_fixture,
                organization=organization,
                recurring_interval=SubscriptionRecurringInterval.month,
                prices=[(10000 * (i + 1), "usd")],
            )
            for i in range(4)
        ]

        with freezegun.freeze_time(datetime(2025, 6, 1, tzinfo=UTC)) as frozen_time:
            # Create 3 subscriptions starting June 1st, June 2nd, June 3rd respectively
            subscriptions = []
            for i in range(3):
                start_date = datetime(2025, 6, i + 1, tzinfo=UTC)

                frozen_time.move_to(start_date)

                subscription = await create_active_subscription(
                    save_fixture,
                    product=products[i],
                    customer=customer,
                )
                subscriptions.append(subscription)

            #  Update subscription no. 2 on June 17th
            frozen_time.move_to(time_of_update)
            async with SubscriptionUpdateContext(
                session, subscriptions[1], subscription_service
            ) as ctx:
                updated_subscription = await subscription_service.update_product(
                    session,
                    ctx,
                    subscriptions[1],
                    product_id=products[3].id,
                    proration_behavior=SubscriptionProrationBehavior.invoice,
                )

            assert updated_subscription.current_period_start == datetime(
                2025, 6, 2, tzinfo=UTC
            )
            assert updated_subscription.current_period_end == datetime(
                2025, 7, 2, tzinfo=UTC
            )

            for subscription in subscriptions:
                await session.refresh(subscription)

            # fmt: off
            assert subscriptions[0].current_period_start == datetime(2025, 6, 1, tzinfo=UTC)
            assert subscriptions[0].current_period_end   == datetime(2025, 7, 1, tzinfo=UTC)
            assert subscriptions[0].product_id           == products[0].id
            assert subscriptions[1].current_period_start == datetime(2025, 6, 2, tzinfo=UTC)
            assert subscriptions[1].current_period_end   == datetime(2025, 7, 2, tzinfo=UTC)
            assert subscriptions[1].product_id           == products[3].id
            assert subscriptions[2].current_period_start == datetime(2025, 6, 3, tzinfo=UTC)
            assert subscriptions[2].current_period_end   == datetime(2025, 7, 3, tzinfo=UTC)
            assert subscriptions[2].product_id           == products[2].id
            # fmt: on

            event_repository = EventRepository.from_session(session)
            events = await event_repository.get_all_by_name(
                SystemEvent.subscription_product_updated
            )
            assert len(events) == 1
            event = events[0]
            assert event.user_metadata["subscription_id"] == str(
                updated_subscription.id
            )
            assert event.customer_id == customer.id
            assert event.organization_id == customer.organization_id

            old_price = products[1].prices[0]
            new_price = products[3].prices[0]
            assert is_fixed_price(old_price)
            assert is_fixed_price(new_price)
            billing_entry_repository = BillingEntryRepository.from_session(session)
            billing_entries = (
                await billing_entry_repository.get_pending_by_subscription(
                    subscriptions[1].id
                )
            )
            assert len(billing_entries) == 2

            billing_entries = sorted(
                billing_entries, key=lambda e: (e.start_timestamp, e.direction)
            )

            # fmt: off
            assert billing_entries[0].start_timestamp == time_of_update
            assert billing_entries[0].end_timestamp == updated_subscription.current_period_end
            assert billing_entries[0].direction == BillingEntryDirection.credit
            assert billing_entries[0].customer_id == customer.id
            assert billing_entries[0].product_price_id == old_price.id
            assert billing_entries[0].event_id == event.id
            assert billing_entries[0].amount == 10000
            assert billing_entries[0].currency == old_price.price_currency
            # fmt: on

            # fmt: off
            assert billing_entries[1].start_timestamp == time_of_update
            assert billing_entries[1].end_timestamp == updated_subscription.current_period_end
            assert billing_entries[1].direction == BillingEntryDirection.debit
            assert billing_entries[1].customer_id == customer.id
            assert billing_entries[1].product_price_id == new_price.id
            assert billing_entries[1].event_id == event.id
            assert billing_entries[1].amount == 20000
            assert billing_entries[1].currency == new_price.price_currency
            # fmt: on

            create_subscription_update_order_mock.assert_awaited_once_with(
                session, subscriptions[1]
            )

    async def test_multiple_switches_within_cycle(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
        customer: Customer,
    ) -> None:
        """Tests a customer who changes their subscription multiple times
        within a cycle"""
        proration_behavior = SubscriptionProrationBehavior.prorate

        cycle_start = datetime(2025, 6, 1, tzinfo=UTC)
        cycle_end = datetime(2025, 6, 1, tzinfo=UTC) + relativedelta(months=1)
        time_of_update_1 = datetime(2025, 6, 7, tzinfo=UTC)
        time_of_update_2 = datetime(2025, 6, 13, tzinfo=UTC)
        time_of_update_3 = datetime(2025, 6, 19, tzinfo=UTC)
        time_of_update_4 = datetime(2025, 6, 25, tzinfo=UTC)
        products = [
            await create_product(
                save_fixture,
                organization=organization,
                recurring_interval=SubscriptionRecurringInterval.month,
                prices=[(10000 * (i + 1), "usd")],
            )
            for i in range(4)
        ]

        with freezegun.freeze_time(cycle_start) as frozen_time:
            subscription = await create_active_subscription(
                save_fixture,
                product=products[0],
                customer=customer,
            )

            previous_period_start = subscription.current_period_start
            previous_period_end = subscription.current_period_end

            frozen_time.move_to(time_of_update_1)

            ############
            # Update 1 #
            ############
            async with SubscriptionUpdateContext(
                session, subscription, subscription_service
            ) as ctx:
                updated_subscription = await subscription_service.update_product(
                    session,
                    ctx,
                    subscription,
                    product_id=products[1].id,
                    proration_behavior=proration_behavior,
                )

            # fmt: off
            assert updated_subscription.ended_at is None
            assert updated_subscription.current_period_start == previous_period_start
            assert updated_subscription.current_period_end == previous_period_end
            # fmt: on

            events = await assert_system_events(session, subscription, customer, 1)

            # fmt: off
            await assert_billing_entries(
                session,
                subscription,
                [
                    (events[0].id, BillingEntryDirection.credit, int(0.8*10000), time_of_update_1, cycle_end),
                    (events[0].id, BillingEntryDirection.debit,  int(0.8*20000), time_of_update_1, cycle_end),
                ]
            )
            # fmt: on

            ############
            # Update 2 #
            ############
            async with SubscriptionUpdateContext(
                session, subscription, subscription_service
            ) as ctx:
                frozen_time.move_to(time_of_update_2)
                updated_subscription = await subscription_service.update_product(
                    session,
                    ctx,
                    subscription,
                    product_id=products[2].id,
                    proration_behavior=proration_behavior,
                )

            # fmt: off
            assert updated_subscription.ended_at is None
            assert updated_subscription.current_period_start == previous_period_start
            assert updated_subscription.current_period_end == previous_period_end
            # fmt: on

            events = await assert_system_events(session, subscription, customer, 2)

            # fmt: off
            await assert_billing_entries(
                session,
                subscription,
                [
                    (events[0].id, BillingEntryDirection.credit, int(0.8*10000), time_of_update_1, cycle_end),
                    (events[0].id, BillingEntryDirection.debit,  int(0.8*20000), time_of_update_1, cycle_end),
                    (events[1].id, BillingEntryDirection.credit, int(0.6*20000), time_of_update_2, cycle_end),
                    (events[1].id, BillingEntryDirection.debit,  int(0.6*30000), time_of_update_2, cycle_end),
                ]
            )
            # fmt: on

            ############
            # Update 3 #
            ############
            frozen_time.move_to(time_of_update_3)
            async with SubscriptionUpdateContext(
                session, subscription, subscription_service
            ) as ctx:
                updated_subscription = await subscription_service.update_product(
                    session,
                    ctx,
                    subscription,
                    product_id=products[3].id,
                    proration_behavior=proration_behavior,
                )

            # fmt: off
            assert updated_subscription.ended_at is None
            assert updated_subscription.current_period_start == previous_period_start
            assert updated_subscription.current_period_end == previous_period_end
            # fmt: on

            events = await assert_system_events(session, subscription, customer, 3)

            # fmt: off
            await assert_billing_entries(
                session,
                subscription,
                [
                    (events[0].id, BillingEntryDirection.credit, int(0.8*10000), time_of_update_1, cycle_end),
                    (events[0].id, BillingEntryDirection.debit,  int(0.8*20000), time_of_update_1, cycle_end),
                    (events[1].id, BillingEntryDirection.credit, int(0.6*20000), time_of_update_2, cycle_end),
                    (events[1].id, BillingEntryDirection.debit,  int(0.6*30000), time_of_update_2, cycle_end),
                    (events[2].id, BillingEntryDirection.credit, int(0.4*30000), time_of_update_3, cycle_end),
                    (events[2].id, BillingEntryDirection.debit,  int(0.4*40000), time_of_update_3, cycle_end),
                ]
            )
            # fmt: on

    async def test_pricing_order_and_meter(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
        meter: Meter,
        customer: Customer,
    ) -> None:
        # - Start subscription on June 1st (June has 30 days)
        # - Update subscription at the end of June 10th (== start of 11th)
        # = 66.67% of price on both entries
        cycle_start = datetime(2025, 6, 1, tzinfo=UTC)
        time_of_update = datetime(2025, 6, 11, tzinfo=UTC)

        old_product = await create_product(
            save_fixture,
            organization=organization,
            recurring_interval=SubscriptionRecurringInterval.month,
            prices=[(meter, Decimal(50), None, "usd"), (10000, "usd")],
        )
        new_product = await create_product(
            save_fixture,
            organization=organization,
            recurring_interval=SubscriptionRecurringInterval.month,
            prices=[(meter, Decimal(50), None, "usd"), (30000, "usd")],
        )

        with freezegun.freeze_time(cycle_start) as frozen_time:
            subscription = await create_active_subscription(
                save_fixture,
                product=old_product,
                customer=customer,
            )
            assert len(subscription.meters) == 1
            subscription_meter = subscription.meters[0]
            assert subscription_meter.meter == meter
            assert subscription_meter.subscription == subscription

            previous_period_start = subscription.current_period_start
            previous_period_end = subscription.current_period_end

            frozen_time.move_to(time_of_update)

            async with SubscriptionUpdateContext(
                session, subscription, subscription_service
            ) as ctx:
                updated_subscription = await subscription_service.update_product(
                    session,
                    ctx,
                    subscription,
                    product_id=new_product.id,
                    proration_behavior=SubscriptionProrationBehavior.prorate,
                )

            assert updated_subscription.product == new_product
            assert len(updated_subscription.meters) == 1
            updated_subscription_meter = updated_subscription.meters[0]
            assert updated_subscription_meter.meter == meter
            assert updated_subscription_meter.subscription == updated_subscription

            old_price = old_product.prices[1]
            new_price = new_product.prices[1]
            assert is_fixed_price(old_price)
            assert is_fixed_price(new_price)
            billing_entry_repository = BillingEntryRepository.from_session(session)
            billing_entries = (
                await billing_entry_repository.get_pending_by_subscription(
                    subscription.id
                )
            )
            assert len(billing_entries) == 2

            billing_entries = sorted(
                billing_entries, key=lambda e: (e.start_timestamp, e.direction)
            )

            # fmt: off
            assert billing_entries[0].start_timestamp == time_of_update
            assert billing_entries[0].end_timestamp == previous_period_end
            assert billing_entries[0].direction == BillingEntryDirection.credit
            assert billing_entries[0].customer_id == customer.id
            assert billing_entries[0].product_price_id == old_price.id
            # assert billing_entries[0].event_id == event.id
            assert billing_entries[0].amount == 6667
            assert billing_entries[0].currency == old_price.price_currency
            # fmt: on

            # fmt: off
            assert billing_entries[1].start_timestamp == time_of_update
            assert billing_entries[1].end_timestamp == updated_subscription.current_period_end
            assert billing_entries[1].direction == BillingEntryDirection.debit
            assert billing_entries[1].customer_id == customer.id
            assert billing_entries[1].product_price_id == new_price.id
            # assert billing_entries[1].event_id == event.id
            assert billing_entries[1].amount == 20000
            assert billing_entries[1].currency == new_price.price_currency
            # fmt: on

    @pytest.mark.parametrize(
        ("old_discount", "new_discount", "expected_credit", "expected_debit"),
        [
            pytest.param(
                (DiscountType.percentage, 25_00),  # 25% discount
                (DiscountType.percentage, 50_00),  # 50% discount
                37_50,  # $100 with 25% discount, prorated for 15/30 days
                250_00,  # $1000 with 50% discount, prorated for 15/30 days
                id="percentage-discount-change",
            ),
            pytest.param(
                None,
                (DiscountType.percentage, 50_00),  # 50% discount
                50_00,  # $100 with no discount, prorated for 15/30 days
                250_00,  # $1000 with 50% discount, prorated for 15/30 days
                id="new-percentage-discount",
            ),
            pytest.param(
                (DiscountType.percentage, 25_00),  # 25% discount
                None,
                37_50,  # $100 with 25% discount, prorated for 15/30 days
                500_00,  # $1000 with no discount, prorated for 15/30 days
                id="removed-percentage-discount",
            ),
            pytest.param(
                (DiscountType.fixed, 25_00),  # $25 discount
                (DiscountType.fixed, 50_00),  # $50 discount
                37_50,  # $100 with $25 discount, prorated for 15/30 days
                475_00,  # $1000 with $50 discount, prorated for 15/30 days
                id="fixed-discount-change",
            ),
        ],
    )
    async def test_proration_with_discount_change(
        self,
        old_discount: tuple[DiscountType, int] | None,
        new_discount: tuple[DiscountType, int] | None,
        expected_credit: int,
        expected_debit: int,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
        customer: Customer,
    ) -> None:
        cycle_start = datetime(2025, 6, 1, tzinfo=UTC)
        time_of_update = datetime(2025, 6, 16, tzinfo=UTC)

        old_product = await create_product(
            save_fixture,
            organization=organization,
            recurring_interval=SubscriptionRecurringInterval.month,
            prices=[(100_00, "usd")],
        )
        new_product = await create_product(
            save_fixture,
            organization=organization,
            recurring_interval=SubscriptionRecurringInterval.month,
            prices=[(1000_00, "usd")],
        )

        old_discount_arg: Discount | None
        if old_discount is not None:
            if old_discount[0] == DiscountType.percentage:
                old_discount_arg = await create_discount(
                    save_fixture,
                    type=DiscountType.percentage,
                    basis_points=old_discount[1],
                    organization=organization,
                    duration=DiscountDuration.forever,
                )
            else:
                old_discount_arg = await create_discount(
                    save_fixture,
                    type=DiscountType.fixed,
                    amounts={"usd": old_discount[1]},
                    organization=organization,
                    duration=DiscountDuration.forever,
                )
        else:
            old_discount_arg = None

        new_discount_arg: uuid.UUID | typing.Literal["unset"]
        if new_discount is not None:
            if new_discount[0] == DiscountType.percentage:
                new_discount_arg = (
                    await create_discount(
                        save_fixture,
                        type=DiscountType.percentage,
                        basis_points=new_discount[1],
                        organization=organization,
                        duration=DiscountDuration.forever,
                    )
                ).id
            else:
                new_discount_arg = (
                    await create_discount(
                        save_fixture,
                        type=DiscountType.fixed,
                        amounts={"usd": new_discount[1]},
                        organization=organization,
                        duration=DiscountDuration.forever,
                    )
                ).id
        else:
            new_discount_arg = "unset"

        with freezegun.freeze_time(cycle_start) as frozen_time:
            subscription = await create_active_subscription(
                save_fixture,
                product=old_product,
                customer=customer,
                discount=old_discount_arg,
            )

            previous_period_start = subscription.current_period_start
            previous_period_end = subscription.current_period_end

            frozen_time.move_to(time_of_update)

            # Actually update subscription
            async with SubscriptionUpdateContext(
                session, subscription, subscription_service
            ) as ctx:
                updated_subscription = await subscription_service.update_product(
                    session,
                    ctx,
                    subscription,
                    product_id=new_product.id,
                    discount=new_discount_arg,
                    proration_behavior=SubscriptionProrationBehavior.prorate,
                )

            billing_entry_repository = BillingEntryRepository.from_session(session)
            billing_entries = (
                await billing_entry_repository.get_pending_by_subscription(
                    subscription.id
                )
            )
            assert len(billing_entries) == 2

            billing_entries = sorted(
                billing_entries, key=lambda e: (e.start_timestamp, e.direction)
            )

            old_price = old_product.prices[0]
            new_price = new_product.prices[0]
            assert is_fixed_price(old_price)
            assert is_fixed_price(new_price)

            # fmt: off
            assert billing_entries[0].start_timestamp == time_of_update
            assert billing_entries[0].end_timestamp == previous_period_end
            assert billing_entries[0].direction == BillingEntryDirection.credit
            assert billing_entries[0].customer_id == customer.id
            assert billing_entries[0].product_price_id == old_price.id
            assert billing_entries[0].amount == expected_credit
            assert billing_entries[0].currency == old_price.price_currency
            # fmt: on

            # fmt: off
            assert billing_entries[1].start_timestamp == time_of_update
            assert billing_entries[1].end_timestamp == updated_subscription.current_period_end
            assert billing_entries[1].direction == BillingEntryDirection.debit
            assert billing_entries[1].customer_id == customer.id
            assert billing_entries[1].product_price_id == new_price.id
            assert billing_entries[1].amount == expected_debit
            assert billing_entries[1].currency == new_price.price_currency
            # fmt: on


@pytest.mark.asyncio
class TestImmediateSeatChangeWithPendingProductChange:
    """End-to-end for #11129: schedule A→B `next_period`, change seats
    with `prorate`, cycle. Parametrised to pin the proration math and
    the post-cycle amount across seat/price combinations."""

    @pytest.mark.parametrize(
        (
            "old_price_per_seat",
            "new_price_per_seat",
            "old_seats",
            "new_seats",
            "cycle_start",
            "time_of_update",
            "expected_proration_amount",
            "expected_proration_direction",
            "expected_post_cycle_amount",
        ),
        [
            pytest.param(
                # $10/seat -> $25/seat, 5 -> 8 seats, mid-month.
                # delta = (8-5) * 1000 = 3000 cents on A's seat price.
                # factor = 15/30 = 0.5
                # prorated = int(3000 * 0.5) = 1500
                # post-cycle amount = 8 * 2500 = 20000
                1000,
                2500,
                5,
                8,
                datetime(2025, 6, 1, tzinfo=UTC),
                datetime(2025, 6, 16, tzinfo=UTC),
                1500,
                BillingEntryDirection.debit,
                20000,
                id="upgrade-and-add-seats-half-month",
            ),
            pytest.param(
                # $15/seat -> $25/seat, 5 -> 10 seats, third-of-month.
                # delta = (10-5) * 1500 = 7500
                # factor = 20/30 = 2/3
                # prorated = int(7500 * 2/3) = 5000
                # post-cycle amount = 10 * 2500 = 25000
                1500,
                2500,
                5,
                10,
                datetime(2025, 6, 1, tzinfo=UTC),
                datetime(2025, 6, 11, tzinfo=UTC),
                5000,
                BillingEntryDirection.debit,
                25000,
                id="upgrade-and-double-seats-third-month",
            ),
            pytest.param(
                # Price downgrade ($20 -> $10), seats up (10 -> 12), mid-month.
                # delta = (12-10) * 2000 = 4000 on A's seat price ($20/seat)
                # factor = 15/30 = 0.5
                # prorated = int(4000 * 0.5) = 2000
                # post-cycle amount = 12 * 1000 = 12000
                2000,
                1000,
                10,
                12,
                datetime(2025, 6, 1, tzinfo=UTC),
                datetime(2025, 6, 16, tzinfo=UTC),
                2000,
                BillingEntryDirection.debit,
                12000,
                id="price-downgrade-with-seat-increase",
            ),
            pytest.param(
                # Price upgrade ($15 -> $25), seats down (10 -> 7), mid-month.
                # Decrease produces a *credit* entry.
                # delta = (10-7) * 1500 = 4500 on A's seat price
                # factor = 15/30 = 0.5
                # prorated = int(4500 * 0.5) = 2250 (credit)
                # post-cycle amount = 7 * 2500 = 17500
                1500,
                2500,
                10,
                7,
                datetime(2025, 6, 1, tzinfo=UTC),
                datetime(2025, 6, 16, tzinfo=UTC),
                2250,
                BillingEntryDirection.credit,
                17500,
                id="upgrade-and-reduce-seats",
            ),
        ],
    )
    async def test_e2e_immediate_seats_with_pending_product_change(
        self,
        session: AsyncSession,
        mocker: MockerFixture,
        save_fixture: SaveFixture,
        enqueue_benefits_grants_mock: MagicMock,
        organization: Organization,
        customer: Customer,
        old_price_per_seat: int,
        new_price_per_seat: int,
        old_seats: int,
        new_seats: int,
        cycle_start: datetime,
        time_of_update: datetime,
        expected_proration_amount: int,
        expected_proration_direction: BillingEntryDirection,
        expected_post_cycle_amount: int,
    ) -> None:
        # Test customer has no payment method; mock the order-creation
        # call that the prorate path would otherwise drive.
        mocker.patch.object(
            subscription_service,
            "_create_subscription_update_order",
            new=AsyncMock(),
        )

        with freezegun.freeze_time(cycle_start) as frozen_time:
            product_a = await create_product(
                save_fixture,
                organization=organization,
                recurring_interval=SubscriptionRecurringInterval.month,
                prices=[("seat", old_price_per_seat, "usd")],
            )
            product_b = await create_product(
                save_fixture,
                organization=organization,
                recurring_interval=SubscriptionRecurringInterval.month,
                prices=[("seat", new_price_per_seat, "usd")],
            )

            subscription = await create_subscription_with_seats(
                save_fixture,
                product=product_a,
                customer=customer,
                seats=old_seats,
            )
            assert subscription.current_period_start == cycle_start
            previous_period_end = subscription.current_period_end
            assert previous_period_end is not None

            frozen_time.move_to(time_of_update)

            # 1. Schedule A -> B at next_period.
            async with SubscriptionUpdateContext(
                session, subscription, subscription_service
            ) as ctx:
                await subscription_service.update_product(
                    session,
                    ctx,
                    subscription,
                    product_id=product_b.id,
                    proration_behavior=SubscriptionProrationBehavior.next_period,
                )
            await session.flush()

            sub_update_repo = SubscriptionUpdateRepository.from_session(session)
            pending = await sub_update_repo.get_unapplied_by_subscription_id(
                subscription.id
            )
            assert pending is not None
            assert pending.product_id == product_b.id
            assert pending.seats is None

            # 2. Bump seats with `prorate` — immediate proration entry.
            async with SubscriptionUpdateContext(
                session, subscription, subscription_service
            ) as ctx:
                updated = await subscription_service.update_seats(
                    session,
                    ctx,
                    subscription,
                    seats=new_seats,
                    proration_behavior=SubscriptionProrationBehavior.prorate,
                )
            await session.flush()

            # Subscription stays on A with seats applied immediately.
            assert updated.product_id == product_a.id
            assert updated.seats == new_seats
            assert updated.amount == new_seats * old_price_per_seat

            # Scheduled product change preserved; stale seats cleared.
            pending = await sub_update_repo.get_unapplied_by_subscription_id(
                subscription.id
            )
            assert pending is not None, "scheduled product change was dropped"
            assert pending.product_id == product_b.id
            assert pending.seats is None
            assert pending.applies_at == previous_period_end
            assert pending.applied_at is None

            # Proration billing entry priced off A's seat price.
            billing_entry_repo = BillingEntryRepository.from_session(session)
            entries = await billing_entry_repo.get_pending_by_subscription(
                subscription.id
            )
            old_price = product_a.prices[0]
            assert is_seat_price(old_price)
            seat_entries = [
                e
                for e in entries
                if e.product_price_id == old_price.id
                and e.type
                in (
                    BillingEntryType.subscription_seats_increase,
                    BillingEntryType.subscription_seats_decrease,
                )
            ]
            assert len(seat_entries) == 1
            entry = seat_entries[0]
            assert entry.amount == expected_proration_amount
            assert entry.direction == expected_proration_direction
            assert entry.customer_id == customer.id
            assert entry.start_timestamp == time_of_update
            assert entry.end_timestamp == previous_period_end
            assert entry.currency == old_price.price_currency

            # 3. Force cycle past current_period_end so it applies the
            # pending product change.
            frozen_time.move_to(previous_period_end + timedelta(seconds=1))
            async with SubscriptionUpdateContext(
                session, updated, subscription_service
            ) as ctx:
                cycled = await subscription_service.cycle(session, ctx, updated)
            await session.flush()

            assert cycled.product_id == product_b.id
            assert cycled.seats == new_seats
            assert cycled.amount == expected_post_cycle_amount
            assert cycled.pending_update is None

            applied = await sub_update_repo.get_by_id(pending.id)
            assert applied is not None
            assert applied.applied_at is not None


# --- Composed static price (fixed + seat) discount allocation -----------------
#
# These exercise the not-yet-reachable "fixed base fee + seat price" composition.
# The factories build the prices and subscription rows directly, bypassing
# product-price validation. Cases use values where proportional allocation of a
# fixed discount matters — i.e. where a naive per-price `min(discount, amount)`
# would distribute the discount differently — so they pin down the behaviour we
# want once multiple prices ship. Period 2025-06-01 → 2025-07-01 with an update
# at 2025-06-16 gives a clean proration factor of 0.5.

CYCLE_START = datetime(2025, 6, 1, tzinfo=UTC)
CYCLE_END = datetime(2025, 7, 1, tzinfo=UTC)
UPDATE_TIME = datetime(2025, 6, 16, tzinfo=UTC)


async def _create_fixed_and_seat_subscription(
    save_fixture: SaveFixture,
    *,
    organization: Organization,
    customer: Customer,
    fixed_amount: int,
    price_per_seat: int,
    seats: int,
    discount: Discount | None = None,
) -> tuple[Product, Subscription]:
    """Assemble an active subscription with a fixed base fee and a seat price.

    Test-only: production can't yet produce this composition, but the factories
    construct the DB objects directly without cross-price validation.
    """
    product = await create_product(
        save_fixture,
        organization=organization,
        recurring_interval=SubscriptionRecurringInterval.month,
        prices=[(fixed_amount, "usd"), ("seat", price_per_seat, "usd")],
    )
    subscription = await create_subscription(
        save_fixture,
        product=product,
        prices=product.prices,
        customer=customer,
        status=SubscriptionStatus.active,
        started_at=CYCLE_START,
        seats=seats,
        discount=discount,
        current_period_start=CYCLE_START,
        current_period_end=CYCLE_END,
    )
    return product, subscription


def _amounts_by_price(
    billing_entries: Sequence[BillingEntry],
) -> dict[tuple[UUID, BillingEntryDirection], int | None]:
    return {
        (entry.product_price_id, entry.direction): entry.amount
        for entry in billing_entries
    }


def _fixed_price_id(product: Product) -> UUID:
    return next(p.id for p in product.prices if is_fixed_price(p))


def _seat_price_id(product: Product) -> UUID:
    return next(p.id for p in product.prices if is_seat_price(p))


@pytest.mark.asyncio
class TestComposedStaticPriceDiscountAllocation:
    async def test_product_change_fixed_discount_distributes(
        self,
        mocker: MockerFixture,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
        customer: Customer,
    ) -> None:
        mocker.patch.object(
            subscription_service, "_create_subscription_update_order", new=AsyncMock()
        )

        discount = await create_discount(
            save_fixture,
            type=DiscountType.fixed,
            amounts={"usd": 90_00},
            duration=DiscountDuration.forever,
            organization=organization,
        )

        # Old plan: fixed 100_00 + seat 200_00 (1 seat). The 90_00 discount is
        # split proportionally across the 300_00 total as [30_00, 60_00].
        old_product, subscription = await _create_fixed_and_seat_subscription(
            save_fixture,
            organization=organization,
            customer=customer,
            fixed_amount=100_00,
            price_per_seat=200_00,
            seats=1,
            discount=discount,
        )
        # New plan: fixed 300_00 + seat 200_00 (1 seat). The 90_00 discount is
        # split proportionally across the 500_00 total as [54_00, 36_00].
        new_product = await create_product(
            save_fixture,
            organization=organization,
            recurring_interval=SubscriptionRecurringInterval.month,
            prices=[(300_00, "usd"), ("seat", 200_00, "usd")],
        )

        with freezegun.freeze_time(UPDATE_TIME):
            async with SubscriptionUpdateContext(
                session, subscription, subscription_service
            ) as ctx:
                await subscription_service.update_product(
                    session, ctx, subscription, product_id=new_product.id
                )

            repository = BillingEntryRepository.from_session(session)
            entries = await repository.get_pending_by_subscription(subscription.id)

        amounts = _amounts_by_price(entries)
        # Credit (old plan), factor 0.5:
        #   fixed: (100_00 - 30_00) * 0.5 = 35_00
        #   seat:  (200_00 - 60_00) * 0.5 = 70_00
        assert (
            amounts[(_fixed_price_id(old_product), BillingEntryDirection.credit)]
            == 35_00
        )
        assert (
            amounts[(_seat_price_id(old_product), BillingEntryDirection.credit)]
            == 70_00
        )
        # Debit (new plan), factor 0.5:
        #   fixed: (300_00 - 54_00) * 0.5 = 123_00
        #   seat:  (200_00 - 36_00) * 0.5 = 82_00
        assert (
            amounts[(_fixed_price_id(new_product), BillingEntryDirection.debit)]
            == 123_00
        )
        assert (
            amounts[(_seat_price_id(new_product), BillingEntryDirection.debit)] == 82_00
        )

    async def test_product_change_percentage_discount_distributes(
        self,
        mocker: MockerFixture,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
        customer: Customer,
    ) -> None:
        mocker.patch.object(
            subscription_service, "_create_subscription_update_order", new=AsyncMock()
        )

        discount = await create_discount(
            save_fixture,
            type=DiscountType.percentage,
            basis_points=1000,  # 10%
            duration=DiscountDuration.forever,
            organization=organization,
        )

        old_product, subscription = await _create_fixed_and_seat_subscription(
            save_fixture,
            organization=organization,
            customer=customer,
            fixed_amount=100_00,
            price_per_seat=120_00,
            seats=1,
            discount=discount,
        )
        new_product = await create_product(
            save_fixture,
            organization=organization,
            recurring_interval=SubscriptionRecurringInterval.month,
            prices=[(200_00, "usd"), ("seat", 120_00, "usd")],
        )

        with freezegun.freeze_time(UPDATE_TIME):
            async with SubscriptionUpdateContext(
                session, subscription, subscription_service
            ) as ctx:
                await subscription_service.update_product(
                    session, ctx, subscription, product_id=new_product.id
                )

            repository = BillingEntryRepository.from_session(session)
            entries = await repository.get_pending_by_subscription(subscription.id)

        amounts = _amounts_by_price(entries)
        # Percentage distributes independently, factor 0.5:
        #   credit fixed: (100_00 - 10_00) * 0.5 = 45_00
        #   credit seat:  (120_00 - 12_00) * 0.5 = 54_00
        #   debit  fixed: (200_00 - 20_00) * 0.5 = 90_00
        #   debit  seat:  (120_00 - 12_00) * 0.5 = 54_00
        assert (
            amounts[(_fixed_price_id(old_product), BillingEntryDirection.credit)]
            == 45_00
        )
        assert (
            amounts[(_seat_price_id(old_product), BillingEntryDirection.credit)]
            == 54_00
        )
        assert (
            amounts[(_fixed_price_id(new_product), BillingEntryDirection.debit)]
            == 90_00
        )
        assert (
            amounts[(_seat_price_id(new_product), BillingEntryDirection.debit)] == 54_00
        )

    async def test_seat_change_fixed_discount_distributes(
        self,
        mocker: MockerFixture,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
        customer: Customer,
    ) -> None:
        mocker.patch.object(
            subscription_service, "_create_subscription_update_order", new=AsyncMock()
        )

        discount = await create_discount(
            save_fixture,
            type=DiscountType.fixed,
            amounts={"usd": 150_00},
            duration=DiscountDuration.forever,
            organization=organization,
        )

        # Fixed 100_00 + seat 50_00/seat, 2 → 4 seats. The 150_00 discount is
        # split proportionally between the fixed fee and the seat amount at each
        # seat count, and we keep the seat's share:
        #   2 seats: seat 100_00 of 200_00 total → seat share 75_00
        #   4 seats: seat 200_00 of 300_00 total → seat share 100_00
        # Effective seat amounts: (100_00 - 75_00) = 25_00, (200_00 - 100_00) = 100_00
        #   delta = 75_00, prorated = 75_00 * 0.5 = 37_50
        product, subscription = await _create_fixed_and_seat_subscription(
            save_fixture,
            organization=organization,
            customer=customer,
            fixed_amount=100_00,
            price_per_seat=50_00,
            seats=2,
            discount=discount,
        )

        with freezegun.freeze_time(UPDATE_TIME):
            async with SubscriptionUpdateContext(
                session, subscription, subscription_service
            ) as ctx:
                updated = await subscription_service.update_seats(
                    session,
                    ctx,
                    subscription,
                    seats=4,
                    proration_behavior=SubscriptionProrationBehavior.prorate,
                )
            await session.flush()

            repository = BillingEntryRepository.from_session(session)
            entries = await repository.get_pending_by_subscription(updated.id)

        seat_entries = [
            e
            for e in entries
            if e.type
            in (
                BillingEntryType.subscription_seats_increase,
                BillingEntryType.subscription_seats_decrease,
            )
        ]
        assert len(seat_entries) == 1
        entry = seat_entries[0]
        assert entry.direction == BillingEntryDirection.debit
        assert entry.amount == 37_50

    async def test_seat_change_percentage_discount(
        self,
        mocker: MockerFixture,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
        customer: Customer,
    ) -> None:
        mocker.patch.object(
            subscription_service, "_create_subscription_update_order", new=AsyncMock()
        )

        discount = await create_discount(
            save_fixture,
            type=DiscountType.percentage,
            basis_points=1000,  # 10%
            duration=DiscountDuration.forever,
            organization=organization,
        )

        # Fixed 100_00 + seat 50_00/seat, 2 → 4 seats. Percentage is unaffected
        # by the fixed fee (each amount discounted independently):
        #   old seat effective = 100_00 - 10_00 = 90_00
        #   new seat effective = 200_00 - 20_00 = 180_00
        #   delta = 90_00, prorated = 90_00 * 0.5 = 45_00
        product, subscription = await _create_fixed_and_seat_subscription(
            save_fixture,
            organization=organization,
            customer=customer,
            fixed_amount=100_00,
            price_per_seat=50_00,
            seats=2,
            discount=discount,
        )

        with freezegun.freeze_time(UPDATE_TIME):
            async with SubscriptionUpdateContext(
                session, subscription, subscription_service
            ) as ctx:
                updated = await subscription_service.update_seats(
                    session,
                    ctx,
                    subscription,
                    seats=4,
                    proration_behavior=SubscriptionProrationBehavior.prorate,
                )
            await session.flush()

            repository = BillingEntryRepository.from_session(session)
            entries = await repository.get_pending_by_subscription(updated.id)

        seat_entries = [
            e
            for e in entries
            if e.type
            in (
                BillingEntryType.subscription_seats_increase,
                BillingEntryType.subscription_seats_decrease,
            )
        ]
        assert len(seat_entries) == 1
        entry = seat_entries[0]
        assert entry.direction == BillingEntryDirection.debit
        assert entry.amount == 45_00


@pytest.mark.asyncio
class TestFixedSeatProrations:
    """Fixed base price composed with a seat-based price bills `F + S(n)`."""

    async def test_seat_change_prorates_only_seat_delta(
        self,
        session: AsyncSession,
        mocker: MockerFixture,
        save_fixture: SaveFixture,
        enqueue_benefits_grants_mock: MagicMock,
        organization: Organization,
        customer: Customer,
    ) -> None:
        # Customer has no payment method; mock the order-creation call that the
        # prorate path would otherwise drive on context exit.
        mocker.patch.object(
            subscription_service,
            "_create_subscription_update_order",
            new=AsyncMock(),
        )

        product = await create_product_fixed_and_seat(
            save_fixture,
            organization=organization,
            fixed_amount=99900,
            tiers=SONAR_SEAT_TIERS,
            seat_tier_type=SeatTierType.graduated,
        )
        fixed_price = next(p for p in product.prices if is_fixed_price(p))
        seat_price = next(p for p in product.prices if is_seat_price(p))

        with freezegun.freeze_time(datetime(2024, 1, 1, tzinfo=UTC)) as frozen_time:
            subscription = await create_subscription_with_seats(
                save_fixture,
                product=product,
                customer=customer,
                seats=100,
            )
            assert subscription.amount == (
                fixed_price.price_amount + seat_price.calculate_amount(100)
            )

            frozen_time.move_to(datetime(2024, 1, 16, tzinfo=UTC))

            async with SubscriptionUpdateContext(
                session, subscription, subscription_service
            ) as ctx:
                updated = await subscription_service.update_seats(
                    session,
                    ctx,
                    subscription,
                    seats=143,
                    proration_behavior=SubscriptionProrationBehavior.prorate,
                )
            await session.flush()

        # Sonar 143-seat case: $999 + (50×$0 + 50×$20 + 43×$17.50) = $2,751.50
        assert updated.seats == 143
        assert updated.amount == 275150
        assert updated.amount == (
            fixed_price.price_amount + seat_price.calculate_amount(143)
        )

        # Only the seat delta is prorated; the fixed fee gets no billing entry.
        billing_entry_repository = BillingEntryRepository.from_session(session)
        entries = await billing_entry_repository.get_pending_by_subscription(
            subscription.id
        )
        assert all(entry.product_price_id != fixed_price.id for entry in entries)
        seat_entries = [
            entry for entry in entries if entry.product_price_id == seat_price.id
        ]
        assert len(seat_entries) == 1
        assert seat_entries[0].direction == BillingEntryDirection.debit
        assert seat_entries[0].type == BillingEntryType.subscription_seats_increase

    @pytest.mark.parametrize("seats", [1, 10, 11])
    async def test_included_seats_composition(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
        customer: Customer,
        seats: int,
    ) -> None:
        product = await create_product_fixed_and_seat(
            save_fixture,
            organization=organization,
            fixed_amount=20000,
            tiers=INCLUDED_SEAT_TIERS,
            seat_tier_type=SeatTierType.graduated,
        )
        fixed_price = next(p for p in product.prices if is_fixed_price(p))
        seat_price = next(p for p in product.prices if is_seat_price(p))

        subscription = await create_subscription_with_seats(
            save_fixture,
            product=product,
            customer=customer,
            seats=seats,
        )

        # Seats within the included tier contribute nothing on top of the base.
        if seats <= 10:
            assert seat_price.calculate_amount(seats) == 0

        assert subscription.amount == (
            fixed_price.price_amount + seat_price.calculate_amount(seats)
        )
