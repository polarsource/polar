from decimal import Decimal

import pytest
import pytest_asyncio

from polar.billing_entry.service import billing_entry as billing_entry_service
from polar.enums import SubscriptionRecurringInterval
from polar.event.system import SystemEvent
from polar.meter.aggregation import AggregationFunction, PropertyAggregation
from polar.meter.filter import Filter, FilterConjunction
from polar.models import (
    BillingEntry,
    Customer,
    Meter,
    Order,
    OrderItem,
    Organization,
    Product,
    ProductPrice,
    Subscription,
)
from polar.models.billing_entry import BillingEntryDirection, BillingEntryType
from polar.models.event import EventSource
from polar.models.subscription_product_price import SubscriptionProductPrice
from polar.postgres import AsyncSession
from polar.product.guard import (
    StaticPrice,
    is_custom_price,
    is_fixed_price,
    is_free_price,
    is_metered_price,
)
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import (
    create_active_subscription,
    create_event,
    create_meter,
    create_order,
    create_product,
    create_product_price_metered_unit,
)


@pytest_asyncio.fixture
async def meter(save_fixture: SaveFixture, organization: Organization) -> Meter:
    return await create_meter(
        save_fixture,
        filter=Filter(conjunction=FilterConjunction.and_, clauses=[]),
        aggregation=PropertyAggregation(
            func=AggregationFunction.sum, property="tokens"
        ),
        organization=organization,
    )


@pytest_asyncio.fixture
async def product_metered_unit(
    save_fixture: SaveFixture, meter: Meter, organization: Organization
) -> Product:
    return await create_product(
        save_fixture,
        organization=organization,
        recurring_interval=SubscriptionRecurringInterval.month,
        prices=[(meter, Decimal(100), None)],
    )


@pytest_asyncio.fixture
async def metered_subscription(
    save_fixture: SaveFixture, customer: Customer, product_metered_unit: Product
) -> Subscription:
    return await create_active_subscription(
        save_fixture, customer=customer, product=product_metered_unit
    )


@pytest_asyncio.fixture
async def order(
    save_fixture: SaveFixture,
    customer: Customer,
    product_metered_unit: Product,
    metered_subscription: Subscription,
) -> Order:
    return await create_order(
        save_fixture,
        product=product_metered_unit,
        customer=customer,
        subscription=metered_subscription,
    )


async def create_metered_event_billing_entry(
    save_fixture: SaveFixture,
    *,
    customer: Customer,
    price: ProductPrice,
    subscription: Subscription,
    tokens: int,
    pending: bool = True,
    order: Order | None = None,
    metadata_key: str = "tokens",
) -> BillingEntry:
    event = await create_event(
        save_fixture,
        organization=customer.organization,
        customer=customer,
        metadata={metadata_key: tokens},
    )
    billing_entry = BillingEntry(
        start_timestamp=event.timestamp,
        end_timestamp=event.timestamp,
        type=BillingEntryType.metered,
        direction=BillingEntryDirection.debit,
        customer=customer,
        product_price=price,
        subscription=subscription,
        event=event,
    )
    if not pending:
        assert order is not None, "Order must be provided if not pending"
        order_item = OrderItem(
            label="",
            amount=100,
            tax_amount=0,
            product_price=price,
        )
        order.items.append(order_item)
        await save_fixture(order)
        billing_entry.order_item = order_item

    await save_fixture(billing_entry)
    return billing_entry


async def create_credit_billing_entry(
    save_fixture: SaveFixture,
    *,
    customer: Customer,
    price: ProductPrice,
    subscription: Subscription,
    units: int,
    meter: Meter,
    pending: bool = True,
    order: Order | None = None,
) -> BillingEntry:
    event = await create_event(
        save_fixture,
        organization=customer.organization,
        source=EventSource.system,
        name=SystemEvent.meter_credited,
        customer=customer,
        metadata={"meter_id": str(meter.id), "units": units},
    )
    billing_entry = BillingEntry(
        start_timestamp=event.timestamp,
        end_timestamp=event.timestamp,
        type=BillingEntryType.metered,
        direction=BillingEntryDirection.debit,
        customer=customer,
        product_price=price,
        subscription=subscription,
        event=event,
    )
    if not pending:
        assert order is not None, "Order must be provided if not pending"
        order_item = OrderItem(
            label="",
            amount=100,
            tax_amount=0,
            product_price=price,
        )
        order.items.append(order_item)
        await save_fixture(order)
        billing_entry.order_item = order_item

    await save_fixture(billing_entry)
    return billing_entry


