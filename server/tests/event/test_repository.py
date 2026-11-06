import uuid
from datetime import datetime, timedelta
from typing import Any

import pytest
from sqlalchemy import event as sqlalchemy_event
from sqlalchemy import select

from polar.event.repository import EventRepository
from polar.event.system import SystemEvent
from polar.kit.utils import utc_now
from polar.models import Event, Organization, StagedEvent
from polar.models.event import EventSource
from polar.postgres import AsyncSession
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import create_customer


async def _create_event(
    save_fixture: SaveFixture,
    *,
    organization: Organization,
    ingested_at: datetime,
    timestamp: datetime | None = None,
    source: EventSource = EventSource.user,
    name: str = "test_event",
    user_metadata: dict[str, object] | None = None,
    customer_id: uuid.UUID | None = None,
    external_customer_id: str | None = None,
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
        user_metadata=user_metadata or {},
        customer_id=customer_id,
        external_customer_id=external_customer_id,
    )
    await save_fixture(event)
    return event


@pytest.mark.anyio
class TestCustomerFilterClause:
    async def test_customer_id_matches_external_id_within_organization(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        organization: Organization,
        organization_second: Organization,
    ) -> None:
        external_id = "shared-external-id"
        customer = await create_customer(
            save_fixture,
            organization=organization,
            external_id=external_id,
        )
        await create_customer(
            save_fixture,
            organization=organization_second,
            external_id=external_id,
        )
        matching_event = await _create_event(
            save_fixture,
            organization=organization,
            ingested_at=utc_now(),
            external_customer_id=external_id,
        )
        await _create_event(
            save_fixture,
            organization=organization_second,
            ingested_at=utc_now(),
            external_customer_id=external_id,
        )

        repository = EventRepository.from_session(session)
        clause = repository.get_customer_filter_clause(
            organization.id, [customer.id], [external_id]
        )
        result = await session.scalars(select(Event).where(clause))

        assert list(result) == [matching_event]

    async def test_external_customer_id_matches_customer_within_organization(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        organization: Organization,
        organization_second: Organization,
    ) -> None:
        external_id = "shared-external-id"
        customer = await create_customer(
            save_fixture,
            organization=organization,
            external_id=external_id,
        )
        other_customer = await create_customer(
            save_fixture,
            organization=organization_second,
            external_id=external_id,
        )
        matching_event = await _create_event(
            save_fixture,
            organization=organization,
            ingested_at=utc_now(),
            customer_id=customer.id,
        )
        await _create_event(
            save_fixture,
            organization=organization_second,
            ingested_at=utc_now(),
            customer_id=other_customer.id,
        )

        repository = EventRepository.from_session(session)
        clause = repository.get_customer_filter_clause(
            organization.id, [customer.id], [external_id]
        )
        result = await session.scalars(select(Event).where(clause))

        assert list(result) == [matching_event]


@pytest.mark.anyio
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


async def _create_balance_order(
    save_fixture: SaveFixture,
    *,
    organization: Organization,
    timestamp: datetime,
    exchange_rate: float,
    presentment_currency: str = "eur",
) -> Event:
    return await _create_event(
        save_fixture,
        organization=organization,
        ingested_at=timestamp,
        timestamp=timestamp,
        source=EventSource.system,
        name="balance.order",
        user_metadata={
            "presentment_currency": presentment_currency,
            "exchange_rate": exchange_rate,
        },
    )


