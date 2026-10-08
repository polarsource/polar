from datetime import UTC, datetime, timedelta
from decimal import Decimal
from uuid import uuid4

import pytest
import typer
from pytest_mock import MockerFixture
from sqlalchemy import select

from polar.auth.models import AuthSubject
from polar.customer_meter.service import customer_meter as customer_meter_service
from polar.enums import SubscriptionRecurringInterval
from polar.event.schemas import EventCreateCustomer, EventsIngest
from polar.event.service import event as event_service
from polar.kit.db.postgres import AsyncSession
from polar.kit.utils import utc_now
from polar.meter.aggregation import AggregationFunction, PropertyAggregation
from polar.meter.service import meter as meter_service
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
from scripts.backfill_reducer_buckets import (
    backfill_bucket,
    bucket_range,
    floor_bucket,
    get_reducers,
)
from tests.fixtures.auth import AuthSubjectFixture
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import (
    METER_TEST_EVENT,
    create_billing_entry,
    create_event,
    create_meter,
    create_order,
    create_product,
    create_product_price_metered_unit,
    create_trialing_subscription,
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
    @pytest.mark.auth(AuthSubjectFixture(subject="organization"))
    @pytest.mark.parametrize("trial", [False, True])
    async def test_nonbillable_usage(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        auth_subject: AuthSubject[Organization],
        organization: Organization,
        customer: Customer,
        meter: Meter,
        mocker: MockerFixture,
        trial: bool,
    ) -> None:
        mocker.patch("polar.event.service.enqueue_job")
        mocker.patch("polar.event.service.enqueue_events")
        reducer = await reducer_service.sync_meter(session, meter)
        if trial:
            product = await create_product(
                save_fixture,
                organization=organization,
                recurring_interval=SubscriptionRecurringInterval.month,
                prices=[(meter, Decimal(100), None, "usd")],
            )
            await create_trialing_subscription(
                save_fixture, product=product, customer=customer
            )
        timestamp = utc_now()
        await event_service.ingest(
            session,
            auth_subject,
            EventsIngest(
                events=[
                    EventCreateCustomer(
                        name=METER_TEST_EVENT,
                        customer_id=customer.id,
                        timestamp=timestamp,
                    )
                ]
            ),
        )
        assert await meter_service.create_billing_entries(session, meter) == []
        assert meter.last_billed_event is not None
        assert (
            await customer_meter_service._get_usage_quantity(session, customer, meter)
            == 1
        )
        start = floor_bucket(timestamp)
        for _ in range(2):
            assert (
                await backfill_bucket(
                    session, reducer, start, start + timedelta(minutes=5)
                )
                == 1
            )
            bucket = (await session.scalars(select(ReducerBucket))).one()
            assert bucket.customer_id == customer.id
            assert bucket.count == 1
            assert bucket.sealed_at is None

    async def test_usage_and_billing_generations(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
        organization_second: Organization,
        customer: Customer,
        meter: Meter,
        product: Product,
    ) -> None:
        meter.aggregation = PropertyAggregation(
            func=AggregationFunction.avg, property="usage.tokens"
        )
        reducer = await reducer_service.sync_meter(session, meter)
        price = await create_product_price_metered_unit(
            save_fixture, product=product, meter=meter
        )
        other_meter = await create_meter(
            save_fixture, organization=organization, id=uuid4()
        )
        await reducer_service.sync_meter(session, other_meter)
        other_price = await create_product_price_metered_unit(
            save_fixture, product=product, meter=other_meter
        )
        start = datetime(2026, 10, 1, tzinfo=UTC)
        end = start + timedelta(minutes=5)
        order = await create_order(save_fixture, customer=customer, created_at=end)
        events = []
        for value in (2, 8, 3, 5):
            events.append(
                await create_event(
                    save_fixture,
                    organization=organization,
                    customer=customer,
                    timestamp=start,
                    metadata={"usage": {"tokens": value}},
                )
            )
        await create_billing_entry(
            save_fixture,
            type=BillingEntryType.metered,
            customer=customer,
            product_price=other_price,
            event=events[1],
        )
        await create_billing_entry(
            save_fixture,
            type=BillingEntryType.metered,
            customer=customer,
            product_price=price,
            event=events[2],
            order_item=order.items[0],
        )
        await create_billing_entry(
            save_fixture,
            type=BillingEntryType.metered,
            customer=customer,
            product_price=price,
            event=events[3],
        )
        for excluded in ("filter", "system", "before", "after", "organization", "type"):
            await create_event(
                save_fixture,
                organization=organization_second
                if excluded == "organization"
                else organization,
                customer=None if excluded == "organization" else customer,
                name="not-matching" if excluded == "filter" else METER_TEST_EVENT,
                source=EventSource.system if excluded == "system" else EventSource.user,
                timestamp=start - timedelta(seconds=1)
                if excluded == "before"
                else end
                if excluded == "after"
                else start,
                metadata={
                    "usage": {"tokens": "invalid" if excluded == "type" else 100}
                },
            )
        for _ in range(2):
            await backfill_bucket(session, reducer, start, end)
            buckets = (
                await session.scalars(
                    select(ReducerBucket).order_by(ReducerBucket.generation)
                )
            ).all()
            assert [(b.count, b.sum, b.min, b.max) for b in buckets] == [
                (1, Decimal(3), Decimal(3), Decimal(3)),
                (3, Decimal(15), Decimal(2), Decimal(8)),
            ]
            assert buckets[0].sealed_at == order.created_at
            assert buckets[1].sealed_at is None
        await create_billing_entry(
            save_fixture,
            type=BillingEntryType.metered,
            customer=customer,
            product_price=price,
            event=events[0],
        )
        await backfill_bucket(session, reducer, start, end)
        buckets = (
            await session.scalars(
                select(ReducerBucket).order_by(ReducerBucket.generation)
            )
        ).all()
        assert [(b.count, b.sum, b.min, b.max) for b in buckets] == [
            (1, Decimal(3), Decimal(3), Decimal(3)),
            (3, Decimal(15), Decimal(2), Decimal(8)),
        ]

    async def test_usage_external_identities_and_customer_scope(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
        customer: Customer,
        customer_second: Customer,
        meter: Meter,
    ) -> None:
        reducer = await reducer_service.sync_meter(session, meter)
        customer.external_id = "known"
        start = datetime(2026, 10, 1, tzinfo=UTC)
        end = start + timedelta(minutes=5)
        for external_id in ("known", "unresolved-a", "unresolved-b"):
            await create_event(
                save_fixture,
                organization=organization,
                external_customer_id=external_id,
                timestamp=start,
            )
        for event_customer in (customer, customer_second):
            await create_event(
                save_fixture,
                organization=organization,
                customer=event_customer,
                timestamp=start,
            )
        assert await backfill_bucket(session, reducer, start, end) == 5
        buckets = (await session.scalars(select(ReducerBucket))).all()
        assert {
            (b.customer_id, b.external_customer_id, b.count, b.generation)
            for b in buckets
        } == {
            (customer.id, None, 1, 1),
            (customer_second.id, None, 1, 1),
            (None, "known", 1, 1),
            (None, "unresolved-a", 1, 1),
            (None, "unresolved-b", 1, 1),
        }
        untouched_ids = {
            b.id
            for b in buckets
            if b.customer_id != customer.id and b.external_customer_id != "known"
        }
        await create_event(
            save_fixture,
            organization=organization,
            external_customer_id="known",
            timestamp=start,
        )
        assert (
            await backfill_bucket(session, reducer, start, end, customer_id=customer.id)
            == 2
        )
        buckets = (await session.scalars(select(ReducerBucket))).all()
        assert len(buckets) == 5
        assert untouched_ids <= {b.id for b in buckets}
        assert next(b.count for b in buckets if b.external_customer_id == "known") == 2

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
