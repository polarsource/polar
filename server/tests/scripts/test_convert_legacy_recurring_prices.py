from datetime import timedelta

import pytest
from sqlalchemy import select

from polar.enums import SubscriptionRecurringInterval
from polar.kit.db.postgres import AsyncSession
from polar.kit.utils import utc_now
from polar.models import Customer, Organization, Product, ProductPrice, Subscription
from polar.models.checkout import CheckoutStatus
from polar.models.product_price import ProductPriceAmountType, ProductPriceType
from scripts.convert_legacy_recurring_prices import (
    Scope,
    archive_prices_statement,
    clear_prices_statement,
    convert_products_statement,
    plan_statement,
    planned_archive_count_statement,
    planned_clear_count_statement,
)
from scripts.helper import run_batched_update
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import (
    create_active_subscription,
    create_checkout,
    create_legacy_recurring_product_price,
    create_product,
)

month = SubscriptionRecurringInterval.month
year = SubscriptionRecurringInterval.year


async def _legacy_product(
    save_fixture: SaveFixture, organization: Organization
) -> tuple[Product, ProductPrice, ProductPrice]:
    product = await create_product(
        save_fixture, organization=organization, recurring_interval=None, prices=[]
    )
    month_price = await create_legacy_recurring_product_price(
        save_fixture,
        amount_type=ProductPriceAmountType.fixed,
        product=product,
        recurring_interval=month,
        amount=1000,
    )
    year_price = await create_legacy_recurring_product_price(
        save_fixture,
        amount_type=ProductPriceAmountType.fixed,
        product=product,
        recurring_interval=year,
        amount=10000,
    )
    product.prices.extend([month_price, year_price])
    product.all_prices.extend([month_price, year_price])
    await save_fixture(product)
    return product, month_price, year_price


async def _subscribe(
    save_fixture: SaveFixture,
    product: Product,
    price: ProductPrice,
    customer: Customer,
    interval: SubscriptionRecurringInterval,
) -> Subscription:
    subscription = await create_active_subscription(
        save_fixture, product=product, prices=[price], customer=customer
    )
    subscription.recurring_interval = interval
    await save_fixture(subscription)
    return subscription


async def _convert(session: AsyncSession, scope: Scope) -> None:
    for statement in (
        convert_products_statement(scope),
        archive_prices_statement(scope),
        clear_prices_statement(scope),
    ):
        await run_batched_update(statement, session=session, sleep_seconds=0)


async def _product_interval(
    session: AsyncSession, product: Product
) -> tuple[str | None, int | None]:
    row = (
        await session.execute(
            select(Product.recurring_interval, Product.recurring_interval_count).where(
                Product.id == product.id
            )
        )
    ).one()
    return row.recurring_interval, row.recurring_interval_count


async def _price_state(
    session: AsyncSession, price: ProductPrice
) -> tuple[str | None, str | None, bool]:
    row = (
        await session.execute(
            select(
                ProductPrice.type,
                ProductPrice.recurring_interval,
                ProductPrice.is_archived,
            ).where(ProductPrice.id == price.id)
        )
    ).one()
    return row.type, row.recurring_interval, row.is_archived