async def create_static_price_billing_entry(
    save_fixture: SaveFixture,
    *,
    type: BillingEntryType = BillingEntryType.cycle,
    customer: Customer,
    price: StaticPrice,
    subscription: Subscription,
    pending: bool = True,
    order: Order | None = None,
) -> BillingEntry:
    amount = 0
    if is_fixed_price(price):
        amount = price.price_amount
    elif is_free_price(price):
        amount = 0
    elif is_custom_price(price):
        raise NotImplementedError()

    event = await create_event(
        save_fixture,
        source=EventSource.system,
        name=SystemEvent.subscription_cycled,
        organization=customer.organization,
        customer=customer,
        metadata={"subscription_id": str(subscription.id)},
    )
    billing_entry = BillingEntry(
        start_timestamp=subscription.current_period_start,
        end_timestamp=subscription.current_period_end,
        type=type,
        direction=BillingEntryDirection.debit,
        customer=customer,
        product_price=price,
        subscription=subscription,
        event=event,
        amount=amount,
        currency=subscription.currency,
    )
    if not pending:
        assert order is not None, "Order must be provided if not pending"
        order_item = OrderItem(
            label="",
            amount=amount,
            tax_amount=0,
            product_price=price,
        )
        order.items.append(order_item)
        await save_fixture(order)
        billing_entry.order_item = order_item

    await save_fixture(billing_entry)
    return billing_entry


