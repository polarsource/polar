from datetime import UTC, datetime

import freezegun
import pytest
import pytest_asyncio
from dateutil.relativedelta import relativedelta

from polar.billing_entry.repository import BillingEntryRepository
from polar.enums import SubscriptionRecurringInterval
from polar.event.repository import EventRepository
from polar.event.system import SystemEvent
from polar.models import (
    Customer,
    Organization,
    Product,
)
from polar.models.billing_entry import BillingEntryDirection
from polar.postgres import AsyncSession
from polar.product.guard import (
    is_fixed_price,
)
from polar.subscription.service import subscription as subscription_service
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import (
    create_active_subscription,
    create_product,
)

# This tests Subscription updates with prorations, where the subscription is
# not a subscription in Stripe.
#
# - ✅ Tests normal upgrade/downgrade
# - ✅ Tests switch from monthly to yearly
# - Tests switch from yearly to monthly
# - Tests switch from a subscription where a discount is applied
#    - Once
#    - For 3 months
#    - In perpetuity
# - Tests a customer with multiple subscriptions
# - Tests both "invoice immediately" and "prorations on next invoice" options
#   - through the setting on the organization
#   - through specific parameter in the API (overrides org setting)
# ? Tests that benefits are granted ? (maybe this should just be covered in `test_service.py`)
# ? Tests meters ?
# ? Tests free and "choose your own price" ?
# ? Tests a canceled subscription ?
# ? Tests tax ?
#
# All of these tests are checked both with the organisation having
# chosen to invoice immediately, or add prorations to the next invoice.


SUBSCRIPTION_START = datetime(2025, 6, 1, tzinfo=UTC)


@pytest_asyncio.fixture
async def basic_monthly(
    save_fixture: SaveFixture,
    organization: Organization,
) -> Product:
    return await create_product(
        save_fixture,
        organization=organization,
        recurring_interval=SubscriptionRecurringInterval.month,
        prices=[(10000,)],
    )


@pytest_asyncio.fixture
async def basic_yearly(
    save_fixture: SaveFixture,
    organization: Organization,
) -> Product:
    return await create_product(
        save_fixture,
        organization=organization,
        recurring_interval=SubscriptionRecurringInterval.year,
        prices=[(100000,)],
    )


@pytest_asyncio.fixture
async def pro_monthly(
    save_fixture: SaveFixture,
    organization: Organization,
) -> Product:
    return await create_product(
        save_fixture,
        organization=organization,
        recurring_interval=SubscriptionRecurringInterval.month,
        prices=[(30000,)],
    )


@pytest_asyncio.fixture
async def pro_yearly(
    save_fixture: SaveFixture,
    organization: Organization,
) -> Product:
    return await create_product(
        save_fixture,
        organization=organization,
        recurring_interval=SubscriptionRecurringInterval.year,
        prices=[(300000,)],
    )


