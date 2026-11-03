import typing

import pytest
from pytest_codspeed import BenchmarkFixture

from polar.event.service import event as event_service
from polar.event.system import SystemEvent, build_system_event
from polar.kit.db.postgres import AsyncSession
from polar.models import Customer, Organization
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import create_customer

from .conftest import Run, analyze, create_metered_reducer

pytestmark = pytest.mark.benchmark


@pytest.fixture
def customer_meter(
    run: Run[typing.Any],
    session: AsyncSession,
    save_fixture: SaveFixture,
    organization: Organization,
) -> tuple[Customer, str]:
    async def seed() -> tuple[Customer, str]:
        reducer = await create_metered_reducer(session, save_fixture, organization)
        customer = await create_customer(save_fixture, organization=organization)
        return customer, str(reducer.meter_ids[0])

    return run(seed())


def test_create_meter_credited_event(
    benchmark: BenchmarkFixture,
    run: Run[typing.Any],
    session: AsyncSession,
    organization: Organization,
    customer_meter: tuple[Customer, str],
) -> None:
    customer, meter_id = customer_meter
    analyze(run, session)
    benchmark(
        lambda: run(
            event_service.create_event(
                session,
                build_system_event(
                    SystemEvent.meter_credited,
                    customer,
                    organization,
                    {
                        "meter_id": meter_id,
                        "units": 100,
                        "rollover": False,
                        "reason": "manual",
                    },
                ),
            )
        )
    )


def test_create_meter_reset_event(
    benchmark: BenchmarkFixture,
    run: Run[typing.Any],
    session: AsyncSession,
    organization: Organization,
    customer_meter: tuple[Customer, str],
) -> None:
    customer, meter_id = customer_meter
    analyze(run, session)
    benchmark(
        lambda: run(
            event_service.create_event(
                session,
                build_system_event(
                    SystemEvent.meter_reset,
                    customer,
                    organization,
                    {"meter_id": meter_id},
                ),
            )
        )
    )
