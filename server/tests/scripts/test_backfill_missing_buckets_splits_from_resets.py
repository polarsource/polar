from datetime import UTC, datetime, timedelta
from decimal import Decimal

import pytest
from sqlalchemy import select

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


@pytest.fixture
async def customer_meter(
    save_fixture: SaveFixture,
    organization: Organization,
    customer: Customer,
    meter: Meter,
) -> CustomerMeter:
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
        bucket_start = reset - timedelta(minutes=2)
        await save_fixture(
            ReducerBucket(
                organization=organization,
                reducer=reducer,
                customer_id=customer.id,
                bucket_start=bucket_start,
                bucket_end=bucket_start + REDUCER_BUCKET_SIZE,
                count=1,
                sum=Decimal(1),
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

    async def test_split_makes_the_reset_a_bucket_boundary(
        self, session: AsyncSession, customer_meter: CustomerMeter
    ) -> None:
        assert await split(
            session, customer_meter.customer_id, customer_meter.meter_id, LATEST_RESET
        )

        assert await find_missing_splits(session) == []
        boundaries = (
            await session.execute(
                select(ReducerBucket.bucket_start, ReducerBucket.bucket_end)
                .where(
                    ReducerBucket.bucket_start >= LATEST_RESET - timedelta(minutes=2)
                )
                .order_by(ReducerBucket.bucket_start)
            )
        ).all()
        assert [tuple(boundary) for boundary in boundaries] == [
            (LATEST_RESET - timedelta(minutes=2), LATEST_RESET),
            (LATEST_RESET, LATEST_RESET + timedelta(minutes=3)),
        ]
