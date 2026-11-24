from datetime import timedelta
from decimal import Decimal

import pytest
from sqlalchemy import select

from polar.event.system import SystemEvent
from polar.kit.db.postgres import AsyncSession
from polar.kit.utils import utc_now
from polar.models import Customer, CustomerMeter, Event, Meter, Organization
from polar.models.event import EventSource
from polar.redis import Redis
from polar.reducer.service import reducer as reducer_service
from scripts.compensate_meter_credit_clawbacks import CompensationMismatch, compensate
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import create_event


async def setup_credits(
    save_fixture: SaveFixture,
    session: AsyncSession,
    organization: Organization,
    customer: Customer,
    meter: Meter,
    units: list[int],
    *,
    billed: bool = True,
) -> tuple[CustomerMeter, list[Event]]:
    await reducer_service.sync_meter(session, meter)
    start = utc_now() - timedelta(days=2)
    credits = [
        await create_event(
            save_fixture,
            organization=organization,
            customer=customer,
            source=EventSource.system,
            name=SystemEvent.meter_credited,
            timestamp=start + timedelta(minutes=i),
            ingested_at=start + timedelta(minutes=i),
            metadata={"meter_id": str(meter.id), "units": unit, "rollover": False},
        )
        for i, unit in enumerate(units)
    ]
    await reducer_service.sync_credits(session, customer, meter.id)
    if billed:
        meter.last_billed_event = credits[-1]
        await save_fixture(meter)
    customer_meter = CustomerMeter(
        customer=customer,
        meter=meter,
        activated_at=start,
        consumed_units=Decimal(0),
        credited_units=0,
        balance=Decimal(0),
    )
    await save_fixture(customer_meter)
    return customer_meter, credits


@pytest.mark.anyio
class TestCompensate:
    async def test_credits_overshoot_before_first_negative(
        self,
        session: AsyncSession,
        redis: Redis,
        save_fixture: SaveFixture,
        organization: Organization,
        customer: Customer,
        meter: Meter,
    ) -> None:
        customer_meter, credits = await setup_credits(
            save_fixture,
            session,
            organization,
            customer,
            meter,
            [-1200, 360000, -360000, 40000],
        )
        [(_, reducer_before)] = await reducer_service.get_customer_meter_units(
            session, redis, [(customer, meter.id)]
        )
        assert reducer_before == 38800

        assert await compensate(session, redis, customer_meter.id) == 1200

        [(_, reducer_after)] = await reducer_service.get_customer_meter_units(
            session, redis, [(customer, meter.id)]
        )
        assert reducer_after == 40000
        clawback = credits[0]
        compensation = await session.scalar(
            select(Event).where(Event.parent_id == clawback.id)
        )
        assert compensation is not None
        assert compensation.timestamp < clawback.timestamp
        assert compensation.ingested_at < clawback.ingested_at

    async def test_billing_cursor_not_past_credit(
        self,
        session: AsyncSession,
        redis: Redis,
        save_fixture: SaveFixture,
        organization: Organization,
        customer: Customer,
        meter: Meter,
    ) -> None:
        customer_meter, _ = await setup_credits(
            save_fixture,
            session,
            organization,
            customer,
            meter,
            [-1200, 40000],
            billed=False,
        )

        with pytest.raises(CompensationMismatch):
            await compensate(session, redis, customer_meter.id)

    async def test_never_negative(
        self,
        session: AsyncSession,
        redis: Redis,
        save_fixture: SaveFixture,
        organization: Organization,
        customer: Customer,
        meter: Meter,
    ) -> None:
        customer_meter, _ = await setup_credits(
            save_fixture, session, organization, customer, meter, [500, -500]
        )

        assert await compensate(session, redis, customer_meter.id) == 0
