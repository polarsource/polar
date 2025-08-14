from datetime import UTC, datetime
from decimal import Decimal
from unittest.mock import MagicMock

import freezegun
import pytest
from dateutil.relativedelta import relativedelta
from pytest_mock import MockerFixture

from polar.billing_entry.repository import BillingEntryRepository
from polar.enums import SubscriptionProrationBehavior, SubscriptionRecurringInterval
from polar.event.repository import EventRepository
from polar.event.system import SystemEvent
from polar.models import (
    Customer,
    Meter,
    Organization,
)
from polar.models.billing_entry import BillingEntryDirection
from polar.models.order import OrderBillingReason
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
# - ✅ Tests subscriptions with meters
# - Tests switch from yearly to monthly
# - Tests switch from a subscription where a discount is applied
#    - Once
#    - For 3 months
#    - In perpetuity
# - Tests a customer with multiple subscriptions
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
def enqueue_job_mock(mocker: MockerFixture) -> MagicMock:
    return mocker.patch("polar.subscription.service.enqueue_job")


@pytest.mark.asyncio
class TestUpdateProductProrations:
    @pytest.mark.parametrize(
        "old_product_param,new_product_param,cycle_start,time_of_update,entry_0_amount,entry_1_amount",
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
                # = 50% of price on monthly
                # and (365 - 15) / 365 = 95.89041096% of price on yearly
                datetime(2025, 6, 1, tzinfo=UTC),
                datetime(2025, 6, 16, tzinfo=UTC),
                5000,
                95890,
                id="monthly-to-yearly-middle-of-month",
            ),
            pytest.param(
                (SubscriptionRecurringInterval.month, 10000),
                (SubscriptionRecurringInterval.year, 100000),
                # - Start subscription on June 1st (June has 30 days)
                # - Update subscription at the end of June 10th (== start of 11th)
                # = 66.67% of price on monthly
                # and (365 - 10) / 365 = 97.26027397% of price on yearly
                datetime(2025, 6, 1, tzinfo=UTC),
                datetime(2025, 6, 11, tzinfo=UTC),
                6667,
                97260,
                id="monthly-to-yearly-third-of-month",
            ),
            pytest.param(
                (SubscriptionRecurringInterval.month, 10000),
                (SubscriptionRecurringInterval.year, 100000),
                # - Start subscription on February 18st 2024 (leap year, 29 days)
                # - Update subscription at the end of February 25th
                # = (29 - 7) / 29 = 75.86206897% of price on monthly
                # = (366 - 7) / 366 = 98.08743169% of price on yearly
                datetime(2024, 2, 18, tzinfo=UTC),
                datetime(2024, 2, 25, tzinfo=UTC),
                7586,
                98087,
                id="monthly-to-yearly-february-leap-year",
            ),
        ],
    )
    async def test_upgrade_base_cases(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
        customer: Customer,
        old_product_param,
        new_product_param,
        cycle_start: datetime,
        time_of_update: datetime,
        entry_0_amount: int,
        entry_1_amount: int,
    ) -> None:
        old_product = await create_product(
            save_fixture,
            organization=organization,
            recurring_interval=old_product_param[0],
            prices=[(old_product_param[1],)],
        )
        new_product = await create_product(
            save_fixture,
            organization=organization,
            recurring_interval=new_product_param[0],
            prices=[(new_product_param[1],)],
        )

        with freezegun.freeze_time(cycle_start) as frozen_time:
            # We're not using Stripe
            assert organization.subscriptions_billing_engine is True

            subscription = await create_active_subscription(
                save_fixture,
                product=old_product,
                customer=customer,
                stripe_subscription_id=None,
            )

            previous_period_start = subscription.current_period_start
            previous_period_end = subscription.current_period_end

            frozen_time.move_to(time_of_update)

            # Actually update subscription
            updated_subscription = await subscription_service.update_product(
                session,
                subscription,
                product_id=new_product.id,
            )

            assert updated_subscription.ended_at is None
            assert updated_subscription.current_period_start == previous_period_start

            if old_product.recurring_interval == new_product.recurring_interval:
                assert updated_subscription.current_period_end == previous_period_end

            if new_product.recurring_interval == SubscriptionRecurringInterval.month:
                assert (
                    updated_subscription.current_period_end
                    == previous_period_start + relativedelta(months=1)
                )
            if new_product.recurring_interval == SubscriptionRecurringInterval.year:
                assert (
                    updated_subscription.current_period_end
                    == previous_period_start + relativedelta(years=1)
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
        save_fixture: SaveFixture,
        organization: Organization,
        enqueue_job_mock: MagicMock,
        customer: Customer,
        proration_behavior: tuple[
            SubscriptionProrationBehavior | None, SubscriptionProrationBehavior
        ],
    ) -> None:
        """Test that the `proration_behavior` passed as an arg to `update_product()`
        is used -- if it's `None` then we fall back to the organization setting.
        """
        cycle_start = datetime(2025, 6, 1, tzinfo=UTC)
        time_of_update = datetime(2025, 6, 16, tzinfo=UTC)
        old_product = await create_product(
            save_fixture,
            organization=organization,
            recurring_interval=SubscriptionRecurringInterval.month,
            prices=[(10000,)],
        )
        new_product = await create_product(
            save_fixture,
            organization=organization,
            recurring_interval=SubscriptionRecurringInterval.month,
            prices=[(30000,)],
        )

        call_proration, org_proration = proration_behavior
        expected_proration = call_proration or org_proration

        organization.subscription_settings["proration_behavior"] = org_proration
        session.add(organization)
        await session.flush()

        with freezegun.freeze_time(cycle_start) as frozen_time:
            # We're not using Stripe
            assert organization.subscriptions_billing_engine is True

            subscription = await create_active_subscription(
                save_fixture,
                product=old_product,
                customer=customer,
                stripe_subscription_id=None,
            )

            frozen_time.move_to(time_of_update)

            # Actually update subscription
            updated_subscription = await subscription_service.update_product(
                session,
                subscription,
                product_id=new_product.id,
                proration_behavior=call_proration,
            )

            # `enqueue_job` gets called a couple of times, only one of which
            # we care about. We do the following to extract only that "one" and
            # assert that it's just called once or never in the two cases.
            calls = [
                args[0]
                for args, kwargs in enqueue_job_mock.call_args_list
                if args[0] == "order.create_subscription_order"
            ]
            if expected_proration == SubscriptionProrationBehavior.invoice:
                enqueue_job_mock.assert_any_call(
                    "order.create_subscription_order",
                    subscription.id,
                    OrderBillingReason.subscription_update,
                )
                assert len(calls) == 1
            else:
                assert len(calls) == 0

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
            prices=[(meter, Decimal(50), None), (10000,)],
        )
        new_product = await create_product(
            save_fixture,
            organization=organization,
            recurring_interval=SubscriptionRecurringInterval.month,
            prices=[(meter, Decimal(50), None), (30000,)],
        )

        with freezegun.freeze_time(cycle_start) as frozen_time:
            subscription = await create_active_subscription(
                save_fixture,
                product=old_product,
                customer=customer,
                stripe_subscription_id=None,
            )
            assert len(subscription.meters) == 1
            subscription_meter = subscription.meters[0]
            assert subscription_meter.meter == meter
            assert subscription_meter.subscription == subscription

            previous_period_start = subscription.current_period_start
            previous_period_end = subscription.current_period_end

            frozen_time.move_to(time_of_update)

            updated_subscription = await subscription_service.update_product(
                session,
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

            billing_entries = sorted(billing_entries, key=lambda e: e.start_timestamp)

            # fmt: off
            assert billing_entries[0].start_timestamp == updated_subscription.current_period_start
            assert billing_entries[0].end_timestamp == time_of_update
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
