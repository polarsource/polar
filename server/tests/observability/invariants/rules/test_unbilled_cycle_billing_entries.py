from datetime import timedelta

import pytest
import pytest_asyncio

from polar.kit.utils import utc_now
from polar.models import Customer, Product
from polar.models.billing_entry import BillingEntryType
from polar.models.order_item import OrderItem
from polar.models.subscription import SubscriptionStatus
from polar.observability.invariants.rules.unbilled_cycle_billing_entries import (
    UnbilledCycleBillingEntriesInvariant,
    UnbilledCycleBillingEntriesInvariantError,
)
from polar.postgres import AsyncSession
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import (
    create_billing_entry,
    create_order,
    create_subscription,
)


@pytest_asyncio.fixture
async def invariant(session: AsyncSession) -> UnbilledCycleBillingEntriesInvariant:
    return UnbilledCycleBillingEntriesInvariant(session)


@pytest.mark.asyncio
async def test_failure(
    invariant: UnbilledCycleBillingEntriesInvariant,
    save_fixture: SaveFixture,
    product: Product,
    customer: Customer,
) -> None:
    subscription = await create_subscription(
        save_fixture,
        status=SubscriptionStatus.active,
        product=product,
        customer=customer,
    )
    await create_billing_entry(
        save_fixture,
        type=BillingEntryType.cycle,
        customer=customer,
        product_price=product.prices[0],
        subscription=subscription,
        created_at=utc_now() - timedelta(hours=7),
    )

    with pytest.raises(UnbilledCycleBillingEntriesInvariantError) as exc_info:
        await invariant.check()
    assert exc_info.value.context == {
        "count": 1,
        "subscriptions": {"ids": [subscription.id], "has_more": False},
    }


@pytest.mark.asyncio
async def test_failure_over_limit(
    invariant: UnbilledCycleBillingEntriesInvariant,
    save_fixture: SaveFixture,
    product: Product,
    customer: Customer,
) -> None:
    for _ in range(15):
        subscription = await create_subscription(
            save_fixture,
            status=SubscriptionStatus.active,
            product=product,
            customer=customer,
        )
        await create_billing_entry(
            save_fixture,
            type=BillingEntryType.cycle,
            customer=customer,
            product_price=product.prices[0],
            subscription=subscription,
            created_at=utc_now() - timedelta(hours=7),
        )

    with pytest.raises(UnbilledCycleBillingEntriesInvariantError) as exc_info:
        await invariant.check()
    assert exc_info.value.context["count"] == 15
    assert len(exc_info.value.context["subscriptions"]["ids"]) == 10
    assert exc_info.value.context["subscriptions"]["has_more"] is True


@pytest.mark.asyncio
async def test_success(
    invariant: UnbilledCycleBillingEntriesInvariant,
    save_fixture: SaveFixture,
    product: Product,
    customer: Customer,
) -> None:
    subscription = await create_subscription(
        save_fixture,
        status=SubscriptionStatus.active,
        product=product,
        customer=customer,
    )

    # Billed: attached to an order item
    order_item = OrderItem(
        label="",
        amount=1000,
        net_amount=1000,
        tax_amount=0,
        proration=False,
    )
    await create_order(
        save_fixture,
        customer=customer,
        product=product,
        subscription=subscription,
        order_items=[order_item],
    )
    await create_billing_entry(
        save_fixture,
        type=BillingEntryType.cycle,
        customer=customer,
        product_price=product.prices[0],
        subscription=subscription,
        order_item=order_item,
        created_at=utc_now() - timedelta(hours=7),
    )

    # Pending, but the order creation job may still be retrying
    await create_billing_entry(
        save_fixture,
        type=BillingEntryType.cycle,
        customer=customer,
        product_price=product.prices[0],
        subscription=subscription,
        created_at=utc_now() - timedelta(hours=2),
    )

    # Metered entries are legitimately pending for the whole period
    await create_billing_entry(
        save_fixture,
        type=BillingEntryType.metered,
        customer=customer,
        product_price=product.prices[0],
        subscription=subscription,
        created_at=utc_now() - timedelta(hours=7),
    )

    # Entries of a deleted subscription are never going to be billed
    deleted_subscription = await create_subscription(
        save_fixture,
        status=SubscriptionStatus.active,
        product=product,
        customer=customer,
    )
    deleted_subscription.set_deleted_at()
    await save_fixture(deleted_subscription)
    await create_billing_entry(
        save_fixture,
        type=BillingEntryType.cycle,
        customer=customer,
        product_price=product.prices[0],
        subscription=deleted_subscription,
        created_at=utc_now() - timedelta(hours=7),
    )

    # Canceled subscriptions are excluded
    canceled_subscription = await create_subscription(
        save_fixture,
        status=SubscriptionStatus.canceled,
        product=product,
        customer=customer,
    )
    await create_billing_entry(
        save_fixture,
        type=BillingEntryType.cycle,
        customer=customer,
        product_price=product.prices[0],
        subscription=canceled_subscription,
        created_at=utc_now() - timedelta(hours=7),
    )

    await invariant.check()
