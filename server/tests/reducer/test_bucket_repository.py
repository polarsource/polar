import uuid
from datetime import UTC, datetime, timedelta

import pytest

from polar.event.system import SystemEvent
from polar.models import Customer, Meter, Organization
from polar.models.event import EventSource
from polar.models.reducer import ReducerKind
from polar.postgres import AsyncSession
from polar.reducer.bucket_repository import ReducerBucketRepository
from polar.reducer.repository import ReducerRepository
from polar.reducer.service import reducer as reducer_service
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import create_event

BUCKET_START = datetime(2026, 10, 7, 12, 5, tzinfo=UTC)
BUCKET_END = BUCKET_START + timedelta(minutes=5)


@pytest.mark.anyio
class TestAggregateEvents:
    async def test_credit_reducer_counts_the_meters_credit_events(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
        customer: Customer,
        meter: Meter,
    ) -> None:
        await reducer_service.sync_meter(session, meter)
        reducer = await ReducerRepository.from_session(session).get_by_meter_and_kind(
            meter.id, ReducerKind.credit
        )
        assert reducer is not None
        for meter_id, units in ((meter.id, 10), (meter.id, -3), (uuid.uuid4(), 100)):
            await create_event(
                save_fixture,
                organization=organization,
                source=EventSource.system,
                name=SystemEvent.meter_credited,
                timestamp=BUCKET_START,
                customer=customer,
                metadata={"meter_id": str(meter_id), "units": units, "rollover": False},
            )

        count, total, minimum, maximum = await ReducerBucketRepository.from_session(
            session
        ).aggregate_events(reducer, BUCKET_START, BUCKET_END, customer.id, None)

        assert (count, total, minimum, maximum) == (2, 7, -3, 10)
