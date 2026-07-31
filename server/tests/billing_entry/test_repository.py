import uuid

import pytest
import pytest_asyncio
from sqlalchemy import func, select

from polar.billing_entry.repository import BillingEntryRepository
from polar.kit.utils import utc_now
from polar.models import (
    BillingEntry,
    Customer,
    Order,
    OrderItem,
    Product,
    Subscription,
)
from polar.models.billing_entry import BillingEntryDirection, BillingEntryType
from polar.postgres import AsyncSession
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import (
    create_active_subscription,
    create_event,
    create_order,
)


async def _create_pending_entries(
    session: AsyncSession,
    *,
    customer: Customer,
    subscription: Subscription,
    product_price_id: uuid.UUID,
    event_id: uuid.UUID,
    count: int,
    order_item_id: uuid.UUID | None = None,
) -> list[uuid.UUID]:
    now = utc_now()
    entries = [
        BillingEntry(
            id=uuid.uuid4(),
            start_timestamp=now,
            end_timestamp=now,
            type=BillingEntryType.metered,
            direction=BillingEntryDirection.debit,
            customer_id=customer.id,
            product_price_id=product_price_id,
            subscription_id=subscription.id,
            event_id=event_id,
            order_item_id=order_item_id,
        )
        for _ in range(count)
    ]
    session.add_all(entries)
    await session.flush()
    return [entry.id for entry in entries]


@pytest.mark.asyncio
class TestUpdateOrderItemId:
    @pytest_asyncio.fixture
    async def subscription(
        self,
        save_fixture: SaveFixture,
        customer: Customer,
        product: Product,
    ) -> Subscription:
        return await create_active_subscription(
            save_fixture, customer=customer, product=product
        )

    @pytest_asyncio.fixture
    async def order(
        self,
        save_fixture: SaveFixture,
        customer: Customer,
        product: Product,
        subscription: Subscription,
    ) -> Order:
        return await create_order(
            save_fixture,
            product=product,
            customer=customer,
            subscription=subscription,
        )

    async def test_bulk_updates_large_number_of_entries(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        customer: Customer,
        product: Product,
        subscription: Subscription,
        order: Order,
    ) -> None:
        event = await create_event(
            save_fixture, organization=customer.organization, customer=customer
        )
        price_id = product.prices[0].id
        order_item_id = order.items[0].id

        entry_ids = await _create_pending_entries(
            session,
            customer=customer,
            subscription=subscription,
            product_price_id=price_id,
            event_id=event.id,
            count=5000,
        )

        repository = BillingEntryRepository.from_session(session)
        await repository.update_order_item_id(entry_ids, order_item_id)

        assigned = await session.scalar(
            select(func.count())
            .select_from(BillingEntry)
            .where(BillingEntry.order_item_id == order_item_id)
        )
        assert assigned == 5000

    async def test_respects_order_item_id_null_guard(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        customer: Customer,
        product: Product,
        subscription: Subscription,
        order: Order,
    ) -> None:
        event = await create_event(
            save_fixture, organization=customer.organization, customer=customer
        )
        price_id = product.prices[0].id

        existing_item = order.items[0]
        new_item = OrderItem(
            label="",
            amount=100,
            net_amount=100,
            tax_amount=0,
            product_price=product.prices[0],
        )
        order.items.append(new_item)
        await save_fixture(order)

        already_assigned_ids = await _create_pending_entries(
            session,
            customer=customer,
            subscription=subscription,
            product_price_id=price_id,
            event_id=event.id,
            count=3,
            order_item_id=existing_item.id,
        )
        pending_ids = await _create_pending_entries(
            session,
            customer=customer,
            subscription=subscription,
            product_price_id=price_id,
            event_id=event.id,
            count=3,
        )

        repository = BillingEntryRepository.from_session(session)
        await repository.update_order_item_id(
            [*already_assigned_ids, *pending_ids], new_item.id
        )

        result = await session.execute(
            select(BillingEntry.id, BillingEntry.order_item_id).where(
                BillingEntry.id.in_([*already_assigned_ids, *pending_ids])
            )
        )
        order_item_by_entry = {row.id: row.order_item_id for row in result}

        for entry_id in already_assigned_ids:
            assert order_item_by_entry[entry_id] == existing_item.id
        for entry_id in pending_ids:
            assert order_item_by_entry[entry_id] == new_item.id

    async def test_empty_sequence_is_noop(
        self,
        session: AsyncSession,
        order: Order,
    ) -> None:
        repository = BillingEntryRepository.from_session(session)
        await repository.update_order_item_id([], order.items[0].id)
