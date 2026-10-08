from datetime import UTC, datetime, timedelta
from decimal import Decimal
from uuid import uuid4

import pytest
import typer
from pytest_mock import MockerFixture
from sqlalchemy import select

from polar.kit.db.postgres import AsyncSession
from polar.meter.aggregation import AggregationFunction, PropertyAggregation
from polar.models import (
    BillingEntry,
    Customer,
    Meter,
    Organization,
    Product,
    ReducerBucket,
)
from polar.models.billing_entry import BillingEntryType
from polar.models.event import EventSource
from polar.reducer.service import reducer as reducer_service
from scripts.backfill_reducer_buckets import backfill_bucket, bucket_range, get_reducers
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import (
    create_billing_entry,
    create_event,
    create_meter,
    create_order,
    create_product_price_metered_unit,
)


class TestBucketRange:
    @pytest.mark.parametrize(
        ("start", "end", "expected_start", "expected_end"),
        [
            ("11:02:01", "11:13:01", "11:00", "11:15"),
            ("11:55", "12:00", "11:55", "12:00"),
            ("11:58", "12:30", "11:55", "12:00"),
        ],
    )
    def test_full_buckets_and_cutoff(
        self,
        mocker: MockerFixture,
        start: str,
        end: str,
        expected_start: str,
        expected_end: str,
    ) -> None:
        mocker.patch(
            "scripts.backfill_reducer_buckets.utc_now",
            return_value=datetime(2026, 10, 7, 12, 13, tzinfo=UTC),
        )
        assert bucket_range(
            datetime.fromisoformat(f"2026-10-07T{start}"),
            datetime.fromisoformat(f"2026-10-07T{end}"),
        ) == (
            datetime.fromisoformat(f"2026-10-07T{expected_start}+00:00"),
            datetime.fromisoformat(f"2026-10-07T{expected_end}+00:00"),
        )

    def test_reversed_range(self) -> None:
        with pytest.raises(typer.BadParameter, match="start must be before end"):
            bucket_range(
                datetime(2026, 10, 8, tzinfo=UTC), datetime(2026, 10, 7, tzinfo=UTC)
            )


