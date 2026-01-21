from datetime import UTC, datetime
from decimal import Decimal

import pytest
import pytest_asyncio

from polar.billing_entry.service import billing_entry as billing_entry_service
from polar.enums import SubscriptionRecurringInterval
from polar.event.service import event as event_service
from polar.event.system import SystemEvent
from polar.meter.aggregation import AggregationFunction, PropertyAggregation
from polar.meter.filter import Filter, FilterConjunction
from polar.models import (
    BillingEntry,
    Customer,
    Event,
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
        prices=[(meter, Decimal(100), None, "usd")],
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
    timestamp: datetime | None = None,
) -> BillingEntry:
    event = await create_event(
        save_fixture,
        organization=customer.organization,
        customer=customer,
        metadata={metadata_key: tokens},
        timestamp=timestamp,
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
        """
        Test that billing entries from multiple active prices are all billed.
        Both prices must be in subscription_product_prices to be billed.
        """
        old_price = await create_product_price_metered_unit(
            save_fixture,
            product=product_metered_unit,
            meter=meter,
            unit_amount=Decimal(250),
        )
        current_price = product_metered_unit.prices[0]
        assert is_metered_price(current_price)

        # Add old_price to the subscription's active prices
        # (simulating a subscription that has both prices active)
        metered_subscription.subscription_product_prices.append(
            SubscriptionProductPrice.from_price(old_price)
        )
        await save_fixture(metered_subscription)

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
            prices=[(meter_max, Decimal(10_00), None, "usd")],  # $10 per server
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
            prices=[(meter_max, Decimal(15_00), None, "usd")],  # $15 per server
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

    async def test_mid_cycle_product_switch_charges_both_prices(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        customer: Customer,
        organization: Organization,
    ) -> None:
        """
        When a customer switches products mid-billing-cycle, both prices should
        be charged: the old price for usage before the switch, and the new price
        for usage after the switch.

        Scenario:
        1. Customer subscribes to Product A with $1/unit metered pricing
        2. Customer uses 10 units (10 billing entries)
        3. Customer switches to Product B with $0.50/unit metered pricing (same meter)
        4. Customer uses 10 more units (10 billing entries)
        5. Expected: Invoice has 10 × $1 + 10 × $0.50 = $15

        This test verifies that usage before a subscription change is still
        charged at the rate that was active when the usage occurred.
        """
        # Create meter with SUM aggregation (summable)
        meter_sum = await create_meter(
            save_fixture,
            filter=Filter(conjunction=FilterConjunction.and_, clauses=[]),
            aggregation=PropertyAggregation(
                func=AggregationFunction.sum, property="tokens"
            ),
            organization=organization,
        )

        # Create Product A with $1/unit metered pricing
        product_a = await create_product(
            save_fixture,
            organization=organization,
            recurring_interval=SubscriptionRecurringInterval.month,
            prices=[(meter_sum, Decimal(100), None, "usd")],  # $1.00 per unit
        )
        price_a = product_a.prices[0]
        assert is_metered_price(price_a)

        # Create subscription on Product A
        subscription = await create_active_subscription(
            save_fixture, customer=customer, product=product_a
        )

        # Create 10 billing entries on price A (usage before switch)
        # Each entry represents 1 unit of usage
        old_entries = []
        for _ in range(10):
            entry = await create_metered_event_billing_entry(
                save_fixture,
                customer=customer,
                price=price_a,
                subscription=subscription,
                tokens=1,
            )
            old_entries.append(entry)

        # Create Product B with $0.50/unit metered pricing (same meter)
        product_b = await create_product(
            save_fixture,
            organization=organization,
            recurring_interval=SubscriptionRecurringInterval.month,
            prices=[(meter_sum, Decimal(50), None, "usd")],  # $0.50 per unit
        )
        price_b = product_b.prices[0]
        assert is_metered_price(price_b)

        # Switch subscription to Product B
        subscription.subscription_product_prices = [
            SubscriptionProductPrice.from_price(price_b)
        ]
        await save_fixture(subscription)

        # Create 10 billing entries on price B (usage after switch)
        new_entries = []
        for _ in range(10):
            entry = await create_metered_event_billing_entry(
                save_fixture,
                customer=customer,
                price=price_b,
                subscription=subscription,
                tokens=1,
            )
            new_entries.append(entry)

        # Compute order items - BOTH prices should be charged
        async with billing_entry_service.create_order_items_from_pending(
            session, subscription
        ) as order_items:
            # Should have 2 line items: one for price A, one for price B
            assert len(order_items) == 2

            order_item_a = next(
                (item for item in order_items if item.product_price == price_a), None
            )
            assert order_item_a is not None, (
                "Expected line item for price A (old price)"
            )
            assert order_item_a.amount == 10_00  # 10 units × $1.00 = $10.00

            order_item_b = next(
                (item for item in order_items if item.product_price == price_b), None
            )
            assert order_item_b is not None, (
                "Expected line item for price B (new price)"
            )
            assert order_item_b.amount == 5_00  # 10 units × $0.50 = $5.00

            order = await create_order(
                save_fixture,
                customer=customer,
                order_items=list(order_items),
            )

        # All old entries should be linked to order_item_a
        for entry in old_entries:
            await session.refresh(entry)
            assert entry.order_item_id == order_item_a.id

        # All new entries should be linked to order_item_b
        for entry in new_entries:
            await session.refresh(entry)
            assert entry.order_item_id == order_item_b.id

    async def test_mid_cycle_switch_to_product_without_meter(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        customer: Customer,
        organization: Organization,
    ) -> None:
        """
        When a customer switches to a product without a meter for certain usage,
        usage before the switch should still be charged at the old price.

        Scenario:
        1. Customer subscribes to Product A with $1/unit metered pricing
        2. Customer uses 10 units (10 billing entries)
        3. Customer switches to Product C (fixed price, no meter)
        4. Customer ingests 10 more events (no billing entries, no matching meter)
        5. Expected: Invoice has 10 × $1 = $10 for usage before switch

        This test verifies that usage before a subscription change is charged
        even if the new product doesn't have metered pricing for that meter.
        """
        # Create meter with SUM aggregation (summable)
        meter_sum = await create_meter(
            save_fixture,
            filter=Filter(conjunction=FilterConjunction.and_, clauses=[]),
            aggregation=PropertyAggregation(
                func=AggregationFunction.sum, property="tokens"
            ),
            organization=organization,
        )

        # Create Product A with $1/unit metered pricing
        product_a = await create_product(
            save_fixture,
            organization=organization,
            recurring_interval=SubscriptionRecurringInterval.month,
            prices=[(meter_sum, Decimal(100), None, "usd")],  # $1.00 per unit
        )
        price_a = product_a.prices[0]
        assert is_metered_price(price_a)

        # Create subscription on Product A
        subscription = await create_active_subscription(
            save_fixture, customer=customer, product=product_a
        )

        # Create 10 billing entries on price A (usage before switch)
        old_entries = []
        for _ in range(10):
            entry = await create_metered_event_billing_entry(
                save_fixture,
                customer=customer,
                price=price_a,
                subscription=subscription,
                tokens=1,
            )
            old_entries.append(entry)

        # Create Product C with NO metered pricing (only fixed price)
        product_c = await create_product(
            save_fixture,
            organization=organization,
            recurring_interval=SubscriptionRecurringInterval.month,
            prices=[(1000, "usd")],  # Fixed $10/month, no meter
        )
        price_c = product_c.prices[0]
        assert is_fixed_price(price_c)

        # Switch subscription to Product C (which has no meter)
        subscription.subscription_product_prices = [
            SubscriptionProductPrice.from_price(price_c)
        ]
        await save_fixture(subscription)

        # Note: After switching to product C, new events would not create billing
        # entries because there's no metered price to match. We don't create any
        # new billing entries here to simulate that scenario.

        # Compute order items - should still charge for usage on old price A
        async with billing_entry_service.create_order_items_from_pending(
            session, subscription
        ) as order_items:
            # Should have 1 line item for the old usage on price A
            assert len(order_items) == 1

            order_item = order_items[0]
            assert order_item.product_price == price_a
            assert order_item.amount == 10_00  # 10 units × $1.00 = $10.00

            order = await create_order(
                save_fixture,
                customer=customer,
                order_items=list(order_items),
            )

        # All old entries should be linked to the order item
        for entry in old_entries:
            await session.refresh(entry)
            assert entry.order_item_id == order_item.id

    async def test_mid_cycle_switch_to_product_without_meter_max_aggregation(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        customer: Customer,
        organization: Organization,
    ) -> None:
        """
        When a customer switches to a product without a meter for certain usage,
        usage before the switch should still be charged at the old price.
        This tests non-summable aggregations (MAX) specifically.

        Scenario:
        1. Customer subscribes to Product A with $10/server MAX aggregation
        2. Customer's peak usage is 3 servers
        3. Customer switches to Product C (fixed price, no meter)
        4. Expected: Invoice has MAX(3) × $10 = $30 for usage before switch

        This test verifies that non-summable aggregation usage before a subscription
        change is charged even if the new product doesn't have that meter.
        """
        # Create meter with MAX aggregation (non-summable)
        meter_max = await create_meter(
            save_fixture,
            filter=Filter(conjunction=FilterConjunction.and_, clauses=[]),
            aggregation=PropertyAggregation(
                func=AggregationFunction.max, property="servers"
            ),
            organization=organization,
        )

        # Create Product A with $10/server metered pricing
        product_a = await create_product(
            save_fixture,
            organization=organization,
            recurring_interval=SubscriptionRecurringInterval.month,
            prices=[(meter_max, Decimal(10_00), None, "usd")],  # $10 per server
        )
        price_a = product_a.prices[0]
        assert is_metered_price(price_a)

        # Create subscription on Product A
        subscription = await create_active_subscription(
            save_fixture, customer=customer, product=product_a
        )

        # Create billing entries with varying server counts (MAX will be 3)
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

        # Create Product C with NO metered pricing (only fixed price)
        product_c = await create_product(
            save_fixture,
            organization=organization,
            recurring_interval=SubscriptionRecurringInterval.month,
            prices=[(1000, "usd")],  # Fixed $10/month, no meter
        )
        price_c = product_c.prices[0]
        assert is_fixed_price(price_c)

        # Switch subscription to Product C (which has no meter)
        subscription.subscription_product_prices = [
            SubscriptionProductPrice.from_price(price_c)
        ]
        await save_fixture(subscription)

        # Compute order items - should still charge for MAX usage on old price A
        async with billing_entry_service.create_order_items_from_pending(
            session, subscription
        ) as order_items:
            # Should have 1 line item for the old usage on price A
            assert len(order_items) == 1

            order_item = order_items[0]
            assert order_item.product_price == price_a
            # MAX of all events is 3, billed at $10 per server = $30
            assert order_item.amount == 30_00

            order = await create_order(
                save_fixture,
                customer=customer,
                order_items=list(order_items),
            )

        # All entries should be linked to the order item
        for entry in entries:
            await session.refresh(entry)
            assert entry.order_item_id == order_item.id

    async def test_non_summable_proration_single_switch(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        customer: Customer,
        organization: Organization,
    ) -> None:
        """
        Test that non-summable aggregations are prorated when switching products
        mid-cycle. The subscription_product_updated event determines when the
        switch happened for proration calculations.

        Scenario:
        - 30-day billing period
        - Customer on Product A ($10/server MAX) for first 10 days
        - Switches to Product B ($15/server MAX) for remaining 20 days
        - MAX on A = 3 servers, MAX on B = 2 servers
        - Expected: (3 × $10 × 10/30) + (2 × $15 × 20/30) = $10 + $20 = $30
        """
        # Create meter with MAX aggregation
        meter_max = await create_meter(
            save_fixture,
            filter=Filter(conjunction=FilterConjunction.and_, clauses=[]),
            aggregation=PropertyAggregation(
                func=AggregationFunction.max, property="servers"
            ),
            organization=organization,
        )

        # Create Product A ($10/server)
        product_a = await create_product(
            save_fixture,
            organization=organization,
            recurring_interval=SubscriptionRecurringInterval.month,
            prices=[(meter_max, Decimal(10_00), None, "usd")],
        )
        price_a = product_a.prices[0]
        assert is_metered_price(price_a)

        # Create Product B ($15/server)
        product_b = await create_product(
            save_fixture,
            organization=organization,
            recurring_interval=SubscriptionRecurringInterval.month,
            prices=[(meter_max, Decimal(15_00), None, "usd")],
        )
        price_b = product_b.prices[0]
        assert is_metered_price(price_b)

        # Set up billing period: 30 days
        period_start = datetime(2024, 1, 1, 0, 0, 0, tzinfo=UTC)
        period_end = datetime(2024, 1, 31, 0, 0, 0, tzinfo=UTC)
        switch_time = datetime(2024, 1, 11, 0, 0, 0, tzinfo=UTC)  # Day 10

        # Create subscription starting on Product A
        subscription = await create_active_subscription(
            save_fixture,
            customer=customer,
            product=product_a,
            current_period_start=period_start,
            current_period_end=period_end,
        )

        # Create events on Product A (days 1-10), MAX = 3
        await create_metered_event_billing_entry(
            save_fixture,
            customer=customer,
            price=price_a,
            subscription=subscription,
            tokens=3,
            metadata_key="servers",
            timestamp=datetime(2024, 1, 5, 0, 0, 0, tzinfo=UTC),
        )
        await create_metered_event_billing_entry(
            save_fixture,
            customer=customer,
            price=price_a,
            subscription=subscription,
            tokens=1,
            metadata_key="servers",
            timestamp=datetime(2024, 1, 8, 0, 0, 0, tzinfo=UTC),
        )

        # Create the subscription_product_updated system event
        await event_service.create_event(
            session,
            Event(
                name=SystemEvent.subscription_product_updated,
                source=EventSource.system,
                customer_id=customer.id,
                organization=organization,
                user_metadata={
                    "subscription_id": str(subscription.id),
                    "old_product_id": str(product_a.id),
                    "new_product_id": str(product_b.id),
                },
                timestamp=switch_time,
            ),
        )
        await session.flush()

        # Update subscription to Product B
        subscription.product = product_b
        subscription.subscription_product_prices = [
            SubscriptionProductPrice.from_price(price_b)
        ]
        await save_fixture(subscription)

        # Create events on Product B (days 11-30), MAX = 2
        await create_metered_event_billing_entry(
            save_fixture,
            customer=customer,
            price=price_b,
            subscription=subscription,
            tokens=2,
            metadata_key="servers",
            timestamp=datetime(2024, 1, 15, 0, 0, 0, tzinfo=UTC),
        )
        await create_metered_event_billing_entry(
            save_fixture,
            customer=customer,
            price=price_b,
            subscription=subscription,
            tokens=1,
            metadata_key="servers",
            timestamp=datetime(2024, 1, 25, 0, 0, 0, tzinfo=UTC),
        )

        # Compute order items
        async with billing_entry_service.create_order_items_from_pending(
            session, subscription
        ) as order_items:
            # Should have 2 line items: one for each segment
            assert len(order_items) == 2

            # Segment 1: Product A, 10 days out of 30, MAX = 3, $10/server
            # Prorated: 3 × $10 × (10/30) = $10
            order_item_a = next(
                (item for item in order_items if item.product_price == price_a), None
            )
            assert order_item_a is not None
            assert order_item_a.amount == 10_00

            # Segment 2: Product B, 20 days out of 30, MAX = 2, $15/server
            # Prorated: 2 × $15 × (20/30) = $20
            order_item_b = next(
                (item for item in order_items if item.product_price == price_b), None
            )
            assert order_item_b is not None
            assert order_item_b.amount == 20_00

            # Create order to satisfy foreign key constraint
            await create_order(
                save_fixture,
                customer=customer,
                order_items=list(order_items),
            )

    async def test_non_summable_proration_multiple_switches(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        customer: Customer,
        organization: Organization,
    ) -> None:
        """
        Test proration when switching A → B → A in a single billing cycle.
        Each time period should be billed at the rate that was active during that period.

        Scenario:
        - 30-day billing period
        - Days 1-10: Product A ($10/server MAX), MAX = 3
        - Days 11-20: Product B ($15/server MAX), MAX = 4
        - Days 21-30: Product A ($10/server MAX), MAX = 2
        - Expected:
          - Segment 1: 3 × $10 × (10/30) = $10.00
          - Segment 2: 4 × $15 × (10/30) = $20.00
          - Segment 3: 2 × $10 × (10/30) = $6.67
        """
        # Create meter with MAX aggregation
        meter_max = await create_meter(
            save_fixture,
            filter=Filter(conjunction=FilterConjunction.and_, clauses=[]),
            aggregation=PropertyAggregation(
                func=AggregationFunction.max, property="servers"
            ),
            organization=organization,
        )

        # Create Product A ($10/server)
        product_a = await create_product(
            save_fixture,
            organization=organization,
            recurring_interval=SubscriptionRecurringInterval.month,
            prices=[(meter_max, Decimal(10_00), None, "usd")],
        )
        price_a = product_a.prices[0]
        assert is_metered_price(price_a)

        # Create Product B ($15/server)
        product_b = await create_product(
            save_fixture,
            organization=organization,
            recurring_interval=SubscriptionRecurringInterval.month,
            prices=[(meter_max, Decimal(15_00), None, "usd")],
        )
        price_b = product_b.prices[0]
        assert is_metered_price(price_b)

        # Set up billing period: 30 days
        period_start = datetime(2024, 1, 1, 0, 0, 0, tzinfo=UTC)
        period_end = datetime(2024, 1, 31, 0, 0, 0, tzinfo=UTC)
        switch_1_time = datetime(2024, 1, 11, 0, 0, 0, tzinfo=UTC)  # Day 10 -> 11
        switch_2_time = datetime(2024, 1, 21, 0, 0, 0, tzinfo=UTC)  # Day 20 -> 21

        # Create subscription starting on Product A
        subscription = await create_active_subscription(
            save_fixture,
            customer=customer,
            product=product_a,
            current_period_start=period_start,
            current_period_end=period_end,
        )

        # Segment 1: Events on Product A (days 1-10), MAX = 3
        await create_metered_event_billing_entry(
            save_fixture,
            customer=customer,
            price=price_a,
            subscription=subscription,
            tokens=3,
            metadata_key="servers",
            timestamp=datetime(2024, 1, 5, 0, 0, 0, tzinfo=UTC),
        )
        await create_metered_event_billing_entry(
            save_fixture,
            customer=customer,
            price=price_a,
            subscription=subscription,
            tokens=1,
            metadata_key="servers",
            timestamp=datetime(2024, 1, 8, 0, 0, 0, tzinfo=UTC),
        )

        # First switch: A -> B
        await event_service.create_event(
            session,
            Event(
                name=SystemEvent.subscription_product_updated,
                source=EventSource.system,
                customer_id=customer.id,
                organization=organization,
                user_metadata={
                    "subscription_id": str(subscription.id),
                    "old_product_id": str(product_a.id),
                    "new_product_id": str(product_b.id),
                },
                timestamp=switch_1_time,
            ),
        )
        await session.flush()

        # Update subscription to Product B
        subscription.product = product_b
        subscription.subscription_product_prices = [
            SubscriptionProductPrice.from_price(price_b)
        ]
        await save_fixture(subscription)

        # Segment 2: Events on Product B (days 11-20), MAX = 4
        await create_metered_event_billing_entry(
            save_fixture,
            customer=customer,
            price=price_b,
            subscription=subscription,
            tokens=4,
            metadata_key="servers",
            timestamp=datetime(2024, 1, 15, 0, 0, 0, tzinfo=UTC),
        )
        await create_metered_event_billing_entry(
            save_fixture,
            customer=customer,
            price=price_b,
            subscription=subscription,
            tokens=2,
            metadata_key="servers",
            timestamp=datetime(2024, 1, 18, 0, 0, 0, tzinfo=UTC),
        )

        # Second switch: B -> A
        await event_service.create_event(
            session,
            Event(
                name=SystemEvent.subscription_product_updated,
                source=EventSource.system,
                customer_id=customer.id,
                organization=organization,
                user_metadata={
                    "subscription_id": str(subscription.id),
                    "old_product_id": str(product_b.id),
                    "new_product_id": str(product_a.id),
                },
                timestamp=switch_2_time,
            ),
        )
        await session.flush()

        # Update subscription back to Product A
        subscription.product = product_a
        subscription.subscription_product_prices = [
            SubscriptionProductPrice.from_price(price_a)
        ]
        await save_fixture(subscription)

        # Segment 3: Events on Product A again (days 21-30), MAX = 2
        await create_metered_event_billing_entry(
            save_fixture,
            customer=customer,
            price=price_a,
            subscription=subscription,
            tokens=2,
            metadata_key="servers",
            timestamp=datetime(2024, 1, 25, 0, 0, 0, tzinfo=UTC),
        )
        await create_metered_event_billing_entry(
            save_fixture,
            customer=customer,
            price=price_a,
            subscription=subscription,
            tokens=1,
            metadata_key="servers",
            timestamp=datetime(2024, 1, 28, 0, 0, 0, tzinfo=UTC),
        )

        # Compute order items
        async with billing_entry_service.create_order_items_from_pending(
            session, subscription
        ) as order_items:
            # Should have 3 line items: one for each segment
            assert len(order_items) == 3

            # Find order items by price and approximate amount
            order_items_a = [
                item for item in order_items if item.product_price == price_a
            ]
            order_item_b = next(
                (item for item in order_items if item.product_price == price_b), None
            )

            # Segment 1: 3 × $10 × (10/30) = $10
            # Segment 3: 2 × $10 × (10/30) = $6.67 (rounded to nearest cent)
            assert len(order_items_a) == 2
            # Sort by amount to identify which is which
            order_items_a_sorted = sorted(order_items_a, key=lambda x: x.amount)
            assert order_items_a_sorted[0].amount == 667  # Segment 3: $6.67
            assert order_items_a_sorted[1].amount == 10_00  # Segment 1: $10.00

            # Segment 2: 4 × $15 × (10/30) = $20
            assert order_item_b is not None
            assert order_item_b.amount == 20_00

            # Create order to satisfy foreign key constraint
            await create_order(
                save_fixture,
                customer=customer,
                order_items=list(order_items),
            )

    async def test_non_summable_proration_late_arriving_events(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        customer: Customer,
        organization: Organization,
    ) -> None:
        """
        Test that late-arriving events (ingested after switch but with timestamp before)
        are correctly attributed to the segment when they occurred.

        Scenario:
        - 30-day billing period
        - Days 1-15: Product A ($10/server MAX)
        - Days 16-30: Product B ($15/server MAX)
        - Event at day 5 with 4 servers (ingested late)
        - Event at day 20 with 2 servers
        - Expected: 4 × $10 × (15/30) + 2 × $15 × (15/30) = $20 + $15 = $35
        """
        # Create meter with MAX aggregation
        meter_max = await create_meter(
            save_fixture,
            filter=Filter(conjunction=FilterConjunction.and_, clauses=[]),
            aggregation=PropertyAggregation(
                func=AggregationFunction.max, property="servers"
            ),
            organization=organization,
        )

        # Create Product A ($10/server)
        product_a = await create_product(
            save_fixture,
            organization=organization,
            recurring_interval=SubscriptionRecurringInterval.month,
            prices=[(meter_max, Decimal(10_00), None, "usd")],
        )
        price_a = product_a.prices[0]
        assert is_metered_price(price_a)

        # Create Product B ($15/server)
        product_b = await create_product(
            save_fixture,
            organization=organization,
            recurring_interval=SubscriptionRecurringInterval.month,
            prices=[(meter_max, Decimal(15_00), None, "usd")],
        )
        price_b = product_b.prices[0]
        assert is_metered_price(price_b)

        # Set up billing period: 30 days
        period_start = datetime(2024, 1, 1, 0, 0, 0, tzinfo=UTC)
        period_end = datetime(2024, 1, 31, 0, 0, 0, tzinfo=UTC)
        switch_time = datetime(2024, 1, 16, 0, 0, 0, tzinfo=UTC)  # Day 15 -> 16

        # Create subscription starting on Product A
        subscription = await create_active_subscription(
            save_fixture,
            customer=customer,
            product=product_a,
            current_period_start=period_start,
            current_period_end=period_end,
        )

        # Switch: A -> B (happens first in real time)
        await event_service.create_event(
            session,
            Event(
                name=SystemEvent.subscription_product_updated,
                source=EventSource.system,
                customer_id=customer.id,
                organization=organization,
                user_metadata={
                    "subscription_id": str(subscription.id),
                    "old_product_id": str(product_a.id),
                    "new_product_id": str(product_b.id),
                },
                timestamp=switch_time,
            ),
        )
        await session.flush()

        # Update subscription to Product B
        subscription.product = product_b
        subscription.subscription_product_prices = [
            SubscriptionProductPrice.from_price(price_b)
        ]
        await save_fixture(subscription)

        # Event on Product B (day 20), MAX = 2
        await create_metered_event_billing_entry(
            save_fixture,
            customer=customer,
            price=price_b,
            subscription=subscription,
            tokens=2,
            metadata_key="servers",
            timestamp=datetime(2024, 1, 20, 0, 0, 0, tzinfo=UTC),
        )

        # Late-arriving event: timestamp is day 5 (before switch), but ingested now
        # This event should still be attributed to Product A's segment
        # Note: In practice, the billing entry would be created with price_a since
        # that was the active price at timestamp=day 5. We simulate this scenario.
        await create_metered_event_billing_entry(
            save_fixture,
            customer=customer,
            price=price_a,  # Would have been the active price at event timestamp
            subscription=subscription,
            tokens=4,
            metadata_key="servers",
            timestamp=datetime(2024, 1, 5, 0, 0, 0, tzinfo=UTC),
        )

        # Compute order items
        async with billing_entry_service.create_order_items_from_pending(
            session, subscription
        ) as order_items:
            # Should have 2 line items: one for each segment
            assert len(order_items) == 2

            # Segment 1: Product A, 15 days out of 30, MAX = 4, $10/server
            # Prorated: 4 × $10 × (15/30) = $20
            order_item_a = next(
                (item for item in order_items if item.product_price == price_a), None
            )
            assert order_item_a is not None
            assert order_item_a.amount == 20_00

            # Segment 2: Product B, 15 days out of 30, MAX = 2, $15/server
            # Prorated: 2 × $15 × (15/30) = $15
            order_item_b = next(
                (item for item in order_items if item.product_price == price_b), None
            )
            assert order_item_b is not None
            assert order_item_b.amount == 15_00

            # Create order to satisfy foreign key constraint
            await create_order(
                save_fixture,
                customer=customer,
                order_items=list(order_items),
            )
