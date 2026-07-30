from datetime import timedelta

import pytest

from polar.kit.address import Address, CountryAlpha2
from polar.kit.utils import utc_now
from polar.models import Customer, Organization, Product
from polar.order.repository import OrderRepository
from polar.postgres import AsyncSession
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import create_customer, create_order

# The three aggregation methods share the "kept net revenue" formula:
#     net_amount + applied_balance_amount - refunded_amount
# `applied_balance_amount` is negative when wallet credit is consumed, so
# adding it reduces reported revenue to the money actually collected — matching
# `Order.refundable_amount` and the Tinybird metrics layer.


@pytest.mark.asyncio
class TestGetRevenueByCustomer:
    async def test_wallet_credit_reduces_revenue(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        organization: Organization,
        product: Product,
        customer: Customer,
    ) -> None:
        # Two customers with identical $100 orders, but one applied $30 of
        # wallet credit. The credit-using customer must rank lower and report
        # only $70 of kept revenue.
        credit_customer = await create_customer(
            save_fixture,
            organization=organization,
            email="credit@example.com",
        )
        cash_customer = await create_customer(
            save_fixture,
            organization=organization,
            email="cash@example.com",
        )
        await create_order(
            save_fixture,
            customer=credit_customer,
            product=product,
            subtotal_amount=100_00,
            applied_balance_amount=-30_00,
        )
        await create_order(
            save_fixture,
            customer=cash_customer,
            product=product,
            subtotal_amount=100_00,
        )

        repository = OrderRepository.from_session(session)
        ranked = await repository.get_revenue_by_customer(organization.id)

        assert len(ranked) == 2
        # Ranked descending by net revenue: cash ($100) before credit ($70).
        _, top_email, _, top_orders, top_revenue = ranked[0]
        _, second_email, _, second_orders, second_revenue = ranked[1]

        assert top_email == "cash@example.com"
        assert top_revenue == 100_00
        assert top_orders == 1

        assert second_email == "credit@example.com"
        assert second_revenue == 70_00
        assert second_orders == 1


@pytest.mark.asyncio
class TestGetPaidRevenueByCountry:
    async def test_wallet_credit_reduces_country_revenue(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        organization: Organization,
        product: Product,
        customer: Customer,
    ) -> None:
        # Same country, two orders: one full $100 charge, one $100 charge with
        # $30 wallet credit applied. Kept revenue for the country is $170.
        await create_order(
            save_fixture,
            customer=customer,
            product=product,
            subtotal_amount=100_00,
            billing_address=Address(country=CountryAlpha2("FR")),
        )
        await create_order(
            save_fixture,
            customer=customer,
            product=product,
            subtotal_amount=100_00,
            applied_balance_amount=-30_00,
            billing_address=Address(country=CountryAlpha2("FR")),
        )

        repository = OrderRepository.from_session(session)
        ranked = await repository.get_paid_revenue_by_country(
            organization.id, since=utc_now() - timedelta(days=1)
        )

        assert len(ranked) == 1
        country, orders, revenue = ranked[0]
        assert country == "FR"
        assert orders == 2
        assert revenue == 170_00


@pytest.mark.asyncio
class TestGetTopProductIdsByRevenue:
    async def test_wallet_credit_changes_product_ranking(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        organization: Organization,
        product: Product,
        product_second: Product,
        customer: Customer,
    ) -> None:
        # Both products have a single $100 gross order. `product` has $30 of
        # wallet credit applied (kept $70); `product_second` is all cash
        # (kept $100). Without accounting for credit both tie at $100; with
        # the fix `product_second` must rank first.
        await create_order(
            save_fixture,
            customer=customer,
            product=product,
            subtotal_amount=100_00,
            applied_balance_amount=-30_00,
        )
        await create_order(
            save_fixture,
            customer=customer,
            product=product_second,
            subtotal_amount=100_00,
        )

        repository = OrderRepository.from_session(session)
        ranked_ids = await repository.get_top_product_ids_by_revenue(organization.id)

        assert ranked_ids[0] == product_second.id
        assert ranked_ids[1] == product.id