@pytest.mark.asyncio
class TestCreateOrderItemsFromPending:
    async def test_one_metered_price(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        customer: Customer,
        meter: Meter,
        product_metered_unit: Product,
        metered_subscription: Subscription,
        order: Order,
    ) -> None:
        price = product_metered_unit.prices[0]
        assert is_metered_price(price)
        entries = [
            await create_metered_event_billing_entry(
                save_fixture,
                customer=customer,
                price=price,
                subscription=metered_subscription,
                tokens=10,
                pending=False,
                order=order,
            ),
            await create_metered_event_billing_entry(
                save_fixture,
                customer=customer,
                price=price,
                subscription=metered_subscription,
                tokens=20,
            ),
            await create_metered_event_billing_entry(
                save_fixture,
                customer=customer,
                price=price,
                subscription=metered_subscription,
                tokens=30,
            ),
        ]

        async with billing_entry_service.create_order_items_from_pending(
            session, metered_subscription
        ) as order_items:
            assert len(order_items) == 1

            order_item = order_items[0]
            assert meter.name in order_item.label
            assert order_item.amount == 50_00

            order = await create_order(
                save_fixture,
                customer=customer,
                order_items=list(order_items),
            )

        for entry in entries[1:]:
            await session.refresh(entry)
            assert entry.order_item_id == order_item.id

    async def test_several_metered_prices(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        customer: Customer,
        meter: Meter,
        product_metered_unit: Product,
        metered_subscription: Subscription,
        order: Order,
    ) -> None:
        old_price = await create_product_price_metered_unit(
            save_fixture,
            product=product_metered_unit,
            meter=meter,
            unit_amount=Decimal(250),
        )
        current_price = product_metered_unit.prices[0]
        assert is_metered_price(current_price)

        entries = [
            await create_metered_event_billing_entry(
                save_fixture,
                customer=customer,
                price=old_price,
                subscription=metered_subscription,
                tokens=10,
            ),
            await create_metered_event_billing_entry(
                save_fixture,
                customer=customer,
                price=old_price,
                subscription=metered_subscription,
                tokens=20,
            ),
            await create_metered_event_billing_entry(
                save_fixture,
                customer=customer,
                price=current_price,
                subscription=metered_subscription,
                tokens=30,
            ),
            await create_metered_event_billing_entry(
                save_fixture,
                customer=customer,
                price=current_price,
                subscription=metered_subscription,
                tokens=40,
            ),
        ]

        async with billing_entry_service.create_order_items_from_pending(
            session, metered_subscription
        ) as order_items:
            assert len(order_items) == 2

            order_item_old_price = next(
                item for item in order_items if item.product_price == old_price
            )
            assert meter.name in order_item_old_price.label
            assert order_item_old_price.amount == 75_00

            order_item_current_price = next(
                item for item in order_items if item.product_price == current_price
            )
            assert meter.name in order_item_current_price.label
            assert order_item_current_price.amount == 70_00

            order = await create_order(
                save_fixture,
                customer=customer,
                order_items=list(order_items),
            )

        for entry in entries[:2]:
            await session.refresh(entry)
            assert entry.order_item_id == order_item_old_price.id

        for entry in entries[2:]:
            await session.refresh(entry)
            assert entry.order_item_id == order_item_current_price.id

    async def test_credit_events(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        customer: Customer,
        meter: Meter,
        product_metered_unit: Product,
        metered_subscription: Subscription,
        order: Order,
    ) -> None:
        price = product_metered_unit.prices[0]
        assert is_metered_price(price)
        entries = [
            await create_metered_event_billing_entry(
                save_fixture,
                customer=customer,
                price=price,
                subscription=metered_subscription,
                tokens=10,
                pending=False,
                order=order,
            ),
            await create_metered_event_billing_entry(
                save_fixture,
                customer=customer,
                price=price,
                subscription=metered_subscription,
                tokens=20,
            ),
            await create_metered_event_billing_entry(
                save_fixture,
                customer=customer,
                price=price,
                subscription=metered_subscription,
                tokens=30,
            ),
            await create_credit_billing_entry(
                save_fixture,
                customer=customer,
                price=price,
                subscription=metered_subscription,
                meter=meter,
                units=10,
            ),
        ]

        async with billing_entry_service.create_order_items_from_pending(
            session, metered_subscription
        ) as order_items:
            assert len(order_items) == 1

            order_item = order_items[0]
            assert meter.name in order_item.label
            assert order_item.amount == 40_00

            order = await create_order(
                save_fixture, customer=customer, order_items=list(order_items)
            )

        for entry in entries[1:]:
            await session.refresh(entry)
            assert entry.order_item_id == order_item.id

    async def test_static_price(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        customer: Customer,
        meter: Meter,
        product: Product,
        order: Order,
    ) -> None:
        subscription = await create_active_subscription(
            save_fixture, product=product, customer=customer
        )
        price = product.prices[0]
        assert is_fixed_price(price)

        entries = [
            await create_static_price_billing_entry(
                save_fixture,
                customer=customer,
                price=price,
                subscription=subscription,
                pending=False,
                order=order,
            ),
            await create_static_price_billing_entry(
                save_fixture,
                customer=customer,
                price=price,
                subscription=subscription,
                pending=True,
            ),
            await create_static_price_billing_entry(
                save_fixture,
                type=BillingEntryType.proration,
                customer=customer,
                price=price,
                subscription=subscription,
                pending=True,
            ),
        ]

        async with billing_entry_service.create_order_items_from_pending(
            session, subscription
        ) as order_items:
            assert len(order_items) == 2

            order_item_1 = order_items[0]
            assert product.name in order_item_1.label
            assert order_item_1.proration is False

            order_item_2 = order_items[1]
            assert product.name in order_item_2.label
            assert order_item_2.proration is True

            order = await create_order(
                save_fixture,
                customer=customer,
                order_items=list(order_items),
            )

        await session.refresh(entries[1])
        assert entries[1].order_item_id == order_item_1.id

        await session.refresh(entries[2])
        assert entries[2].order_item_id == order_item_2.id

    async def test_max_aggregation_across_product_prices(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        customer: Customer,
        organization: Organization,
    ) -> None:
        """
        Test that MAX aggregation computes correctly across multiple product prices
        for the same meter. The MAX should be computed across ALL events, not per-price.
        """
        # Create a meter with MAX aggregation
        meter_max = await create_meter(
            save_fixture,
            filter=Filter(conjunction=FilterConjunction.and_, clauses=[]),
            aggregation=PropertyAggregation(
                func=AggregationFunction.max, property="servers"
            ),
            organization=organization,
        )

        # Create initial product with metered price
        product_a = await create_product(
            save_fixture,
            organization=organization,
            recurring_interval=SubscriptionRecurringInterval.month,
            prices=[(meter_max, Decimal(10_00), None)],  # $10 per server
        )
        price_a = product_a.prices[0]

        subscription = await create_active_subscription(
            save_fixture, customer=customer, product=product_a
        )

        # Create events on price A: max is 3 servers
        entries = [
            await create_metered_event_billing_entry(
                save_fixture,
                customer=customer,
                price=price_a,
                subscription=subscription,
                tokens=1,
                metadata_key="servers",
            ),
            await create_metered_event_billing_entry(
                save_fixture,
                customer=customer,
                price=price_a,
                subscription=subscription,
                tokens=3,  # MAX here
                metadata_key="servers",
            ),
            await create_metered_event_billing_entry(
                save_fixture,
                customer=customer,
                price=price_a,
                subscription=subscription,
                tokens=2,
                metadata_key="servers",
            ),
        ]

        # Simulate product change: create new price for same meter but different product
        product_b = await create_product(
            save_fixture,
            organization=organization,
            recurring_interval=SubscriptionRecurringInterval.month,
            prices=[(meter_max, Decimal(15_00), None)],  # $15 per server
        )
        price_b = product_b.prices[0]

        subscription.subscription_product_prices = [
            SubscriptionProductPrice.from_price(price_b)
        ]
        await save_fixture(subscription)

        # Create events on price B: values are lower but shouldn't matter for MAX
        entries.extend(
            [
                await create_metered_event_billing_entry(
                    save_fixture,
                    customer=customer,
                    price=price_b,
                    subscription=subscription,
                    tokens=1,
                    metadata_key="servers",
                ),
                await create_metered_event_billing_entry(
                    save_fixture,
                    customer=customer,
                    price=price_b,
                    subscription=subscription,
                    tokens=2,
                    metadata_key="servers",
                ),
            ]
        )

        # When computing order items, MAX should be 3 (not 3 + 2 = 5)
        async with billing_entry_service.create_order_items_from_pending(
            session,
            subscription,
        ) as order_items:
            # Should create ONE line item (grouped by meter, not by price)
            assert len(order_items) == 1

            order_item = order_items[0]
            assert meter_max.name in order_item.label
            # MAX of all events is 3, billed at the most recent price ($15)
            assert order_item.amount == 45_00
            assert order_item.product_price == price_b  # Uses most recent price

            order = await create_order(
                save_fixture,
                customer=customer,
                order_items=list(order_items),
            )

        # All billing entries should be linked to this single order item
        for entry in entries:
            await session.refresh(entry)
            assert entry.order_item_id == order_item.id
