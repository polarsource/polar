from datetime import UTC, datetime, timedelta
from decimal import Decimal

import pytest
from pytest_mock import MockerFixture
from sqlalchemy import literal, select

from polar.meter.aggregation import (
    AggregationFunction,
    CountAggregation,
    PropertyAggregation,
)
from polar.models import Customer, Meter, Organization, ReducerBucket
from polar.postgres import AsyncSession
from polar.redis import Redis
from polar.reducer.service import reducer as reducer_service
from polar.reducer_bucket.service import get_reducer_bucket_key
from polar.reducer_bucket.service import reducer_bucket as reducer_bucket_service
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import create_event, create_reducer

BASE = datetime(2026, 10, 8, 12, tzinfo=UTC)


class TestGetQuantity:
    @pytest.mark.parametrize(
        ("function", "expected"),
        [
            (AggregationFunction.cnt, Decimal(9)),
            (AggregationFunction.sum, Decimal(49)),
            (AggregationFunction.avg, Decimal(49) / 9),
            (AggregationFunction.min, Decimal(-2)),
            (AggregationFunction.max, Decimal(20)),
        ],
    )
    async def test_buckets_generations_and_edges(
        self,
        function: AggregationFunction,
        expected: Decimal,
        mocker: MockerFixture,
        session: AsyncSession,
        reducer_redis: Redis,
        save_fixture: SaveFixture,
        organization: Organization,
        customer: Customer,
        meter: Meter,
    ) -> None:
        if function == AggregationFunction.cnt:
            meter.aggregation = CountAggregation()
        else:
            assert function in (
                AggregationFunction.sum,
                AggregationFunction.avg,
                AggregationFunction.min,
                AggregationFunction.max,
            )
            meter.aggregation = PropertyAggregation(func=function, property="tokens")
        reducer = await create_reducer(
            save_fixture, organization=organization, meters=[meter]
        )
        mocker.patch(
            "polar.reducer.service.utc_now", return_value=BASE + timedelta(minutes=16)
        )
        for start, generation, sealed, count, total, minimum, maximum in (
            (BASE - timedelta(days=1), 0, BASE, 100, 1000, 10, 10),
            (BASE - timedelta(days=1), 1, None, 1, 7, 7, 7),
            (BASE, 0, None, 999, 999, 999, 999),
            (BASE + timedelta(minutes=5), 0, None, 2, 30, 10, 20),
            (BASE + timedelta(minutes=10), 0, None, 999, 999, 999, 999),
        ):
            await save_fixture(
                ReducerBucket(
                    organization=organization,
                    reducer=reducer,
                    customer=customer,
                    bucket_start=start,
                    generation=generation,
                    sealed_at=sealed,
                    count=count,
                    sum=Decimal(total),
                    min=Decimal(minimum),
                    max=Decimal(maximum),
                )
            )
        for minute, tokens in (
            (1, 900),
            (2, 1),
            (4, 2),
            (6, 900),
            (15, 3),
            (17, 4),
            (18, 900),
        ):
            await create_event(
                save_fixture,
                organization=organization,
                customer=customer,
                timestamp=BASE + timedelta(minutes=minute),
                metadata={"tokens": tokens},
            )
        active_events = [
            await create_event(
                save_fixture,
                organization=organization,
                customer=customer,
                timestamp=BASE + timedelta(minutes=10),
                metadata={"tokens": tokens},
            )
            for tokens in (-2, 4)
        ]
        await reducer_bucket_service.rollup_active(
            reducer_redis, organization.id, [reducer], active_events
        )

        quantity = await reducer_service.get_quantity(
            session,
            reducer_redis,
            meter_id=meter.id,
            customer_id=customer.id,
            start=BASE + timedelta(minutes=2),
            end=BASE + timedelta(minutes=18),
        )

        assert quantity == expected

    @pytest.mark.parametrize("store", ["postgres", "redis"])
    async def test_reads_buckets_without_raw_events(
        self,
        store: str,
        mocker: MockerFixture,
        session: AsyncSession,
        reducer_redis: Redis,
        save_fixture: SaveFixture,
        organization: Organization,
        customer: Customer,
        meter: Meter,
    ) -> None:
        reducer = await create_reducer(
            save_fixture, organization=organization, meters=[meter]
        )
        mocker.patch(
            "polar.reducer.service.utc_now", return_value=BASE + timedelta(minutes=16)
        )
        start = BASE if store == "postgres" else BASE + timedelta(minutes=10)
        if store == "postgres":
            await save_fixture(
                ReducerBucket(
                    organization=organization,
                    reducer=reducer,
                    customer=customer,
                    bucket_start=start,
                    count=7,
                )
            )
        else:
            await reducer_redis.set(
                get_reducer_bucket_key(reducer.id, start, customer.id, None), 7
            )

        quantity = await reducer_service.get_quantity(
            session,
            reducer_redis,
            meter_id=meter.id,
            customer_id=customer.id,
            start=start,
            end=start + timedelta(minutes=5),
        )

        assert quantity == 7

    async def test_window_inside_one_bucket_reads_events_once(
        self,
        session: AsyncSession,
        reducer_redis: Redis,
        save_fixture: SaveFixture,
        organization: Organization,
        customer: Customer,
        meter: Meter,
    ) -> None:
        await create_reducer(save_fixture, organization=organization, meters=[meter])
        for minute in (1, 2, 3, 4):
            await create_event(
                save_fixture,
                organization=organization,
                customer=customer,
                timestamp=BASE + timedelta(minutes=minute),
            )

        quantity = await reducer_service.get_quantity(
            session,
            reducer_redis,
            meter_id=meter.id,
            customer_id=customer.id,
            start=BASE + timedelta(minutes=2),
            end=BASE + timedelta(minutes=4),
        )

        assert quantity == 2

    async def test_customer_identities(
        self,
        session: AsyncSession,
        reducer_redis: Redis,
        save_fixture: SaveFixture,
        organization: Organization,
        customer: Customer,
        customer_second: Customer,
        meter: Meter,
        mocker: MockerFixture,
    ) -> None:
        customer.external_id = "external"
        await save_fixture(customer)
        reducer = await create_reducer(
            save_fixture, organization=organization, meters=[meter]
        )
        mocker.patch(
            "polar.reducer.service.utc_now", return_value=BASE + timedelta(minutes=16)
        )
        for event_customer, external_id in (
            (customer, None),
            (None, "external"),
            (customer, "external"),
            (customer_second, None),
        ):
            await save_fixture(
                ReducerBucket(
                    organization=organization,
                    reducer=reducer,
                    customer=event_customer,
                    external_customer_id=external_id,
                    bucket_start=BASE,
                    count=1,
                )
            )
            await reducer_redis.set(
                get_reducer_bucket_key(
                    reducer.id,
                    BASE + timedelta(minutes=10),
                    event_customer.id if event_customer else None,
                    external_id,
                ),
                1,
            )

        quantity = await reducer_service.get_quantity(
            session,
            reducer_redis,
            meter_id=meter.id,
            customer_id=customer.id,
            start=None,
            end=BASE + timedelta(minutes=15),
        )

        assert quantity == 6


