import uuid
from datetime import datetime, timedelta

import pytest

from polar.event.repository import EventRepository
from polar.kit.utils import utc_now
from polar.models import Event, Organization
from polar.models.event import EventSource
from polar.postgres import AsyncSession
from tests.fixtures.database import SaveFixture


async def _create_event(
    save_fixture: SaveFixture,
    *,
    organization: Organization,
    ingested_at: datetime,
    timestamp: datetime | None = None,
    source: EventSource = EventSource.user,
    name: str = "test_event",
) -> Event:
    event_id = uuid.uuid4()
    event = Event(
        id=event_id,
        ingested_at=ingested_at,
        timestamp=timestamp or ingested_at,
        source=source,
        name=name,
        organization=organization,
        root_id=event_id,
        user_metadata={},
    )
    await save_fixture(event)
    return event


@pytest.mark.asyncio
class TestCountUserEventsByOrganization:
    async def test_groups_counts_per_organization(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        organization: Organization,
        organization_second: Organization,
    ) -> None:
        now = utc_now()
        await _create_event(save_fixture, organization=organization, ingested_at=now)
        await _create_event(save_fixture, organization=organization, ingested_at=now)
        await _create_event(
            save_fixture, organization=organization_second, ingested_at=now
        )

        repository = EventRepository.from_session(session)
        counts = await repository.count_user_events_by_organization(
            after=now - timedelta(minutes=1),
            until=now + timedelta(minutes=1),
            exclude_organization_id=uuid.uuid4(),
        )

        assert counts == {organization.id: 2, organization_second.id: 1}

    async def test_excludes_system_events(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        organization: Organization,
    ) -> None:
        now = utc_now()
        await _create_event(save_fixture, organization=organization, ingested_at=now)
        await _create_event(
            save_fixture,
            organization=organization,
            ingested_at=now,
            source=EventSource.system,
        )

        repository = EventRepository.from_session(session)
        counts = await repository.count_user_events_by_organization(
            after=now - timedelta(minutes=1),
            until=now + timedelta(minutes=1),
            exclude_organization_id=uuid.uuid4(),
        )

        assert counts == {organization.id: 1}

    async def test_excludes_organization(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        organization: Organization,
        organization_second: Organization,
    ) -> None:
        now = utc_now()
        await _create_event(save_fixture, organization=organization, ingested_at=now)
        await _create_event(
            save_fixture, organization=organization_second, ingested_at=now
        )

        repository = EventRepository.from_session(session)
        counts = await repository.count_user_events_by_organization(
            after=now - timedelta(minutes=1),
            until=now + timedelta(minutes=1),
            exclude_organization_id=organization.id,
        )

        assert counts == {organization_second.id: 1}

    async def test_after_is_exclusive_until_is_inclusive(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        organization: Organization,
    ) -> None:
        boundary = utc_now()
        await _create_event(
            save_fixture, organization=organization, ingested_at=boundary
        )
        await _create_event(
            save_fixture,
            organization=organization,
            ingested_at=boundary + timedelta(milliseconds=1),
        )

        repository = EventRepository.from_session(session)
        counts = await repository.count_user_events_by_organization(
            after=boundary,
            until=boundary + timedelta(milliseconds=1),
            exclude_organization_id=uuid.uuid4(),
        )

        assert counts == {organization.id: 1}

    async def test_no_lower_bound_when_after_is_none(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        organization: Organization,
    ) -> None:
        now = utc_now()
        await _create_event(
            save_fixture,
            organization=organization,
            ingested_at=now - timedelta(days=365),
        )
        await _create_event(save_fixture, organization=organization, ingested_at=now)

        repository = EventRepository.from_session(session)
        counts = await repository.count_user_events_by_organization(
            after=None,
            until=now + timedelta(minutes=1),
            exclude_organization_id=uuid.uuid4(),
        )

        assert counts == {organization.id: 2}

    async def test_returns_empty_when_no_match(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        organization: Organization,
    ) -> None:
        now = utc_now()
        await _create_event(save_fixture, organization=organization, ingested_at=now)

        repository = EventRepository.from_session(session)
        counts = await repository.count_user_events_by_organization(
            after=now + timedelta(hours=1),
            until=now + timedelta(hours=2),
            exclude_organization_id=uuid.uuid4(),
        )

        assert counts == {}


@pytest.mark.asyncio
class TestGetLatestPolarSelfIngestionTimestamp:
    async def test_returns_latest_for_organization(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        organization: Organization,
    ) -> None:
        earlier = utc_now() - timedelta(minutes=10)
        later = utc_now() - timedelta(minutes=1)
        await _create_event(
            save_fixture,
            organization=organization,
            ingested_at=earlier,
            timestamp=earlier,
            name="event_ingestion",
        )
        await _create_event(
            save_fixture,
            organization=organization,
            ingested_at=later,
            timestamp=later,
            name="event_ingestion",
        )

        repository = EventRepository.from_session(session)
        result = await repository.get_latest_polar_self_ingestion_timestamp(
            organization.id
        )

        assert result == later

    async def test_returns_none_when_no_events(
        self,
        session: AsyncSession,
        organization: Organization,
    ) -> None:
        repository = EventRepository.from_session(session)
        result = await repository.get_latest_polar_self_ingestion_timestamp(
            organization.id
        )

        assert result is None

    async def test_filters_by_organization(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        organization: Organization,
        organization_second: Organization,
    ) -> None:
        now = utc_now()
        await _create_event(
            save_fixture,
            organization=organization_second,
            ingested_at=now,
            timestamp=now,
            name="event_ingestion",
        )

        repository = EventRepository.from_session(session)
        result = await repository.get_latest_polar_self_ingestion_timestamp(
            organization.id
        )

        assert result is None

    async def test_filters_by_name(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        organization: Organization,
    ) -> None:
        now = utc_now()
        await _create_event(
            save_fixture,
            organization=organization,
            ingested_at=now,
            timestamp=now,
            name="other_event",
        )

        repository = EventRepository.from_session(session)
        result = await repository.get_latest_polar_self_ingestion_timestamp(
            organization.id
        )

        assert result is None
