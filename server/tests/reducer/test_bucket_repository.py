import uuid
from datetime import UTC, datetime, timedelta
from decimal import Decimal

import pytest

from polar.event.system import SystemEvent
from polar.models import Customer, Meter, Organization, ReducerBucket, StagedEvent
from polar.models.event import EventSource
from polar.models.reducer import ReducerKind
from polar.postgres import AsyncSession
from polar.reducer.bucket_repository import ReducerBucketRepository
from polar.reducer.repository import ReducerRepository
from polar.reducer.service import REDUCER_BUCKET_SIZE
from polar.reducer.service import reducer as reducer_service
from polar.reducer.types import UsageSummary
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import (
    METER_TEST_EVENT,
    create_event,
)

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

    async def test_usage_reducer_bounds_ingestion_by_the_bucket_start(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
        customer: Customer,
        meter: Meter,
    ) -> None:
        await reducer_service.sync_meter(session, meter)
        reducer = await ReducerRepository.from_session(session).get_by_meter_and_kind(
            meter.id, ReducerKind.usage
        )
        assert reducer is not None
        for ingested_at in (
            BUCKET_START - timedelta(seconds=4),
            BUCKET_START - timedelta(seconds=6),
        ):
            await create_event(
                save_fixture,
                organization=organization,
                timestamp=BUCKET_START,
                ingested_at=ingested_at,
                customer=customer,
            )

        count, *_ = await ReducerBucketRepository.from_session(
            session
        ).aggregate_events(reducer, BUCKET_START, BUCKET_END, customer.id, None)

        assert count == 1


@pytest.mark.anyio
class TestAggregateEventsBatch:
    async def test_returns_stored_and_staged_summaries_per_request(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
        customer: Customer,
        customer_second: Customer,
        meter: Meter,
    ) -> None:
        await reducer_service.sync_meter(session, meter)
        reducer = await ReducerRepository.from_session(session).get_by_meter_and_kind(
            meter.id, ReducerKind.usage
        )
        assert reducer is not None
        in_range = BUCKET_START + timedelta(minutes=1)
        await create_event(
            save_fixture,
            organization=organization,
            timestamp=in_range,
            ingested_at=in_range,
            customer=customer,
        )
        await save_fixture(
            StagedEvent(
                name=METER_TEST_EVENT,
                source=EventSource.user,
                timestamp=in_range,
                ingested_at=in_range,
                organization_id=organization.id,
                customer_id=customer.id,
                user_metadata={},
            )
        )

        summaries = await ReducerBucketRepository.from_session(
            session
        ).aggregate_events_batch(
            [
                (reducer, BUCKET_START, BUCKET_END, customer.id, None),
                (reducer, BUCKET_START, BUCKET_END, customer_second.id, None),
            ]
        )

        assert summaries == [
            (0, UsageSummary(count=1, total=Decimal(0), minimum=None, maximum=None)),
            (0, UsageSummary(count=1, total=Decimal(0), minimum=None, maximum=None)),
            (1, UsageSummary(count=0, total=Decimal(0), minimum=None, maximum=None)),
            (1, UsageSummary(count=0, total=Decimal(0), minimum=None, maximum=None)),
        ]


@pytest.mark.anyio
class TestGetIdentitiesWithEvents:
    async def test_events_and_staged_events_in_the_range(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
        customer: Customer,
        meter: Meter,
    ) -> None:
        await reducer_service.sync_meter(session, meter)
        reducer = await ReducerRepository.from_session(session).get_by_meter_and_kind(
            meter.id, ReducerKind.usage
        )
        assert reducer is not None
        in_range = BUCKET_START + timedelta(minutes=1)
        await create_event(
            save_fixture,
            organization=organization,
            timestamp=in_range,
            customer=customer,
        )
        for external_customer_id, name, timestamp in (
            ("external", METER_TEST_EVENT, in_range),
            ("external", METER_TEST_EVENT, in_range),
            ("other_event", "other", in_range),
            ("next_bucket", METER_TEST_EVENT, BUCKET_END),
        ):
            await create_event(
                save_fixture,
                organization=organization,
                name=name,
                timestamp=timestamp,
                external_customer_id=external_customer_id,
            )
        for external_customer_id in ("external", "staged"):
            await save_fixture(
                StagedEvent(
                    name=METER_TEST_EVENT,
                    source=EventSource.user,
                    timestamp=in_range,
                    organization_id=organization.id,
                    external_customer_id=external_customer_id,
                    user_metadata={},
                )
            )

        identities = await ReducerBucketRepository.from_session(
            session
        ).get_identities_with_events(reducer, BUCKET_START, BUCKET_END)

        assert sorted(identities, key=str) == sorted(
            [(customer.id, None), (None, "external"), (None, "staged")], key=str
        )