@pytest.mark.asyncio
class TestUpdateProductProrations:
    @pytest.mark.parametrize(
        "cycle_start,time_of_update,entry_0_amount,entry_1_amount",
        [
            pytest.param(
                # - Start subscription on June 1st (June has 30 days)
                # - Update subscription at the end of June 15th (== start of 16th)
                # = 50% of price on both entries
                datetime(2025, 6, 1, tzinfo=UTC),
                datetime(2025, 6, 16, tzinfo=UTC),
                5000,
                15000,
                id="middle-of-month",
            ),
            pytest.param(
                # - Start subscription on June 1st (June has 30 days)
                # - Update subscription at the end of June 10th (== start of 11th)
                # = 66.67% of price on both entries
                datetime(2025, 6, 1, tzinfo=UTC),
                datetime(2025, 6, 11, tzinfo=UTC),
                6667,
                20000,
                id="third-of-month",
            ),
            pytest.param(
                # - Start subscription on February 18st 2024 (leap year, 29 days)
                # - Update subscription at the end of February 25th
                # = (29 - 7) / 29 = 0.7586206897% of price on both entries
                datetime(2024, 2, 18, tzinfo=UTC),
                datetime(2024, 2, 25, tzinfo=UTC),
                7586,
                22759,
                id="february-leap-year",
            ),
        ],
    )
    async def test_upgrade_basic_pro_monthly(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
        basic_monthly: Product,
        basic_yearly: Product,
        pro_monthly: Product,
        pro_yearly: Product,
        customer: Customer,
        cycle_start: datetime,
        time_of_update: datetime,
        entry_0_amount: int,
        entry_1_amount: int,
    ) -> None:
        with freezegun.freeze_time(cycle_start) as frozen_time:
            # We're not using Stripe
            assert organization.subscriptions_billing_engine is True

            subscription = await create_active_subscription(
                save_fixture,
                product=basic_monthly,
                customer=customer,
                stripe_subscription_id=None,
            )

            previous_current_period_start = subscription.current_period_start
            previous_current_period_end = subscription.current_period_end

            frozen_time.move_to(time_of_update)

            # Actually update subscription
            updated_subscription = await subscription_service.update_product(
                session, subscription, product_id=pro_monthly.id
            )

            assert updated_subscription.ended_at is None
            assert (
                updated_subscription.current_period_start
                == previous_current_period_start
            )
            assert (
                updated_subscription.current_period_end == previous_current_period_end
            )

            event_repository = EventRepository.from_session(session)
            events = await event_repository.get_all_by_name(
                SystemEvent.subscription_plan_changed
            )
            assert len(events) == 1
            event = events[0]
            assert event.user_metadata["subscription_id"] == str(subscription.id)
            assert event.customer_id == customer.id
            assert event.organization_id == customer.organization_id

            old_price = basic_monthly.prices[0]
            new_price = pro_monthly.prices[0]
            assert is_fixed_price(old_price)
            assert is_fixed_price(new_price)
            billing_entry_repository = BillingEntryRepository.from_session(session)
            billing_entries = (
                await billing_entry_repository.get_pending_by_subscription(
                    subscription.id
                )
            )
            assert len(billing_entries) == 2

            billing_entries = sorted(billing_entries, key=lambda e: e.start_timestamp)

            # fmt: off
            assert billing_entries[0].start_timestamp == updated_subscription.current_period_start
            assert billing_entries[0].end_timestamp == time_of_update
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
            assert billing_entries[1].event_id == event.id
            assert billing_entries[1].amount == entry_1_amount
            assert billing_entries[1].currency == new_price.price_currency
            # fmt: on

    @pytest.mark.parametrize(
        "cycle_start,time_of_update,entry_0_amount,entry_1_amount",
        [
            pytest.param(
                # - Start subscription on June 1st (June has 30 days)
                # - Update subscription at the end of June 15th (== start of 16th)
                # = 50% of price on monthly
                # and (365 - 15) / 365 = 95.89041096% of price on yearly
                datetime(2025, 6, 1, tzinfo=UTC),
                datetime(2025, 6, 16, tzinfo=UTC),
                5000,
                95890,
                id="middle-of-month",
            ),
            pytest.param(
                # - Start subscription on June 1st (June has 30 days)
                # - Update subscription at the end of June 10th (== start of 11th)
                # = 66.67% of price on monthly
                # and (365 - 10) / 365 = 97.26027397% of price on yearly
                datetime(2025, 6, 1, tzinfo=UTC),
                datetime(2025, 6, 11, tzinfo=UTC),
                6667,
                97260,
                id="third-of-month",
            ),
            pytest.param(
                # - Start subscription on February 18st 2024 (leap year, 29 days)
                # - Update subscription at the end of February 25th
                # = (29 - 7) / 29 = 75.86206897% of price on monthly
                # = (366 - 7) / 366 = 98.08743169% of price on yearly
                datetime(2024, 2, 18, tzinfo=UTC),
                datetime(2024, 2, 25, tzinfo=UTC),
                7586,
                98087,
                id="february-leap-year",
            ),
        ],
    )
    async def test_upgrade_basic_monthly_to_yearly(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
        basic_monthly: Product,
        basic_yearly: Product,
        pro_monthly: Product,
        pro_yearly: Product,
        customer: Customer,
        cycle_start: datetime,
        time_of_update: datetime,
        entry_0_amount: int,
        entry_1_amount: int,
    ) -> None:
        with freezegun.freeze_time(cycle_start) as frozen_time:
            # We're not using Stripe
            assert organization.subscriptions_billing_engine is True

            subscription = await create_active_subscription(
                save_fixture,
                product=basic_monthly,
                customer=customer,
                stripe_subscription_id=None,
            )

            previous_period_start = subscription.current_period_start
            previous_period_end = subscription.current_period_end

            frozen_time.move_to(time_of_update)

            # Actually update subscription
            updated_subscription = await subscription_service.update_product(
                session, subscription, product_id=basic_yearly.id
            )

            assert updated_subscription.ended_at is None
            assert updated_subscription.current_period_start == previous_period_start
            assert (
                updated_subscription.current_period_end
                == previous_period_start + relativedelta(years=1)
            )

            event_repository = EventRepository.from_session(session)
            events = await event_repository.get_all_by_name(
                SystemEvent.subscription_plan_changed
            )
            assert len(events) == 1
            event = events[0]
            assert event.user_metadata["subscription_id"] == str(subscription.id)
            assert event.customer_id == customer.id
            assert event.organization_id == customer.organization_id

            old_price = basic_monthly.prices[0]
            new_price = basic_yearly.prices[0]
            assert is_fixed_price(old_price)
            assert is_fixed_price(new_price)
            billing_entry_repository = BillingEntryRepository.from_session(session)
            billing_entries = (
                await billing_entry_repository.get_pending_by_subscription(
                    subscription.id
                )
            )
            assert len(billing_entries) == 2

            billing_entries = sorted(billing_entries, key=lambda e: e.start_timestamp)

            # fmt: off
            assert billing_entries[0].start_timestamp == updated_subscription.current_period_start
            assert billing_entries[0].end_timestamp == time_of_update
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
            assert billing_entries[1].event_id == event.id
            assert billing_entries[1].amount == entry_1_amount
            assert billing_entries[1].currency == new_price.price_currency
            # fmt: on

    @pytest.mark.parametrize(
        "cycle_start,time_of_update,entry_0_amount,entry_1_amount",
        [
            pytest.param(
                # - Start subscription on August 1st
                # - Update subscription on October 1st
                # (365 - (30 + 31)) / 365 = 83.28767123% of price on both entries
                datetime(2024, 8, 1, tzinfo=UTC),
                datetime(2024, 10, 1, tzinfo=UTC),
                83288,
                249863,
                id="two-months",
            ),
            pytest.param(
                # - Start subscription on February 18st 2024 (leap year, 366 days)
                # - Update subscription on September 5th (200 days past Feb 18th)
                # = (366 - 200) / 366 = 45.36% of price on both entries
                datetime(2024, 2, 18, tzinfo=UTC),
                datetime(2024, 9, 5, tzinfo=UTC),
                45355,
                136066,
                id="february-leap-year",
            ),
            pytest.param(
                # - Start subscription on February 18st 2023 (non-leap year, 365 days)
                # - Update subscription on September 5th (199 days past Feb 18th)
                # = (365 - 199) / 365 = 45.48% of price on both entries
                datetime(2023, 2, 18, tzinfo=UTC),
                datetime(2023, 9, 5, tzinfo=UTC),
                45479,
                136438,
                id="february-non-leap-year",
            ),
        ],
    )
    async def test_upgrade_basic_to_pro_yearly(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
        basic_monthly: Product,
        basic_yearly: Product,
        pro_monthly: Product,
        pro_yearly: Product,
        customer: Customer,
        cycle_start: datetime,
        time_of_update: datetime,
        entry_0_amount: int,
        entry_1_amount: int,
    ) -> None:
        with freezegun.freeze_time(cycle_start) as frozen_time:
            # We're not using Stripe
            assert organization.subscriptions_billing_engine is True

            subscription = await create_active_subscription(
                save_fixture,
                product=basic_yearly,
                customer=customer,
                stripe_subscription_id=None,
            )

            previous_period_start = subscription.current_period_start
            previous_period_end = subscription.current_period_end

            frozen_time.move_to(time_of_update)

            # Actually update subscription
            updated_subscription = await subscription_service.update_product(
                session, subscription, product_id=pro_yearly.id
            )

            assert updated_subscription.ended_at is None
            assert updated_subscription.current_period_start == previous_period_start
            assert (
                updated_subscription.current_period_end
                == previous_period_start + relativedelta(years=1)
            )

            event_repository = EventRepository.from_session(session)
            events = await event_repository.get_all_by_name(
                SystemEvent.subscription_plan_changed
            )
            assert len(events) == 1
            event = events[0]
            assert event.user_metadata["subscription_id"] == str(subscription.id)
            assert event.customer_id == customer.id
            assert event.organization_id == customer.organization_id

            old_price = basic_yearly.prices[0]
            new_price = pro_yearly.prices[0]
            assert is_fixed_price(old_price)
            assert is_fixed_price(new_price)
            billing_entry_repository = BillingEntryRepository.from_session(session)
            billing_entries = (
                await billing_entry_repository.get_pending_by_subscription(
                    subscription.id
                )
            )
            assert len(billing_entries) == 2

            billing_entries = sorted(billing_entries, key=lambda e: e.start_timestamp)

            # fmt: off
            assert billing_entries[0].start_timestamp == updated_subscription.current_period_start
            assert billing_entries[0].end_timestamp == time_of_update
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
            assert billing_entries[1].event_id == event.id
            assert billing_entries[1].amount == entry_1_amount
            assert billing_entries[1].currency == new_price.price_currency
            # fmt: on