class TestCompareQuantity:
    async def test_records_whole_unit_difference_at_large_sum(
        self,
        mocker: MockerFixture,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
        customer: Customer,
        meter: Meter,
    ) -> None:
        meter.aggregation = PropertyAggregation(
            func=AggregationFunction.sum, property="tokens"
        )
        reducer = await create_reducer(
            save_fixture, organization=organization, meters=[meter]
        )
        await save_fixture(
            ReducerBucket(
                organization=organization,
                reducer=reducer,
                customer=customer,
                bucket_start=BASE,
                count=1,
                sum=Decimal(1000000001),
            )
        )
        mocker.patch(
            "polar.reducer.service.utc_now", return_value=BASE + timedelta(minutes=16)
        )
        span = mocker.patch(
            "polar.reducer.service.logfire.span"
        ).return_value.__enter__.return_value

        await reducer_service.compare_quantity(
            session,
            meter_id=meter.id,
            customer_id=customer.id,
            start=BASE,
            end=BASE + timedelta(minutes=5),
            expected=Decimal(1000000000),
            consumer="test",
        )

        attributes = dict(call.args for call in span.set_attribute.call_args_list)
        assert attributes["comparison_status"] == "mismatch"
        assert attributes["difference"] == "1"

    async def test_failure_preserves_transaction(
        self,
        mocker: MockerFixture,
        session: AsyncSession,
        meter: Meter,
        customer: Customer,
    ) -> None:
        async def fail(*args: object, **kwargs: object) -> None:
            await session.execute(select(literal(1) / literal(0)))

        mocker.patch.object(reducer_service, "get_quantity", side_effect=fail)
        span = mocker.patch(
            "polar.reducer.service.logfire.span"
        ).return_value.__enter__.return_value

        await reducer_service.compare_quantity(
            session,
            meter_id=meter.id,
            customer_id=customer.id,
            start=BASE,
            end=BASE + timedelta(minutes=5),
            expected=0,
            consumer="test",
        )

        assert await session.scalar(select(1)) == 1
        attributes = dict(call.args for call in span.set_attribute.call_args_list)
        assert attributes["comparison_status"] == "error"