@pytest.mark.anyio
class TestGetRecentBalanceOrderExchangeRate:
    async def test_returns_most_recent_prior_match(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        organization: Organization,
    ) -> None:
        now = utc_now()
        await _create_balance_order(
            save_fixture,
            organization=organization,
            timestamp=now - timedelta(hours=2),
            exchange_rate=0.30,
        )
        await _create_balance_order(
            save_fixture,
            organization=organization,
            timestamp=now - timedelta(hours=1),
            exchange_rate=0.35,
        )

        repository = EventRepository.from_session(session)
        result = await repository.get_recent_balance_order_exchange_rate(
            organization.id, "eur", before=now
        )

        assert result == 0.35

    async def test_returns_none_without_prior_balance_order(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        organization: Organization,
    ) -> None:
        repository = EventRepository.from_session(session)
        result = await repository.get_recent_balance_order_exchange_rate(
            organization.id, "eur", before=utc_now()
        )

        assert result is None

    async def test_filters_by_presentment_currency(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        organization: Organization,
    ) -> None:
        now = utc_now()
        await _create_balance_order(
            save_fixture,
            organization=organization,
            timestamp=now - timedelta(hours=1),
            exchange_rate=0.30,
            presentment_currency="gbp",
        )

        repository = EventRepository.from_session(session)
        result = await repository.get_recent_balance_order_exchange_rate(
            organization.id, "eur", before=now
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
        await _create_balance_order(
            save_fixture,
            organization=organization_second,
            timestamp=now - timedelta(hours=1),
            exchange_rate=0.30,
        )

        repository = EventRepository.from_session(session)
        result = await repository.get_recent_balance_order_exchange_rate(
            organization.id, "eur", before=now
        )

        assert result is None

    async def test_ignores_events_after_before_cutoff(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        organization: Organization,
    ) -> None:
        now = utc_now()
        await _create_balance_order(
            save_fixture,
            organization=organization,
            timestamp=now + timedelta(hours=1),
            exchange_rate=0.30,
        )

        repository = EventRepository.from_session(session)
        result = await repository.get_recent_balance_order_exchange_rate(
            organization.id, "eur", before=now
        )

        assert result is None

    async def test_ignores_events_older_than_30_day_lookback(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        organization: Organization,
    ) -> None:
        now = utc_now()
        await _create_balance_order(
            save_fixture,
            organization=organization,
            timestamp=now - timedelta(days=31),
            exchange_rate=0.30,
        )

        repository = EventRepository.from_session(session)
        result = await repository.get_recent_balance_order_exchange_rate(
            organization.id, "eur", before=now
        )

        assert result is None

    async def test_skips_balance_order_without_exchange_rate(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        organization: Organization,
    ) -> None:
        now = utc_now()
        await _create_event(
            save_fixture,
            organization=organization,
            ingested_at=now - timedelta(hours=1),
            timestamp=now - timedelta(hours=1),
            source=EventSource.system,
            name="balance.order",
            user_metadata={"presentment_currency": "eur"},
        )

        repository = EventRepository.from_session(session)
        result = await repository.get_recent_balance_order_exchange_rate(
            organization.id, "eur", before=now
        )

        assert result is None


@pytest.mark.anyio
class TestInsertBatch:
    async def test_mixed_keys_insert_in_one_statement(
        self, session: AsyncSession, organization: Organization
    ) -> None:
        base: dict[str, Any] = {
            "organization_id": organization.id,
            "source": EventSource.user,
            "name": "test",
            "timestamp": utc_now(),
            "user_metadata": {},
            "external_customer_id": "ext",
        }
        events = [
            {**base},
            {**base, "pending_parent_external_id": "parent"},
            {**base, "external_id": "event-1", "external_member_id": "member"},
        ]
        statements: list[str] = []

        def capture(_conn: Any, _cursor: Any, statement: str, *args: Any) -> None:
            statements.append(statement)

        bind = session.sync_session.bind
        assert bind is not None
        sqlalchemy_event.listen(bind, "before_cursor_execute", capture)
        try:
            inserted_ids, duplicates = await EventRepository.from_session(
                session
            ).insert_batch(events, render_nulls=True)
        finally:
            sqlalchemy_event.remove(bind, "before_cursor_execute", capture)

        assert len(inserted_ids) == 3
        assert duplicates == 0
        assert len([s for s in statements if s.startswith("INSERT INTO events")]) == 1

        inserted = {
            event.id: event
            for event in await session.scalars(
                select(Event).where(Event.id.in_(inserted_ids))
            )
        }
        assert inserted[events[0]["id"]].root_id == events[0]["id"]
        assert inserted[events[1]["id"]].root_id is None
        assert inserted[events[2]["id"]].external_id == "event-1"


@pytest.mark.anyio
class TestGetLatestMeterReset:
    async def test_returns_latest_reset_for_meter(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        organization: Organization,
    ) -> None:
        customer = await create_customer(save_fixture, organization=organization)
        meter_id = uuid.uuid4()
        now = utc_now()

        for timestamp, reset_meter_id in [
            (now - timedelta(days=2), meter_id),
            (now - timedelta(days=1), meter_id),
            (now, uuid.uuid4()),
        ]:
            await _create_event(
                save_fixture,
                organization=organization,
                ingested_at=timestamp,
                source=EventSource.system,
                name=SystemEvent.meter_reset,
                user_metadata={"meter_id": str(reset_meter_id)},
                customer_id=customer.id,
            )

        repository = EventRepository.from_session(session)
        reset = await repository.get_latest_meter_reset(customer, meter_id)

        assert reset is not None
        assert reset.timestamp == now - timedelta(days=1)


@pytest.mark.anyio
class TestGetStagedEventsBacklog:
    async def test_empty(self, session: AsyncSession) -> None:
        repository = EventRepository.from_session(session)
        assert await repository.get_staged_events_backlog() == (0, None)

    async def test_count_and_oldest(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        organization: Organization,
    ) -> None:
        now = utc_now()
        for ingested_at in [
            now,
            now - timedelta(minutes=5),
            now - timedelta(minutes=1),
        ]:
            await save_fixture(
                StagedEvent(
                    name="test_event",
                    source=EventSource.user,
                    timestamp=ingested_at,
                    ingested_at=ingested_at,
                    organization_id=organization.id,
                )
            )

        repository = EventRepository.from_session(session)
        assert await repository.get_staged_events_backlog() == (
            3,
            now - timedelta(minutes=5),
        )
