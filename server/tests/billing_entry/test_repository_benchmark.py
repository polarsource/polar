"""
Benchmarks for `BillingEntryRepository.update_order_item_id`.

Without `synchronize_session=False`, every ORM UPDATE makes SQLAlchemy walk the
whole session identity map and, for each resident `BillingEntry`, test its id
against the batch's 1000-element IN list. Cost per batch is therefore
`resident_entries * batch_size`, which makes the loop quadratic.

- `test_per_batch_cost_scales_with_identity_map` measures per-batch cost as
  residency grows; at 40k resident entries it reproduces the ~1.5s/batch seen
  in production, against a flat ~30ms with the fix.
- `test_static_flow_quadratic_blowup` drives the real
  `create_order_items_from_pending` on the static-entry shape (one OrderItem
  per entry), showing per-update cost growing before the fix and flat after.
- `test_real_flow_speedup` drives the same flow on the metered shape, where
  nothing stays resident — a control showing the fix is a no-op there.

Deselected by default (marked `benchmark`); run explicitly with:

    uv run pytest tests/billing_entry/test_repository_benchmark.py \
        -m benchmark -s -p no:randomly
"""

import time
import uuid
from collections.abc import Sequence
from decimal import Decimal
from itertools import batched

import pytest
import pytest_asyncio
from sqlalchemy import insert, select, update

from polar.billing_entry.repository import BillingEntryRepository
from polar.billing_entry.service import billing_entry as billing_entry_service
from polar.enums import SubscriptionRecurringInterval
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
    Subscription,
)
from polar.models.billing_entry import BillingEntryDirection, BillingEntryType
from polar.models.event import EventSource
from polar.postgres import AsyncReadSession, AsyncSession
from tests.fixtures.database import SaveFixture, save_fixture_factory
from tests.fixtures.random_objects import (
    METER_TEST_EVENT,
    create_active_subscription,
    create_meter,
    create_order,
    create_product,
)

ENTRIES = 20_000
BATCH_SIZE = 1000


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
async def product(
    save_fixture: SaveFixture, organization: Organization, meter: Meter
) -> Product:
    return await create_product(
        save_fixture,
        organization=organization,
        recurring_interval=SubscriptionRecurringInterval.month,
        prices=[(meter, Decimal(100), None, "usd")],
    )


@pytest_asyncio.fixture
async def subscription(
    save_fixture: SaveFixture, product: Product, customer: Customer
) -> Subscription:
    return await create_active_subscription(
        save_fixture, product=product, customer=customer
    )


@pytest_asyncio.fixture
async def order(
    save_fixture: SaveFixture,
    product: Product,
    customer: Customer,
    subscription: Subscription,
) -> Order:
    return await create_order(
        save_fixture, product=product, customer=customer, subscription=subscription
    )


async def _seed_metered_entries(
    session: AsyncSession,
    organization: Organization,
    customer: Customer,
    product: Product,
    subscription: Subscription,
    count: int,
) -> list[uuid.UUID]:
    """Bulk-insert `count` events and matching pending metered billing entries."""
    price = product.prices[0]
    now = subscription.current_period_start
    event_ids = [uuid.uuid4() for _ in range(count)]
    entry_ids = [uuid.uuid4() for _ in range(count)]

    events = [
        {
            "id": event_id,
            "timestamp": now,
            "source": EventSource.user,
            "name": METER_TEST_EVENT,
            "customer_id": customer.id,
            "organization_id": organization.id,
            "root_id": event_id,
            "user_metadata": {"tokens": 1},
        }
        for event_id in event_ids
    ]
    entries = [
        {
            "id": entry_id,
            "start_timestamp": now,
            "end_timestamp": now,
            "type": BillingEntryType.metered,
            "direction": BillingEntryDirection.debit,
            "customer_id": customer.id,
            "product_price_id": price.id,
            "subscription_id": subscription.id,
            "event_id": event_id,
            "order_item_id": None,
        }
        for entry_id, event_id in zip(entry_ids, event_ids, strict=True)
    ]
    for event_chunk in batched(events, 5000):
        await session.execute(insert(Event), list(event_chunk))
    for entry_chunk in batched(entries, 5000):
        await session.execute(insert(BillingEntry), list(entry_chunk))
    await session.flush()
    return entry_ids


async def _make_order_item(
    save_fixture: SaveFixture, order: Order, product: Product, label: str
) -> OrderItem:
    item = OrderItem(
        id=uuid.uuid4(),
        label=label,
        amount=0,
        net_amount=0,
        tax_amount=0,
        proration=False,
        order=order,
        product_price=product.prices[0],
    )
    await save_fixture(item)
    return item


