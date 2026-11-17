import uuid
from datetime import UTC, datetime, timedelta

import pytest

from polar.event.system import SystemEvent
from polar.models import Customer, Meter, Organization, StagedEvent, User
from polar.models.event import EventSource
from polar.models.reducer import ReducerKind
from polar.postgres import AsyncSession
from polar.reducer.bucket_repository import ReducerBucketRepository
from polar.reducer.repository import ReducerRepository
from polar.reducer.service import reducer as reducer_service
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import (
    METER_TEST_EVENT,
    create_account,
    create_event,
    create_organization,
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
class TestGetOrganizationsWithEvents:
    async def test_events_and_staged_events_in_the_range(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        user: User,
        organization: Organization,
        organization_second: Organization,
    ) -> None:
        idle_organization, unlisted_organization = [
            await create_organization(
                save_fixture, await create_account(save_fixture, user)
            )
            for _ in range(2)
        ]
        in_range = BUCKET_START + timedelta(minutes=1)
        await create_event(save_fixture, organization=organization, timestamp=in_range)
        await create_event(
            save_fixture, organization=unlisted_organization, timestamp=in_range
        )
        await create_event(
            save_fixture, organization=idle_organization, timestamp=BUCKET_END
        )
        await save_fixture(
            StagedEvent(
                name=METER_TEST_EVENT,
                source=EventSource.user,
                timestamp=in_range,
                organization_id=organization_second.id,
                user_metadata={},
            )
        )

        organization_ids = await ReducerBucketRepository.from_session(
            session
        ).get_organizations_with_events(
            {organization.id, organization_second.id, idle_organization.id},
            BUCKET_START,
            BUCKET_END,
        )

        assert organization_ids == {organization.id, organization_second.id}