@pytest.mark.anyio
class TestBackfillBucket:
    async def test_order_generations_and_reruns(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
        meter: Meter,
        customer: Customer,
        product: Product,
    ) -> None:
        meter.aggregation = PropertyAggregation(
            func=AggregationFunction.avg, property="usage.tokens"
        )
        reducer = await reducer_service.sync_meter(session, meter)
        price = await create_product_price_metered_unit(
            save_fixture, product=product, meter=meter
        )
        start = datetime(2026, 10, 1, tzinfo=UTC)
        end = start + timedelta(minutes=5)
        first_order = await create_order(
            save_fixture, customer=customer, created_at=end + timedelta(days=30)
        )
        second_order = await create_order(
            save_fixture, customer=customer, created_at=end + timedelta(days=60)
        )
        pending: list[BillingEntry] = []
        for order, value in (
            (first_order, 1.25),
            (first_order, 2.75),
            (second_order, -2),
            (None, 5),
            (None, 7),
        ):
            event = await create_event(
                save_fixture,
                organization=organization,
                timestamp=start,
                ingested_at=end + timedelta(days=60),
                external_customer_id="resolved-by-billing",
                metadata={"usage": {"tokens": value}},
            )
            entry = await create_billing_entry(
                save_fixture,
                type=BillingEntryType.metered,
                customer=customer,
                product_price=price,
                event=event,
                order_item=order.items[0] if order else None,
            )
            if order is None:
                pending.append(entry)

        for _ in range(2):
            await backfill_bucket(session, reducer, start, end)
            buckets = (
                await session.scalars(
                    select(ReducerBucket).order_by(ReducerBucket.generation)
                )
            ).all()
            assert [
                (b.generation, b.sealed_at, b.count, b.sum, b.min, b.max)
                for b in buckets
            ] == [
                (
                    1,
                    first_order.created_at,
                    2,
                    Decimal(4),
                    Decimal("1.25"),
                    Decimal("2.75"),
                ),
                (2, second_order.created_at, 1, Decimal(-2), Decimal(-2), Decimal(-2)),
                (3, None, 2, Decimal(12), Decimal(5), Decimal(7)),
            ]
            assert all(
                b.customer_id == customer.id and b.external_customer_id is None
                for b in buckets
            )

        third_order = await create_order(
            save_fixture, customer=customer, created_at=end + timedelta(days=90)
        )
        for index, entry in enumerate(pending):
            entry.order_item = third_order.items[0]
            await backfill_bucket(session, reducer, start, end)
            buckets = (
                await session.scalars(
                    select(ReducerBucket).order_by(ReducerBucket.generation)
                )
            ).all()
            assert [
                (b.generation, b.sealed_at, b.count, b.sum) for b in buckets[:3]
            ] == [
                (1, first_order.created_at, 2, Decimal(4)),
                (2, second_order.created_at, 1, Decimal(-2)),
                (
                    3,
                    third_order.created_at,
                    index + 1,
                    Decimal(5 if index == 0 else 12),
                ),
            ]
            assert [(b.generation, b.sealed_at, b.sum) for b in buckets[3:]] == (
                [(4, None, Decimal(7))] if index == 0 else []
            )

    async def test_entry_filters_and_customer_scope(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
        meter: Meter,
        customer: Customer,
        customer_second: Customer,
        product: Product,
    ) -> None:
        reducer = await reducer_service.sync_meter(session, meter)
        price = await create_product_price_metered_unit(
            save_fixture, product=product, meter=meter
        )
        other_meter = await create_meter(
            save_fixture, organization=organization, id=uuid4()
        )
        other_price = await create_product_price_metered_unit(
            save_fixture, product=product, meter=other_meter
        )
        start = datetime(2026, 10, 1, tzinfo=UTC)
        end = start + timedelta(minutes=5)
        for label in (
            "included",
            "raw",
            "system",
            "static",
            "deleted",
            "other_meter",
            "before",
            "after",
        ):
            event = await create_event(
                save_fixture,
                organization=organization,
                timestamp=(
                    start - timedelta(seconds=1)
                    if label == "before"
                    else end
                    if label == "after"
                    else start
                ),
                name="already-selected-by-billing",
                source=EventSource.system if label == "system" else EventSource.user,
            )
            if label == "raw":
                continue
            entry = await create_billing_entry(
                save_fixture,
                type=BillingEntryType.cycle
                if label == "static"
                else BillingEntryType.metered,
                customer=customer,
                product_price=other_price if label == "other_meter" else price,
                event=event,
            )
            if label == "deleted":
                entry.deleted_at = end

        customer.external_id = "legacy-external-id"
        await save_fixture(
            ReducerBucket(
                organization=organization,
                reducer=reducer,
                external_customer_id=customer.external_id,
                bucket_start=start,
                generation=0,
                count=100,
            )
        )
        untouched = ReducerBucket(
            organization=organization,
            reducer=reducer,
            customer=customer_second,
            bucket_start=start,
            generation=1,
            count=50,
        )
        outside_range = ReducerBucket(
            organization=organization,
            reducer=reducer,
            customer=customer,
            bucket_start=end,
            generation=1,
            count=25,
        )
        await save_fixture(untouched)
        await save_fixture(outside_range)
        await backfill_bucket(session, reducer, start, end, customer_id=customer.id)
        await session.refresh(untouched)
        await session.refresh(outside_range)
        assert untouched.count == 50
        assert outside_range.count == 25
        assert len((await session.scalars(select(ReducerBucket))).all()) == 3
        bucket = (
            await session.scalars(
                select(ReducerBucket).where(
                    ReducerBucket.customer_id == customer.id,
                    ReducerBucket.bucket_start == start,
                )
            )
        ).one()
        assert (bucket.count, bucket.sum, bucket.min, bucket.max) == (
            1,
            Decimal(0),
            None,
            None,
        )
        assert bucket.generation == 1
        assert bucket.sealed_at is None

    async def test_order_timestamp_ties(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
        meter: Meter,
        customer: Customer,
        product: Product,
    ) -> None:
        reducer = await reducer_service.sync_meter(session, meter)
        price = await create_product_price_metered_unit(
            save_fixture, product=product, meter=meter
        )
        start = datetime(2026, 10, 1, tzinfo=UTC)
        end = start + timedelta(minutes=5)
        orders = [
            await create_order(save_fixture, customer=customer, created_at=end)
            for _ in range(2)
        ]
        for count, order in enumerate(sorted(orders, key=lambda order: order.id), 1):
            for _ in range(count):
                event = await create_event(
                    save_fixture, organization=organization, timestamp=start
                )
                await create_billing_entry(
                    save_fixture,
                    type=BillingEntryType.metered,
                    customer=customer,
                    product_price=price,
                    event=event,
                    order_item=order.items[0],
                )
        await backfill_bucket(session, reducer, start, end)
        buckets = (
            await session.scalars(
                select(ReducerBucket).order_by(ReducerBucket.generation)
            )
        ).all()
        assert [(b.generation, b.count, b.sealed_at) for b in buckets] == [
            (1, 1, end),
            (2, 2, end),
        ]


@pytest.mark.asyncio
class TestBackfillScope:
    async def test_organization_and_meter(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
        organization_second: Organization,
        meter: Meter,
    ) -> None:
        reducer = await reducer_service.sync_meter(session, meter)
        other_meter = await create_meter(
            save_fixture, organization=organization_second, id=uuid4()
        )
        other_reducer = await reducer_service.sync_meter(session, other_meter)
        assert await get_reducers(
            session, organization_id=organization.id, meter_id=None
        ) == [reducer]
        assert await get_reducers(
            session, organization_id=None, meter_id=other_meter.id
        ) == [other_reducer]
        assert (
            await get_reducers(
                session, organization_id=organization.id, meter_id=other_meter.id
            )
            == []
        )