async def _run_unfixed(
    session: AsyncSession | AsyncReadSession,
    ids: Sequence[uuid.UUID],
    order_item_id: uuid.UUID,
) -> None:
    """The loop exactly as it was before the fix (synchronize_session defaults to 'auto')."""
    for batch in batched(ids, BATCH_SIZE):
        statement = (
            update(BillingEntry)
            .where(
                BillingEntry.id.in_(batch),
                BillingEntry.order_item_id.is_(None),
            )
            .values(order_item_id=order_item_id)
        )
        await session.execute(statement)


async def _clear_order_item_id(session: AsyncSession, ids: Sequence[uuid.UUID]) -> None:
    for batch in batched(ids, 5000):
        await session.execute(
            update(BillingEntry)
            .where(BillingEntry.id.in_(batch))
            .values(order_item_id=None)
            .execution_options(synchronize_session=False)
        )
    await session.flush()


@pytest.mark.benchmark
@pytest.mark.asyncio
async def test_real_flow_speedup(
    session: AsyncSession,
    save_fixture: SaveFixture,
    organization: Organization,
    customer: Customer,
    product: Product,
    subscription: Subscription,
    order: Order,
) -> None:
    """
    Drive the real `create_order_items_from_pending` flow, then time the update
    loop against the session state that flow actually leaves behind.
    """
    ids = await _seed_metered_entries(
        session, organization, customer, product, subscription, ENTRIES
    )

    async with billing_entry_service.create_order_items_from_pending(
        session, subscription
    ) as items:
        assert len(items) == 1
        # The real caller (`order_service._create_order`) persists the items
        # inside this block, before the update loop runs on exit.
        for item in items:
            item.order = order
            session.add(item)
        await session.flush()

        resident_states = len(list(session.identity_map.all_states()))
        resident_entries = sum(
            1
            for state in session.identity_map.all_states()
            if state.class_ is BillingEntry
        )

    print(
        f"\n{ENTRIES} pending entries; at the update loop the session holds "
        f"{resident_states} states ({resident_entries} BillingEntry)"
    )

    await _clear_order_item_id(session, ids)

    item_unfixed = await _make_order_item(save_fixture, order, product, "unfixed")
    item_fixed = await _make_order_item(save_fixture, order, product, "fixed")
    batches = (len(ids) + BATCH_SIZE - 1) // BATCH_SIZE

    start = time.perf_counter()
    await _run_unfixed(session, ids, item_unfixed.id)
    unfixed_seconds = time.perf_counter() - start

    await _clear_order_item_id(session, ids)

    repository = BillingEntryRepository.from_session(session)
    start = time.perf_counter()
    await repository.update_order_item_id(ids, item_fixed.id)
    fixed_seconds = time.perf_counter() - start

    print(
        f"before fix: {unfixed_seconds:7.3f}s total "
        f"({unfixed_seconds / batches * 1000:8.1f} ms/batch)"
    )
    print(
        f"after fix:  {fixed_seconds:7.3f}s total "
        f"({fixed_seconds / batches * 1000:8.1f} ms/batch)"
    )
    print(f"speedup:    {unfixed_seconds / fixed_seconds:7.1f}x")

    updated = await session.execute(
        select(BillingEntry.id).where(BillingEntry.order_item_id == item_fixed.id)
    )
    assert len(updated.scalars().all()) == ENTRIES


@pytest_asyncio.fixture
async def static_product(
    save_fixture: SaveFixture, organization: Organization
) -> Product:
    return await create_product(
        save_fixture,
        organization=organization,
        recurring_interval=SubscriptionRecurringInterval.month,
    )


@pytest_asyncio.fixture
async def static_subscription(
    save_fixture: SaveFixture, static_product: Product, customer: Customer
) -> Subscription:
    return await create_active_subscription(
        save_fixture, product=static_product, customer=customer
    )


async def _seed_static_entries(
    session: AsyncSession,
    organization: Organization,
    customer: Customer,
    product: Product,
    subscription: Subscription,
    count: int,
) -> list[uuid.UUID]:
    price = product.prices[0]
    event_ids = [uuid.uuid4() for _ in range(count)]
    entry_ids = [uuid.uuid4() for _ in range(count)]

    events = [
        {
            "id": event_id,
            "timestamp": subscription.current_period_start,
            "source": EventSource.system,
            "name": SystemEvent.subscription_cycled,
            "customer_id": customer.id,
            "organization_id": organization.id,
            "root_id": event_id,
            "user_metadata": {"subscription_id": str(subscription.id)},
        }
        for event_id in event_ids
    ]
    entries = [
        {
            "id": entry_id,
            "start_timestamp": subscription.current_period_start,
            "end_timestamp": subscription.current_period_end,
            "type": BillingEntryType.cycle,
            "direction": BillingEntryDirection.debit,
            "amount": 1000,
            "currency": "usd",
            "customer_id": customer.id,
            "product_price_id": price.id,
            "subscription_id": subscription.id,
            "event_id": event_id,
            "order_item_id": None,
        }
        for entry_id, event_id in zip(entry_ids, event_ids, strict=True)
    ]
    for event_chunk in batched(events, 5000):
        await session.execute(insert(Event), list(event_chunk))
    for entry_chunk in batched(entries, 5000):
        await session.execute(insert(BillingEntry), list(entry_chunk))
    await session.flush()
    return entry_ids


