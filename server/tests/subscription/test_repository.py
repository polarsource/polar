from datetime import timedelta
from decimal import Decimal

import pytest

from polar.enums import SubscriptionRecurringInterval
from polar.kit.utils import utc_now
from polar.models import Customer, Meter, Organization
from polar.models.customer_seat import SeatStatus
from polar.postgres import AsyncSession
from polar.subscription.repository import SubscriptionProductPriceRepository
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import (
    create_active_subscription,
    create_customer,
    create_customer_seat,
    create_product,
)


@pytest.mark.asyncio
class TestSubscriptionProductPriceRepository:
    async def test_get_by_customers_and_meter_direct_subscription(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        customer: Customer,
        meter: Meter,
        organization: Organization,
    ) -> None:
        product = await create_product(
            save_fixture,
            organization=organization,
            recurring_interval=SubscriptionRecurringInterval.month,
            prices=[(meter, Decimal(100), None, "usd")],
        )
        later_subscription = await create_active_subscription(
            save_fixture,
            product=product,
            customer=customer,
            started_at=utc_now(),
        )
        earlier_subscription = await create_active_subscription(
            save_fixture,
            product=product,
            customer=customer,
            started_at=utc_now() - timedelta(days=1),
        )

        repository = SubscriptionProductPriceRepository.from_session(session)
        result = await repository.get_by_customers_and_meter([customer.id], meter.id)

        customer_price = result[customer.id]
        assert customer_price is not None
        assert customer_price.customer_id == customer.id
        assert (
            customer_price.subscription_product_price.subscription_id
            == earlier_subscription.id
        )
        assert (
            customer_price.subscription_product_price.subscription_id
            != later_subscription.id
        )

    async def test_get_by_customers_and_meter_seat_subscription(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        meter: Meter,
        organization: Organization,
    ) -> None:
        billing_manager = await create_customer(
            save_fixture,
            organization=organization,
            email="billing-manager@example.com",
        )
        seat_holder = await create_customer(
            save_fixture,
            organization=organization,
            email="seat-holder@example.com",
        )
        product = await create_product(
            save_fixture,
            organization=organization,
            recurring_interval=SubscriptionRecurringInterval.month,
            prices=[(meter, Decimal(100), None, "usd")],
        )
        subscription = await create_active_subscription(
            save_fixture, product=product, customer=billing_manager
        )
        await create_customer_seat(
            save_fixture,
            subscription=subscription,
            customer=seat_holder,
            status=SeatStatus.claimed,
        )
        subscription_id = subscription.id
        session.expunge_all()

        repository = SubscriptionProductPriceRepository.from_session(session)
        result = await repository.get_by_customers_and_meter([seat_holder.id], meter.id)

        customer_price = result[seat_holder.id]
        assert customer_price is not None
        assert customer_price.customer_id == billing_manager.id
        assert (
            customer_price.subscription_product_price.subscription_id == subscription_id
        )
        assert (
            customer_price.subscription_product_price.subscription.id == subscription_id
        )

    async def test_get_by_customers_and_meter_no_subscription(
        self,
        session: AsyncSession,
        customer: Customer,
        meter: Meter,
    ) -> None:
        repository = SubscriptionProductPriceRepository.from_session(session)

        result = await repository.get_by_customers_and_meter([customer.id], meter.id)

        assert result == {customer.id: None}

    async def test_get_by_customers_and_meter_mixed_batch(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        meter: Meter,
        organization: Organization,
    ) -> None:
        direct_customer = await create_customer(
            save_fixture,
            organization=organization,
            email="direct@example.com",
        )
        seat_holder = await create_customer(
            save_fixture,
            organization=organization,
            email="seat-holder@example.com",
        )
        customer_without_subscription = await create_customer(
            save_fixture,
            organization=organization,
            email="none@example.com",
        )
        billing_manager = await create_customer(
            save_fixture,
            organization=organization,
            email="billing-manager@example.com",
        )
        product = await create_product(
            save_fixture,
            organization=organization,
            recurring_interval=SubscriptionRecurringInterval.month,
            prices=[(meter, Decimal(100), None, "usd")],
        )
        direct_subscription = await create_active_subscription(
            save_fixture, product=product, customer=direct_customer
        )
        seat_subscription = await create_active_subscription(
            save_fixture, product=product, customer=billing_manager
        )
        await create_customer_seat(
            save_fixture,
            subscription=seat_subscription,
            customer=seat_holder,
            status=SeatStatus.claimed,
        )
        await create_customer_seat(
            save_fixture,
            subscription=seat_subscription,
            customer=direct_customer,
            status=SeatStatus.claimed,
        )

        repository = SubscriptionProductPriceRepository.from_session(session)
        result = await repository.get_by_customers_and_meter(
            [
                direct_customer.id,
                seat_holder.id,
                customer_without_subscription.id,
            ],
            meter.id,
        )

        direct_customer_price = result[direct_customer.id]
        assert direct_customer_price is not None
        assert (
            direct_customer_price.subscription_product_price.subscription_id
            == direct_subscription.id
        )
        seat_holder_price = result[seat_holder.id]
        assert seat_holder_price is not None
        assert seat_holder_price.customer_id == billing_manager.id
        assert (
            seat_holder_price.subscription_product_price.subscription_id
            == seat_subscription.id
        )
        assert result[customer_without_subscription.id] is None
