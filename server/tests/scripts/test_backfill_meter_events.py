import pytest
from sqlalchemy import func, select

from polar.kit.db.postgres import AsyncSession
from polar.meter.aggregation import (
    AggregationFunction,
    CountAggregation,
    PropertyAggregation,
)
from polar.meter.filter import Filter, FilterClause, FilterConjunction, FilterOperator
from polar.models import Event, Meter, MeterEvent, Organization
from polar.models.event import EventSource
from scripts.backfill_meter_events import run_backfill
from tests.fixtures.database import SaveFixture


@pytest.mark.asyncio
class TestBackfillMeterEvents:
    async def test_backfills_meter_events(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        organization: Organization,
    ) -> None:
        meter = Meter(
            name="Test Meter",
            organization=organization,
            filter=Filter(
                conjunction=FilterConjunction.and_,
                clauses=[
                    FilterClause(
                        property="name", operator=FilterOperator.eq, value="test.event"
                    )
                ],
            ),
            aggregation=CountAggregation(),
        )
        await save_fixture(meter)

        event1 = Event(
            name="test.event",
            source=EventSource.user,
            organization_id=organization.id,
            user_metadata={},
        )
        await save_fixture(event1)
        event2 = Event(
            name="test.event",
            source=EventSource.user,
            organization_id=organization.id,
            user_metadata={},
        )
        await save_fixture(event2)
        event3 = Event(
            name="other.event",
            source=EventSource.user,
            organization_id=organization.id,
            user_metadata={},
        )
        await save_fixture(event3)

        result = await run_backfill(batch_size=10, session=session)

        meter_events_count = (
            await session.execute(
                select(func.count())
                .select_from(MeterEvent)
                .where(MeterEvent.meter_id == meter.id)
            )
        ).scalar_one()
        assert meter_events_count == 2
        assert result["total_inserted"] >= 2

    async def test_backfill_is_idempotent(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        organization: Organization,
    ) -> None:
        meter = Meter(
            name="Test Meter",
            organization=organization,
            filter=Filter(
                conjunction=FilterConjunction.and_,
                clauses=[
                    FilterClause(
                        property="name", operator=FilterOperator.eq, value="test.event"
                    )
                ],
            ),
            aggregation=CountAggregation(),
        )
        await save_fixture(meter)

        event = Event(
            name="test.event",
            source=EventSource.user,
            organization_id=organization.id,
            user_metadata={},
        )
        await save_fixture(event)

        await run_backfill(batch_size=10, session=session)
        first_count = (
            await session.execute(
                select(func.count())
                .select_from(MeterEvent)
                .where(MeterEvent.meter_id == meter.id)
            )
        ).scalar_one()

        await run_backfill(batch_size=10, session=session)
        second_count = (
            await session.execute(
                select(func.count())
                .select_from(MeterEvent)
                .where(MeterEvent.meter_id == meter.id)
            )
        ).scalar_one()

        assert first_count == 1
        assert second_count == 1

    async def test_backfill_with_property_aggregation(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        organization: Organization,
    ) -> None:
        meter = Meter(
            name="Property Meter",
            organization=organization,
            filter=Filter(
                conjunction=FilterConjunction.and_,
                clauses=[
                    FilterClause(
                        property="name", operator=FilterOperator.eq, value="usage.event"
                    )
                ],
            ),
            aggregation=PropertyAggregation(
                func=AggregationFunction.sum, property="tokens"
            ),
        )
        await save_fixture(meter)

        valid_event = Event(
            name="usage.event",
            source=EventSource.user,
            organization_id=organization.id,
            user_metadata={"tokens": 100},
        )
        await save_fixture(valid_event)

        invalid_event = Event(
            name="usage.event",
            source=EventSource.user,
            organization_id=organization.id,
            user_metadata={"tokens": "invalid"},
        )
        await save_fixture(invalid_event)

        await run_backfill(batch_size=10, session=session)

        meter_events_count = (
            await session.execute(
                select(func.count())
                .select_from(MeterEvent)
                .where(MeterEvent.meter_id == meter.id)
            )
        ).scalar_one()
        assert meter_events_count == 1

        meter_event = (
            await session.execute(
                select(MeterEvent).where(MeterEvent.meter_id == meter.id)
            )
        ).scalar_one()
        assert meter_event.event_id == valid_event.id