@pytest.mark.anyio
class TestConvert:
    async def test_keeps_interval_of_live_subscriptions(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
        customer: Customer,
    ) -> None:
        product, month_price, year_price = await _legacy_product(
            save_fixture, organization
        )
        subscription = await _subscribe(
            save_fixture, product, year_price, customer, year
        )
        scope = Scope()

        plan = (await session.execute(plan_statement(scope))).all()
        assert [(row.id, row.interval) for row in plan] == [(product.id, year)]
        assert (
            await session.execute(planned_archive_count_statement(scope))
        ).scalar_one() == 1
        assert (
            await session.execute(planned_clear_count_statement(scope))
        ).scalar_one() == 2

        await _convert(session, scope)

        assert await _product_interval(session, product) == (year, 1)
        assert await _price_state(session, month_price) == (None, None, True)
        assert await _price_state(session, year_price) == (None, None, False)
        refreshed = (
            await session.execute(
                select(Subscription.recurring_interval).where(
                    Subscription.id == subscription.id
                )
            )
        ).scalar_one()
        assert refreshed == year

    async def test_falls_back_to_month(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
    ) -> None:
        product, month_price, year_price = await _legacy_product(
            save_fixture, organization
        )

        await _convert(session, Scope())

        assert await _product_interval(session, product) == (month, 1)
        assert await _price_state(session, month_price) == (None, None, False)
        assert await _price_state(session, year_price) == (None, None, True)

    async def test_skips_live_subscriptions_on_both_intervals(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
        customer: Customer,
        customer_second: Customer,
    ) -> None:
        product, month_price, year_price = await _legacy_product(
            save_fixture, organization
        )
        await _subscribe(save_fixture, product, month_price, customer, month)
        await _subscribe(save_fixture, product, year_price, customer_second, year)

        await _convert(session, Scope())

        assert await _product_interval(session, product) == (None, None)
        assert await _price_state(session, year_price) == (
            ProductPriceType.recurring,
            year,
            False,
        )

        await _convert(session, Scope(product_id=product.id, interval=year))

        assert await _product_interval(session, product) == (year, 1)
        assert await _price_state(session, month_price) == (None, None, True)
        assert await _price_state(session, year_price) == (None, None, False)

    async def test_skips_sold_within_the_year(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
    ) -> None:
        product, month_price, year_price = await _legacy_product(
            save_fixture, organization
        )
        await create_checkout(
            save_fixture,
            products=[product],
            price=year_price,
            status=CheckoutStatus.succeeded,
        )

        await _convert(session, Scope())

        assert await _product_interval(session, product) == (None, None)

        await _convert(session, Scope(product_id=product.id))

        assert await _product_interval(session, product) == (year, 1)
        assert await _price_state(session, month_price) == (None, None, True)

    async def test_skips_confirmed_checkout(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
    ) -> None:
        product, _, year_price = await _legacy_product(save_fixture, organization)
        await create_checkout(
            save_fixture,
            products=[product],
            price=year_price,
            status=CheckoutStatus.confirmed,
        )

        await _convert(session, Scope())

        assert await _product_interval(session, product) == (None, None)
        assert await _price_state(session, year_price) == (
            ProductPriceType.recurring,
            year,
            False,
        )

    async def test_converts_despite_stale_confirmed_checkout(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
    ) -> None:
        product, _, year_price = await _legacy_product(save_fixture, organization)
        checkout = await create_checkout(
            save_fixture,
            products=[product],
            price=year_price,
            status=CheckoutStatus.confirmed,
        )
        checkout.created_at = utc_now() - timedelta(days=31)
        await save_fixture(checkout)

        await _convert(session, Scope())

        assert await _product_interval(session, product) == (month, 1)

    async def test_clears_one_time_legacy_price(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
    ) -> None:
        product = await create_product(
            save_fixture, organization=organization, recurring_interval=None
        )
        price = product.prices[0]
        price.type = ProductPriceType.one_time
        await save_fixture(price)

        await _convert(session, Scope())

        assert await _product_interval(session, product) == (None, None)
        assert await _price_state(session, price) == (None, None, False)

    async def test_counts_one_time_price_on_legacy_recurring_product(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
    ) -> None:
        product, _, _ = await _legacy_product(save_fixture, organization)
        one_time_price = await create_legacy_recurring_product_price(
            save_fixture,
            amount_type=ProductPriceAmountType.fixed,
            product=product,
            recurring_interval=month,
        )
        one_time_price.type = ProductPriceType.one_time
        await save_fixture(one_time_price)
        scope = Scope(product_id=product.id)

        assert (
            await session.execute(planned_clear_count_statement(scope))
        ).scalar_one() == 3

        await _convert(session, scope)

        assert await _price_state(session, one_time_price) == (None, None, False)