@pytest.mark.anyio
class TestGetUnsealedTotalsByIdentity:
    async def test_leaves_out_a_bucket_pairing_two_customers_identities(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
        customer: Customer,
        customer_second: Customer,
        meter: Meter,
    ) -> None:
        reducer = await reducer_service.sync_meter(session, meter)
        for customer_id, external_customer_id, count in (
            (customer.id, "first", 1),
            (customer_second.id, "second", 2),
            (customer.id, "second", 100),
        ):
            await save_fixture(
                ReducerBucket(
                    organization=organization,
                    reducer=reducer,
                    customer_id=customer_id,
                    external_customer_id=external_customer_id,
                    bucket_start=BUCKET_START,
                    bucket_end=BUCKET_END,
                    count=count,
                    sum=Decimal(count),
                    min=Decimal(1),
                    max=Decimal(1),
                )
            )

        totals = await ReducerBucketRepository.from_session(
            session
        ).get_unsealed_totals_by_identity(
            organization.id,
            {
                (reducer.id, (customer.id, "first")): None,
                (reducer.id, (customer_second.id, "second")): None,
            },
        )

        assert [count for count, *_ in totals.values()] == [1, 2]

    async def test_bounds_a_bucket_pairing_two_customers_identities_by_its_own(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
        customer: Customer,
        customer_second: Customer,
        meter: Meter,
    ) -> None:
        reducer = await reducer_service.sync_meter(session, meter)
        for customer_id, external_customer_id, bucket_start in (
            (customer.id, "second", BUCKET_START),
            (customer.id, "second", BUCKET_END),
        ):
            await save_fixture(
                ReducerBucket(
                    organization=organization,
                    reducer=reducer,
                    customer_id=customer_id,
                    external_customer_id=external_customer_id,
                    bucket_start=bucket_start,
                    bucket_end=bucket_start + timedelta(minutes=5),
                    count=1,
                    sum=Decimal(1),
                    min=Decimal(1),
                    max=Decimal(1),
                )
            )

        totals = await ReducerBucketRepository.from_session(
            session
        ).get_unsealed_totals_by_identity(
            organization.id,
            {
                (reducer.id, (customer.id, "first")): None,
                (reducer.id, (customer_second.id, "second")): None,
                (reducer.id, (customer.id, "second")): BUCKET_END,
            },
        )

        count, *_ = totals[(reducer.id, (customer.id, "second"))]
        assert count == 1


@pytest.mark.anyio
class TestIsCreditBilled:
    async def test_tracks_billed_generation_by_ingestion_time(
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
        repo = ReducerBucketRepository.from_session(session)

        credit_time = BUCKET_START + timedelta(minutes=1)
        sealed_at = BUCKET_START + timedelta(minutes=2)
        early_credit = await create_event(
            save_fixture,
            organization=organization,
            source=EventSource.system,
            name=SystemEvent.meter_credited,
            timestamp=credit_time,
            ingested_at=credit_time,
            customer=customer,
            metadata={"meter_id": str(meter.id), "units": 10, "rollover": False},
        )
        late_credit = await create_event(
            save_fixture,
            organization=organization,
            source=EventSource.system,
            name=SystemEvent.meter_credited,
            timestamp=credit_time,
            ingested_at=sealed_at + timedelta(minutes=1),
            customer=customer,
            metadata={"meter_id": str(meter.id), "units": 10, "rollover": False},
        )

        assert (
            await repo.is_credit_billed(
                reducer, customer, early_credit, bucket_size=REDUCER_BUCKET_SIZE
            )
            is False
        )

        for generation, sealed in ((1, sealed_at), (2, None)):
            await save_fixture(
                ReducerBucket(
                    organization=organization,
                    reducer=reducer,
                    customer_id=customer.id,
                    bucket_start=BUCKET_START,
                    bucket_end=BUCKET_END,
                    generation=generation,
                    count=1,
                    sum=Decimal(10),
                    min=Decimal(10),
                    max=Decimal(10),
                    sealed_at=sealed,
                    billed_at=sealed,
                )
            )

        assert (
            await repo.is_credit_billed(
                reducer, customer, early_credit, bucket_size=REDUCER_BUCKET_SIZE
            )
            is True
        )
        assert (
            await repo.is_credit_billed(
                reducer, customer, late_credit, bucket_size=REDUCER_BUCKET_SIZE
            )
            is False
        )
