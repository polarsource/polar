from datetime import timedelta
from decimal import Decimal

import pytest
from pytest_mock import MockerFixture

from polar.event.system import SystemEvent
from polar.kit.db.postgres import AsyncSession
from polar.kit.utils import utc_now
from polar.models import Customer, CustomerMeter, Meter, Organization
from polar.models.event import EventSource
from polar.redis import Redis
from polar.reducer.service import reducer as reducer_service
from scripts.compensate_meter_credit_clawbacks import compensate
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import create_event


async def setup_credits(
    save_fixture: SaveFixture,
    session: AsyncSession,
    organization: Organization,
    customer: Customer,
    meter: Meter,
    units: list[int],
    credited_units: int,
) -> CustomerMeter:
    await reducer_service.sync_meter(session, meter)
    start = utc_now() - timedelta(days=2)
    for i, unit in enumerate(units):
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
    await reducer_service.sync_credits(session, customer, meter.id)
    customer_meter = CustomerMeter(
        customer=customer,
        meter=meter,
        activated_at=start,
        consumed_units=Decimal(0),
        credited_units=credited_units,
        balance=Decimal(credited_units),
    )
    await save_fixture(customer_meter)
    return customer_meter


@pytest.mark.anyio
class TestCompensate:
    async def test_credits_overshoot_before_first_negative(
        self,
        mocker: MockerFixture,
        session: AsyncSession,
        redis: Redis,
        save_fixture: SaveFixture,
        organization: Organization,
        customer: Customer,
        meter: Meter,
    ) -> None:
        mocker.patch("polar.customer_meter.service.enqueue_job")
        customer_meter = await setup_credits(
            save_fixture,
            session,
            organization,
            customer,
            meter,
            [-1200, 360000, -360000, 40000],
            0,
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
        await session.refresh(customer_meter)
        assert customer_meter.credited_units == 40000

    async def test_never_negative(
        self,
        session: AsyncSession,
        redis: Redis,
        save_fixture: SaveFixture,
        organization: Organization,
        customer: Customer,
        meter: Meter,
    ) -> None:
        customer_meter = await setup_credits(
            save_fixture, session, organization, customer, meter, [500, -500], 0
        )

        assert await compensate(session, redis, customer_meter.id) == 0
