import uuid

import pytest
from sqlalchemy import func, select

from polar.meter.aggregation import CountAggregation
from polar.meter.filter import Filter, FilterClause, FilterConjunction, FilterOperator
from polar.meter.tasks import MeterDoesNotExist, meter_backfill_events
from polar.models import MeterEvent, Organization
from polar.postgres import AsyncSession
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import create_customer, create_event, create_meter


@pytest.mark.asyncio
class TestMeterBackfillEvents:
    async def test_not_existing_meter(self, session: AsyncSession) -> None:
        session.expunge_all()

        with pytest.raises(MeterDoesNotExist):
            await meter_backfill_events(uuid.uuid4())

    async def test_backfills_matching_events(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        organization: Organization,
    ) -> None:
        customer = await create_customer(save_fixture, organization=organization)

        matching_event1 = await create_event(
            save_fixture,
            organization=organization,
            customer=customer,
            name="test.event",
        )
        matching_event2 = await create_event(
            save_fixture,
            organization=organization,
            customer=customer,
            name="test.event",
        )
        non_matching_event = await create_event(
            save_fixture,
            organization=organization,
            customer=customer,
            name="other.event",
        )

        meter = await create_meter(
            save_fixture,
            organization=organization,
            filter=Filter(
                conjunction=FilterConjunction.and_,
                clauses=[
                    FilterClause(
                        property="name",
                        operator=FilterOperator.eq,
                        value="test.event",
                    )
                ],
            ),
            aggregation=CountAggregation(),
        )

        session.expunge_all()

        await meter_backfill_events(meter.id)

        count_result = await session.execute(
            select(func.count())
            .select_from(MeterEvent)
            .where(MeterEvent.meter_id == meter.id)
        )
        meter_events_count = count_result.scalar_one()
        assert meter_events_count == 2

        events_result = await session.execute(
            select(MeterEvent.event_id).where(MeterEvent.meter_id == meter.id)
        )
        event_ids = {row[0] for row in events_result.all()}
        assert matching_event1.id in event_ids
        assert matching_event2.id in event_ids
        assert non_matching_event.id not in event_ids

    async def test_idempotent(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        organization: Organization,
    ) -> None:
        customer = await create_customer(save_fixture, organization=organization)

        await create_event(
            save_fixture,
            organization=organization,
            customer=customer,
            name="test.event",
        )

        meter = await create_meter(
            save_fixture,
            organization=organization,
            filter=Filter(
                conjunction=FilterConjunction.and_,
                clauses=[
                    FilterClause(
                        property="name",
                        operator=FilterOperator.eq,
                        value="test.event",
                    )
                ],
            ),
            aggregation=CountAggregation(),
        )

        session.expunge_all()

        await meter_backfill_events(meter.id)
        await meter_backfill_events(meter.id)

        count_result = await session.execute(
            select(func.count())
            .select_from(MeterEvent)
            .where(MeterEvent.meter_id == meter.id)
        )
        meter_events_count = count_result.scalar_one()
        assert meter_events_count == 1
