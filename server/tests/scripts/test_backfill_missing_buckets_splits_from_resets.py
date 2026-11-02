from datetime import UTC, datetime, timedelta

import pytest
from sqlalchemy import select, update

from polar.event.system import SystemEvent
from polar.kit.db.postgres import AsyncSession
from polar.models import Customer, CustomerMeter, Meter, Organization, ReducerBucket
from polar.models.event import EventSource
from polar.reducer.service import REDUCER_BUCKET_SIZE
from scripts.backfill_missing_buckets_splits_from_resets import (
    find_missing_splits,
    split,
)
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import create_event, create_reducer

PREVIOUS_RESET = datetime(2026, 10, 1, 11, 2, tzinfo=UTC)
LATEST_RESET = datetime(2026, 10, 1, 12, 2, tzinfo=UTC)
LATEST_BUCKET_START = LATEST_RESET - timedelta(minutes=2)


@pytest.fixture
async def customer_meter(
    save_fixture: SaveFixture,
    organization: Organization,
    customer: Customer,
    meter: Meter,
) -> CustomerMeter:
    """A reset inside each of two usage buckets, each with an event on both sides
    of it."""
    reducer = await create_reducer(
        save_fixture, organization=organization, meters=[meter]
    )
    for reset in (PREVIOUS_RESET, LATEST_RESET):
        await create_event(
            save_fixture,
            organization=organization,
            customer=customer,
            source=EventSource.system,
            name=SystemEvent.meter_reset,
            timestamp=reset,
            metadata={"meter_id": str(meter.id)},
        )
        for timestamp in (reset - timedelta(minutes=1), reset + timedelta(minutes=1)):
            await create_event(
                save_fixture,
                organization=organization,
                customer=customer,
                timestamp=timestamp,
            )
        bucket_start = reset - timedelta(minutes=2)
        await save_fixture(
            ReducerBucket(
                organization=organization,
                reducer=reducer,
                customer_id=customer.id,
                bucket_start=bucket_start,
                bucket_end=bucket_start + REDUCER_BUCKET_SIZE,
                count=2,
            )
        )
    customer_meter = CustomerMeter(customer=customer, meter=meter)
    await save_fixture(customer_meter)
    return customer_meter


@pytest.mark.anyio
class TestBackfillMissingBucketsSplitsFromResets:
    async def test_finds_the_latest_reset_inside_a_usage_bucket(
        self, session: AsyncSession, customer_meter: CustomerMeter
    ) -> None:
        assert [tuple(row) for row in await find_missing_splits(session)] == [
            (customer_meter.customer_id, customer_meter.meter_id, LATEST_RESET)
        ]

    async def test_split_divides_the_usage_at_the_reset(
        self, session: AsyncSession, customer_meter: CustomerMeter
    ) -> None:
        assert await split(
            session, customer_meter.customer_id, customer_meter.meter_id, LATEST_RESET
        )

        assert await find_missing_splits(session) == []
        buckets = (
            await session.execute(
                select(
                    ReducerBucket.bucket_start,
                    ReducerBucket.bucket_end,
                    ReducerBucket.count,
                )
                .where(ReducerBucket.bucket_start >= LATEST_BUCKET_START)
                .order_by(ReducerBucket.bucket_start)
            )
        ).all()
        assert [tuple(bucket) for bucket in buckets] == [
            (LATEST_BUCKET_START, LATEST_RESET, 1),
            (LATEST_RESET, LATEST_BUCKET_START + REDUCER_BUCKET_SIZE, 1),
        ]

    async def test_reports_a_sealed_bucket_as_not_split(
        self, session: AsyncSession, customer_meter: CustomerMeter
    ) -> None:
        await session.execute(
            update(ReducerBucket)
            .where(ReducerBucket.bucket_start == LATEST_BUCKET_START)
            .values(sealed_at=LATEST_RESET)
        )

        assert not await split(
            session, customer_meter.customer_id, customer_meter.meter_id, LATEST_RESET
        )
        assert [tuple(row) for row in await find_missing_splits(session)] == [
            (customer_meter.customer_id, customer_meter.meter_id, LATEST_RESET)
        ]
