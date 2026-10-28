import json
import typing
from datetime import timedelta
from decimal import Decimal

import pytest
from anyio import create_memory_object_stream
from pytest_codspeed import BenchmarkFixture

from polar.kit.db.postgres import AsyncSession
from polar.kit.utils import utc_now
from polar.models import (
    Event,
    Meter,
    Organization,
    Reducer,
    ReducerBucket,
)
from polar.models.event import EventSource
from polar.models.reducer import ReducerKind
from polar.outpost.schemas import (
    ConfirmedOutgoingMessage,
    MeterUsageOutgoingMessage,
    OutgoingMessage,
    to_epoch_microseconds,
)
from polar.outpost.service import outpost as outpost_service
from polar.reducer.service import REDUCER_BUCKET_SIZE, get_reducer_bucket_start
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import (
    METER_TEST_EVENT,
    create_customer,
    create_meter,
    create_reducer,
)

from .conftest import Run

pytestmark = pytest.mark.benchmark


@pytest.mark.parametrize("ids", [1, 100, 1000])
def test_confirm_pending(
    benchmark: BenchmarkFixture,
    run: Run[typing.Any],
    session: AsyncSession,
    save_fixture: SaveFixture,
    organization: Organization,
    ids: int,
) -> None:
    bucket_start = get_reducer_bucket_start(utc_now()) - REDUCER_BUCKET_SIZE

    async def seed() -> tuple[Meter, Reducer]:
        meter = await create_meter(save_fixture, organization=organization)
        reducer = await create_reducer(
            save_fixture, organization=organization, meters=[meter]
        )
        await create_customer(
            save_fixture, organization=organization, external_id="customer-0"
        )
        session.add(
            ReducerBucket(
                organization=organization,
                reducer=reducer,
                external_customer_id="customer-0",
                bucket_start=bucket_start,
                bucket_end=bucket_start + REDUCER_BUCKET_SIZE,
                count=1000,
                sum=Decimal(1000),
                min=Decimal(1),
                max=Decimal(1),
                synced_at=utc_now(),
            )
        )
        # Ten customers' worth of events in the bucket; the ids asked are one customer's.
        session.add_all(
            Event(
                name=METER_TEST_EVENT,
                timestamp=bucket_start + timedelta(milliseconds=index),
                ingested_at=bucket_start + timedelta(milliseconds=index),
                organization_id=organization.id,
                external_customer_id=f"customer-{index % 10}",
                external_id=f"event-{index}",
                source=EventSource.user,
            )
            for index in range(10_000)
        )
        await session.flush()
        return meter, reducer

    meter, reducer = run(seed())
    payload = json.dumps(
        {
            "type": "confirm",
            "payload": {
                "reducer_id": str(reducer.id),
                "external_customer_id": "customer-0",
                "bucket_start": to_epoch_microseconds(bucket_start),
                "ids": [f"event-{index * 10}" for index in range(ids)],
            },
        }
    )
    send_stream, receive_stream = create_memory_object_stream[OutgoingMessage](1)

    def confirm() -> OutgoingMessage:
        run(
            outpost_service.handle_incoming_message(
                session, organization, payload, send_stream
            )
        )
        return receive_stream.receive_nowait()

    message = confirm()
    assert isinstance(message, ConfirmedOutgoingMessage)
    assert len(message.payload.ids) == ids
    assert message.payload.snapshot.customer_exists
    benchmark(confirm)


# A customer's credits since its latest reset, after a long period of sealed ones.
def test_request_credit_usage(
    benchmark: BenchmarkFixture,
    run: Run[typing.Any],
    session: AsyncSession,
    save_fixture: SaveFixture,
    organization: Organization,
) -> None:
    current = get_reducer_bucket_start(utc_now())

    async def seed() -> Reducer:
        meter = await create_meter(save_fixture, organization=organization)
        reducer = await create_reducer(
            save_fixture,
            organization=organization,
            meters=[meter],
            kind=ReducerKind.credit,
        )
        # Ten customers' credits, so the query has to select one of them.
        for index in range(10):
            customer = await create_customer(
                save_fixture,
                organization=organization,
                email=f"customer-{index}@example.com",
                external_id=f"customer-{index}",
            )
            session.add_all(
                ReducerBucket(
                    organization=organization,
                    reducer=reducer,
                    customer=customer,
                    bucket_start=current - (slot + 1) * REDUCER_BUCKET_SIZE,
                    bucket_end=current - slot * REDUCER_BUCKET_SIZE,
                    count=1,
                    sum=Decimal(1),
                    min=Decimal(1),
                    max=Decimal(1),
                    sealed_at=None if slot < 100 else current,
                )
                for slot in range(1100)
            )
        await session.flush()
        return reducer

    reducer = run(seed())
    payload = json.dumps(
        {
            "type": "meter_usage",
            "payload": {
                "reducer_id": str(reducer.id),
                "external_customer_id": "customer-0",
            },
        }
    )
    send_stream, receive_stream = create_memory_object_stream[OutgoingMessage](3)

    def request() -> list[OutgoingMessage]:
        run(
            outpost_service.handle_incoming_message(
                session, organization, payload, send_stream
            )
        )
        return [receive_stream.receive_nowait() for _ in range(3)]

    messages = request()
    assert all(
        isinstance(message, MeterUsageOutgoingMessage)
        and (message.payload.count, message.payload.sum) == (100, 100)
        for message in messages
    )
    benchmark(request)
