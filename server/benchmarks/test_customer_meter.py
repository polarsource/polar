import typing
import uuid
from datetime import timedelta
from decimal import Decimal

import pytest
from pytest_codspeed import BenchmarkFixture
from sqlalchemy import update

from polar.customer_meter.service import customer_meter as customer_meter_service
from polar.event.repository import EventRepository
from polar.kit.db.postgres import AsyncSession
from polar.kit.utils import utc_now
from polar.meter.aggregation import AggregationFunction, PropertyAggregation
from polar.models import Customer, CustomerMeter, Event, Meter, Organization
from polar.models.event import EventSource
from polar.redis import Redis
from polar.reducer.service import REDUCER_BUCKET_SIZE, get_reducer_bucket_start
from polar.reducer.service import reducer as reducer_service
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import (
    METER_TEST_EVENT,
    create_customer,
    create_meter,
)

from .conftest import Run, analyze

pytestmark = pytest.mark.benchmark

BUCKETS = 1_000
EVENTS_PER_BUCKET = 100
TOKENS = 10


# A customer with a long usage history and no meter reset: each balance update covers all of it.
def test_update_customer_meter_100k_events(
    benchmark: BenchmarkFixture,
    run: Run[typing.Any],
    session: AsyncSession,
    redis: Redis,
    save_fixture: SaveFixture,
    organization: Organization,
) -> None:
    async def seed() -> tuple[Customer, Meter]:
        meter = await create_meter(
            save_fixture,
            organization=organization,
            aggregation=PropertyAggregation(
                func=AggregationFunction.sum, property="tokens"
            ),
        )
        await reducer_service.sync_meter(session, meter)
        customer = await create_customer(
            save_fixture, organization=organization, external_id="customer"
        )
        repository = EventRepository.from_session(session)
        ingested_at = utc_now()
        first_bucket = (
            get_reducer_bucket_start(ingested_at) - BUCKETS * REDUCER_BUCKET_SIZE
        )
        for bucket in range(BUCKETS):
            rows: list[dict[str, typing.Any]] = []
            for index in range(EVENTS_PER_BUCKET):
                event_id = uuid.uuid4()
                rows.append(
                    {
                        "id": event_id,
                        "ingested_at": ingested_at,
                        "timestamp": first_bucket
                        + bucket * REDUCER_BUCKET_SIZE
                        + timedelta(seconds=index),
                        "name": METER_TEST_EVENT,
                        "source": EventSource.user,
                        "organization_id": organization.id,
                        "external_customer_id": customer.external_id,
                        "user_metadata": {"tokens": TOKENS},
                        "root_id": event_id,
                    }
                )
            await repository.insert_batch(rows)
            await reducer_service.rollup(
                session, redis, organization.id, [Event(**row) for row in rows]
            )
        await customer_meter_service.update_customer_meter(
            session, customer, meter, activate_meter=True
        )
        await session.flush()
        return customer, meter

    customer, meter = run(seed())
    savepoint: typing.Any = None

    def begin() -> None:
        nonlocal savepoint
        savepoint = run(session.begin_nested())
        run(
            session.execute(
                update(CustomerMeter)
                .where(CustomerMeter.customer_id == customer.id)
                .values(last_balanced_event_id=None)
            )
        )

    def rollback() -> None:
        run(savepoint.rollback())

    def balance() -> tuple[CustomerMeter | None, bool]:
        return run(
            customer_meter_service.update_customer_meter(session, customer, meter)
        )

    begin()
    customer_meter, updated = balance()
    assert updated
    assert customer_meter is not None
    assert customer_meter.consumed_units == Decimal(
        BUCKETS * EVENTS_PER_BUCKET * TOKENS
    )
    rollback()
    analyze(run, session)
    benchmark.pedantic(balance, setup=begin, teardown=rollback, rounds=20)
