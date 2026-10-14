from datetime import UTC, datetime, timedelta
from decimal import Decimal
from typing import Literal

import pytest
from sqlalchemy import select

from polar.kit.db.postgres import AsyncSession
from polar.meter.aggregation import AggregationFunction, PropertyAggregation
from polar.models import Customer, Organization, Product, ReducerBucket
from polar.models.billing_entry import BillingEntryType
from scripts.backfill_reducer_buckets import backfill_organization
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import (
    create_billing_entry,
    create_event,
    create_meter,
    create_order,
    create_product_price_metered_unit,
    create_reducer,
)

START = datetime(2026, 10, 1, 10, 0, tzinfo=UTC)
BUCKET = timedelta(minutes=5)
END = START + 3 * BUCKET


@pytest.mark.anyio
class TestBackfillBuckets:
    async def test_billed_pending_and_unbillable_usage(
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
        await create_reducer(save_fixture, organization=organization, meters=[meter])
        price = await create_product_price_metered_unit(
            save_fixture, product=product, meter=meter
        )
        order = await create_order(
            save_fixture, customer=customer, created_at=END + timedelta(minutes=15)
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

        await usage(START, 2, "ordered")
        await usage(START + timedelta(minutes=4), 8, "ordered")
        await usage(START + BUCKET, 3, "ordered")
        await usage(START + BUCKET + timedelta(minutes=2), 5, "pending")
        await usage(START + 2 * BUCKET, 7, None)
        await usage(START - timedelta(seconds=1), 100, "ordered")
        await usage(END, 100, None)
        await usage(START, 100, None, name="not-matching")

        for _ in range(2):
            await backfill_organization(session, organization.id, START, END)
            buckets = (
                await session.scalars(
                    select(ReducerBucket).order_by(
                        ReducerBucket.bucket_start, ReducerBucket.generation
                    )
                )
            ).all()
            assert all(
                b.customer_id == customer.id
                and b.external_customer_id is None
                and b.bucket_end == b.bucket_start + BUCKET
                and b.synced_at == END
                for b in buckets
            )
            assert [
                (
                    b.bucket_start,
                    b.generation,
                    b.sealed_at,
                    b.count,
                    b.sum,
                    b.min,
                    b.max,
                )
                for b in buckets
            ] == [
                (START, 1, order.created_at, 2, Decimal(10), Decimal(2), Decimal(8)),
                (
                    START + BUCKET,
                    1,
                    order.created_at,
                    1,
                    Decimal(3),
                    Decimal(3),
                    Decimal(3),
                ),
                (START + BUCKET, 2, None, 1, Decimal(5), Decimal(5), Decimal(5)),
                (START + 2 * BUCKET, 1, None, 1, Decimal(7), Decimal(7), Decimal(7)),
            ]