async def _unfixed_update_order_item_id(
    self: BillingEntryRepository,
    billing_entries: Sequence[uuid.UUID],
    order_item_id: uuid.UUID,
) -> None:
    await _run_unfixed(self.session, billing_entries, order_item_id)


@pytest.mark.benchmark
@pytest.mark.asyncio
@pytest.mark.parametrize("count", [500, 1000, 2000, 4000])
@pytest.mark.parametrize("fixed", [False, True], ids=["before-fix", "after-fix"])
async def test_static_flow_quadratic_blowup(
    session: AsyncSession,
    monkeypatch: pytest.MonkeyPatch,
    organization: Organization,
    customer: Customer,
    static_product: Product,
    static_subscription: Subscription,
    count: int,
    fixed: bool,
) -> None:
    """
    Static entries yield one OrderItem *each*, so `item_entries_map` holds
    `count` OrderItems — all strongly referenced and added to the session. The
    update loop then runs `count` times, and without the fix each iteration
    walks that whole identity map: O(count²).
    """
    if not fixed:
        monkeypatch.setattr(
            BillingEntryRepository,
            "update_order_item_id",
            _unfixed_update_order_item_id,
        )

    await _seed_static_entries(
        session, organization, customer, static_product, static_subscription, count
    )

    start = time.perf_counter()
    async with billing_entry_service.create_order_items_from_pending(
        session, static_subscription
    ) as items:
        assert len(items) == count
        order = await create_order(
            save_fixture_factory(session),
            product=static_product,
            customer=customer,
            subscription=static_subscription,
        )
        for item in items:
            item.order = order
            session.add(item)
        await session.flush()

        resident = len(list(session.identity_map.all_states()))
        compute_seconds = time.perf_counter() - start
        start = time.perf_counter()
    loop_seconds = time.perf_counter() - start

    print(
        f"\n{'after-fix ' if fixed else 'before-fix'} | "
        f"{count:5d} entries -> {len(items):5d} order items | "
        f"{resident:6d} states resident | compute {compute_seconds:6.2f}s | "
        f"update loop {loop_seconds:7.2f}s "
        f"({loop_seconds / count * 1000:7.2f} ms/update)"
    )


@pytest.mark.benchmark
@pytest.mark.asyncio
async def test_per_batch_cost_scales_with_identity_map(
    session: AsyncSession,
    save_fixture: SaveFixture,
    organization: Organization,
    customer: Customer,
    product: Product,
    subscription: Subscription,
    order: Order,
) -> None:
    """
    Time a single 1000-row batch at growing identity-map sizes.

    The updated rows are never loaded into the session, so the only thing that
    varies is how many unrelated objects the synchronizer has to walk. Without
    the fix, per-batch cost grows with that number — which is what makes the
    full loop quadratic. With the fix it stays flat.
    """
    levels = [5_000, 10_000, 20_000, 40_000]
    targets = await _seed_metered_entries(
        session,
        organization,
        customer,
        product,
        subscription,
        BATCH_SIZE * len(levels),
    )
    fillers = await _seed_metered_entries(
        session, organization, customer, product, subscription, max(levels)
    )

    item = await _make_order_item(save_fixture, order, product, "scaling")
    repository = BillingEntryRepository.from_session(session)

    # The identity map is weakly referenced: hold the loaded objects so they
    # stay resident, exactly as a caller holding a result list would.
    held: list[BillingEntry] = []

    print("\n resident   before fix    after fix")
    loaded = 0
    for index, level in enumerate(levels):
        result = await session.execute(
            select(BillingEntry).where(BillingEntry.id.in_(fillers[loaded:level]))
        )
        held.extend(result.scalars().all())
        loaded = level
        resident = len(list(session.identity_map.all_states()))
        batch = targets[index * BATCH_SIZE : (index + 1) * BATCH_SIZE]

        start = time.perf_counter()
        await _run_unfixed(session, batch, item.id)
        unfixed_ms = (time.perf_counter() - start) * 1000

        await _clear_order_item_id(session, batch)
        start = time.perf_counter()
        await repository.update_order_item_id(batch, item.id)
        fixed_ms = (time.perf_counter() - start) * 1000

        print(f"{resident:9d} {unfixed_ms:9.1f} ms {fixed_ms:9.1f} ms")

    assert len(held) == max(levels)
