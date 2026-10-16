from datetime import UTC, datetime, timedelta
from decimal import Decimal
from typing import Literal
from uuid import uuid4

import pytest
from sqlalchemy import select

from polar.kit.db.postgres import AsyncSession
from polar.meter.aggregation import AggregationFunction, PropertyAggregation
from polar.models import Customer, OrderItem, Organization, Product, ReducerBucket
from polar.models.billing_entry import BillingEntryType
from polar.reducer.service import reducer as reducer_service
from scripts.backfill_reducer_buckets import backfill_organization
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import (
    create_billing_entry,
    create_event,
    create_meter,
    create_order,
    create_product_price_metered_unit,
    create_reducer,
    create_subscription,
)

START = datetime(2026, 10, 1, 10, 0, tzinfo=UTC)
BUCKET = timedelta(minutes=5)
END = START + 3 * BUCKET
SUBSCRIPTION_START = START + timedelta(minutes=1)


@pytest.mark.anyio
class TestBackfillBuckets:
    async def test_billing_splits_generations_and_unbillable_usage(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
        customer: Customer,
        product: Product,
    ) -> None:
        meter = await create_meter(
            save_fixture,
            organization=organization,
            aggregation=PropertyAggregation(
                func=AggregationFunction.sum, property="tokens"
            ),
        )
        reducer = await create_reducer(
            save_fixture, organization=organization, meters=[meter]
        )
        price = await create_product_price_metered_unit(
            save_fixture, product=product, meter=meter
        )
        # A second meter on the same events, billed on its own schedule: its
        # entries are all still pending.
        count_meter = await create_meter(
            save_fixture, organization=organization, id=uuid4(), name="Count"
        )
        count_reducer = await create_reducer(
            save_fixture, organization=organization, meters=[count_meter]
        )
        count_price = await create_product_price_metered_unit(
            save_fixture, product=product, meter=count_meter
        )
        await create_subscription(
            save_fixture,
            product=product,
            customer=customer,
            started_at=SUBSCRIPTION_START,
        )
        order = await create_order(
            save_fixture,
            customer=customer,
            created_at=END + timedelta(minutes=15),
            order_items=[
                OrderItem(
                    label="",
                    amount=1000,
                    net_amount=1000,
                    tax_amount=0,
                    proration=False,
                    product_price=price,
                    start_timestamp=SUBSCRIPTION_START,
                    end_timestamp=START + BUCKET + timedelta(minutes=1),
                )
            ],
        )

        async def usage(
            timestamp: datetime,
            tokens: int,
            billing: Literal["ordered", "pending"] | None,
            name: str = "TEST_EVENT",
        ) -> None:
            event = await create_event(
                save_fixture,
                organization=organization,
                customer=customer,
                meter=meter if name == "TEST_EVENT" else None,
                name=name,
                timestamp=timestamp,
                ingested_at=timestamp,
                metadata={"tokens": tokens},
            )
            if billing is not None:
                await create_billing_entry(
                    save_fixture,
                    type=BillingEntryType.metered,
                    customer=customer,
                    product_price=price,
                    event=event,
                    order_item=order.items[0] if billing == "ordered" else None,
                )
                await create_billing_entry(
                    save_fixture,
                    type=BillingEntryType.metered,
                    customer=customer,
                    product_price=count_price,
                    event=event,
                )

        await usage(START + timedelta(seconds=30), 2, None)
        await usage(START + timedelta(minutes=4), 8, "ordered")
        await usage(START + timedelta(minutes=4, seconds=30), 1, "pending")
        await usage(START + BUCKET + timedelta(minutes=1), 3, "ordered")
        await usage(START + BUCKET + timedelta(minutes=3), 5, "pending")
        await usage(START + 2 * BUCKET, 7, None)
        await usage(START - timedelta(seconds=1), 100, "ordered")
        await usage(END, 100, None)
        await usage(START, 100, None, name="not-matching")

        for _ in range(2):
            await backfill_organization(session, organization.id, START, END)
            buckets = (
                await session.scalars(
                    select(ReducerBucket)
                    .where(ReducerBucket.reducer_id == reducer.id)
                    .order_by(ReducerBucket.bucket_start, ReducerBucket.generation)
                )
            ).all()
            assert all(
                b.customer_id == customer.id
                and b.external_customer_id is None
                and b.synced_at == END
                and b.billed_at == b.sealed_at
                and b.order_id == (order.id if b.sealed_at else None)
                for b in buckets
            )
            assert [
                (
                    b.bucket_start,
                    b.bucket_end,
                    b.generation,
                    b.sealed_at,
                    b.count,
                    b.sum,
                    b.min,
                    b.max,
                )
                for b in buckets
            ] == [
                # Before the subscription: never billed.
                (
                    START,
                    SUBSCRIPTION_START,
                    1,
                    None,
                    1,
                    Decimal(2),
                    Decimal(2),
                    Decimal(2),
                ),
                # Billed, plus a late event that missed that billing.
                (
                    SUBSCRIPTION_START,
                    START + BUCKET,
                    1,
                    order.created_at,
                    1,
                    Decimal(8),
                    Decimal(8),
                    Decimal(8),
                ),
                (
                    SUBSCRIPTION_START,
                    START + BUCKET,
                    2,
                    None,
                    1,
                    Decimal(1),
                    Decimal(1),
                    Decimal(1),
                ),
                # Billed up to the previous cutoff, then pending: two generations,
                # the cutoff itself isn't reconstructed.
                (
                    START + BUCKET,
                    START + 2 * BUCKET,
                    1,
                    order.created_at,
                    1,
                    Decimal(3),
                    Decimal(3),
                    Decimal(3),
                ),
                (
                    START + BUCKET,
                    START + 2 * BUCKET,
                    2,
                    None,
                    1,
                    Decimal(5),
                    Decimal(5),
                    Decimal(5),
                ),
                # Usage with no billing entry.
                (
                    START + 2 * BUCKET,
                    END,
                    1,
                    None,
                    1,
                    Decimal(7),
                    Decimal(7),
                    Decimal(7),
                ),
            ]
            count_buckets = (
                await session.scalars(
                    select(ReducerBucket).where(
                        ReducerBucket.reducer_id == count_reducer.id
                    )
                )
            ).all()
            assert sum(b.count for b in count_buckets) == 6
            assert all(b.sealed_at is None for b in count_buckets)

        # The next billing bills everything still open since the subscription
        # started: the late event, the pending one and the unbilled one. Usage
        # before the subscription stays open.
        next_order = await create_order(save_fixture, customer=customer)
        quantities = await reducer_service.bill(
            session,
            customer,
            [meter.id],
            order_id=next_order.id,
            billable_from=SUBSCRIPTION_START,
            cutoff=END,
        )
        assert quantities == {meter.id: Decimal(13)}
        buckets = (
            await session.scalars(
                select(ReducerBucket)
                .where(ReducerBucket.reducer_id == reducer.id)
                .order_by(ReducerBucket.bucket_start, ReducerBucket.generation)
            )
        ).all()
        assert [b.sealed_at is None for b in buckets] == [True] + [False] * 5
        assert [b.order_id for b in buckets] == [
            None,
            order.id,
            next_order.id,
            order.id,
            next_order.id,
            next_order.id,
        ]
