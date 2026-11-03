from datetime import UTC, datetime

import pytest

from polar.billing_interval.repository import BillingIntervalRepository
from polar.models import BillingInterval, Customer, Meter, Product, Subscription
from polar.models.billing_interval import UsagePolicy
from polar.postgres import AsyncSession
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import create_active_subscription

START = datetime(2026, 1, 1, tzinfo=UTC)
CHANGE = datetime(2026, 2, 1, tzinfo=UTC)
END = datetime(2026, 3, 1, tzinfo=UTC)


async def create_interval(
    save_fixture: SaveFixture,
    subscription: Subscription,
    meter: Meter,
    product: Product,
    *,
    period_start: datetime,
    period_end: datetime | None,
) -> BillingInterval:
    interval = BillingInterval(
        organization_id=subscription.organization_id,
        subscription=subscription,
        customer_id=subscription.customer_id,
        meter_id=meter.id,
        product_price_id=product.prices[0].id,
        period_start=period_start,
        period_end=period_end,
        usage_policy=UsagePolicy.charge,
    )
    await save_fixture(interval)
    return interval


@pytest.mark.anyio
class TestGetByCustomerAndMeter:
    async def test_returns_the_customers_intervals_starting_by_until(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        product_recurring_metered: Product,
        meter: Meter,
        customer: Customer,
        customer_second: Customer,
    ) -> None:
        subscription = await create_active_subscription(
            save_fixture, product=product_recurring_metered, customer=customer
        )
        other_subscription = await create_active_subscription(
            save_fixture, product=product_recurring_metered, customer=customer_second
        )
        first = await create_interval(
            save_fixture,
            subscription,
            meter,
            product_recurring_metered,
            period_start=START,
            period_end=CHANGE,
        )
        second = await create_interval(
            save_fixture,
            subscription,
            meter,
            product_recurring_metered,
            period_start=CHANGE,
            period_end=END,
        )
        await create_interval(
            save_fixture,
            subscription,
            meter,
            product_recurring_metered,
            period_start=END,
            period_end=None,
        )
        await create_interval(
            save_fixture,
            other_subscription,
            meter,
            product_recurring_metered,
            period_start=START,
            period_end=None,
        )

        repository = BillingIntervalRepository.from_session(session)
        intervals = await repository.get_by_customer_and_meter(
            customer, meter.id, until=CHANGE
        )

        assert {interval.id for interval in intervals} == {first.id, second.id}
