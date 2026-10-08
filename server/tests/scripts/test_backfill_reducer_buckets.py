from datetime import UTC, datetime, timedelta
from decimal import Decimal

import pytest
import typer
from pytest_mock import MockerFixture
from sqlalchemy import select

from polar.kit.db.postgres import AsyncSession
from polar.meter.aggregation import AggregationFunction, PropertyAggregation
from polar.models import Customer, Meter, Organization, ReducerBucket
from polar.reducer.service import reducer as reducer_service
from scripts.backfill_reducer_buckets import backfill_bucket, bucket_range
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import create_event


class TestBucketRange:
    @pytest.mark.parametrize(
        ("start", "end", "expected_start", "expected_end"),
        [
            ("11:02:01", "11:13:01", "11:00", "11:15"),
            ("11:55", "12:00", "11:55", "12:00"),
            ("12:02", "12:30", "12:00", "12:05"),
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


@pytest.mark.asyncio
class TestBackfillBucket:
    async def test_range_filter_and_customer_groups(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
        meter: Meter,
        customer: Customer,
    ) -> None:
        reducer = await reducer_service.sync_meter(session, meter)
        await session.flush()
        start = datetime(2026, 10, 1, 12, 5, tzinfo=UTC)
        end = start + timedelta(minutes=5)
        for timestamp in (start - timedelta(seconds=1), start, end):
            await create_event(
                save_fixture,
                organization=organization,
                timestamp=timestamp,
                ingested_at=end + timedelta(days=1),
            )
        for event_customer, external_id in ((customer, None), (None, "unresolved")):
            await create_event(
                save_fixture,
                organization=organization,
                timestamp=start,
                customer=event_customer,
                external_customer_id=external_id,
            )
        await create_event(
            save_fixture,
            organization=organization,
            timestamp=start,
            name="other",
        )
        await backfill_bucket(session, reducer, start, end)
        await backfill_bucket(session, reducer, start, end)
        buckets = (await session.scalars(select(ReducerBucket))).all()
        assert len(buckets) == 3
        assert {(b.customer_id, b.external_customer_id) for b in buckets} == {
            (None, None),
            (customer.id, None),
            (None, "unresolved"),
        }
        assert all(
            b.bucket_start == start
            and b.count == 1
            and b.sum == 0
            and b.min is None
            and b.max is None
            and b.generation == 0
            for b in buckets
        )

    async def test_numeric_statistics_and_late_events(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
        meter: Meter,
    ) -> None:
        meter.aggregation = PropertyAggregation(
            func=AggregationFunction.avg, property="usage.tokens"
        )
        reducer = await reducer_service.sync_meter(session, meter)
        await session.flush()
        start = datetime(2026, 10, 1, tzinfo=UTC)
        end = start + timedelta(minutes=5)
        for value in (1.25, 2.5, -0.5, "3", True, None):
            await create_event(
                save_fixture,
                organization=organization,
                timestamp=start,
                metadata={"usage": {"tokens": value}},
            )
        await backfill_bucket(session, reducer, start, end)
        bucket = (await session.scalars(select(ReducerBucket))).one()
        assert (bucket.count, bucket.sum, bucket.min, bucket.max) == (
            3,
            Decimal("3.25"),
            Decimal("-0.5"),
            Decimal("2.5"),
        )
        for value in (-2, 5):
            await create_event(
                save_fixture,
                organization=organization,
                timestamp=start,
                metadata={"usage": {"tokens": value}},
            )
        expected_totals = (5, Decimal("6.25"), Decimal(-2), Decimal(5))
        for _ in range(2):
            await backfill_bucket(session, reducer, start, end)
            await session.refresh(bucket)
            assert (bucket.count, bucket.sum, bucket.min, bucket.max) == expected_totals
            assert bucket.sealed_at is None
            assert bucket.generation == 0

        bucket.sealed_at = end
        await session.flush()
        await create_event(
            save_fixture,
            organization=organization,
            timestamp=start,
            metadata={"usage": {"tokens": 10}},
        )
        await backfill_bucket(session, reducer, start, end)
        await session.refresh(bucket)
        assert (bucket.count, bucket.sum, bucket.min, bucket.max) == expected_totals
        assert bucket.sealed_at == end
