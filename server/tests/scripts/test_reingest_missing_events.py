import uuid
from datetime import UTC, datetime, timedelta
from typing import Any

import pytest
from sqlalchemy import select

from polar.integrations.tinybird.client import TinybirdClient
from polar.integrations.tinybird.service import DATASOURCE_EVENTS, events_to_tinybird
from polar.kit.db.postgres import AsyncSession
from polar.kit.utils import utc_now
from polar.models import Event, MeterEvent, Organization
from polar.models.event import EventSource
from scripts.reingest_missing_events import fetch_tinybird_rows, find_missing, reingest
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import (
    METER_TEST_EVENT,
    create_customer,
    create_meter,
)
from tests.fixtures.tinybird import tinybird_available


def tb_row(
    *,
    id: uuid.UUID | None = None,
    timestamp: datetime | None = None,
    name: str = "ai.usage",
    customer_id: uuid.UUID | None = None,
    external_customer_id: str | None = None,
    external_id: str | None = None,
    parent_id: uuid.UUID | None = None,
    root_id: uuid.UUID | None = None,
    event_type_id: uuid.UUID | None = None,
    user_metadata: str = "{}",
    cost_amount: float | None = None,
    cost_currency: str | None = None,
    llm_vendor: str | None = None,
    llm_model: str | None = None,
    llm_input_tokens: int | None = None,
    llm_output_tokens: int | None = None,
) -> dict[str, Any]:
    return {
        "id": id or uuid.uuid4(),
        "timestamp": timestamp or datetime(2026, 6, 1, 12, 0, 0),
        "name": name,
        "customer_id": customer_id,
        "external_customer_id": external_customer_id,
        "member_id": None,
        "external_member_id": None,
        "external_id": external_id,
        "parent_id": parent_id,
        "root_id": root_id,
        "event_type_id": event_type_id,
        "user_metadata": user_metadata,
        "cost_amount": cost_amount,
        "cost_currency": cost_currency,
        "llm_vendor": llm_vendor,
        "llm_model": llm_model,
        "llm_input_tokens": llm_input_tokens,
        "llm_output_tokens": llm_output_tokens,
    }


@pytest.mark.asyncio
class TestFindMissing:
    async def test_excludes_events_already_in_postgres(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        organization: Organization,
    ) -> None:
        existing_event = Event(
            name="ai.usage",
            source=EventSource.user,
            organization_id=organization.id,
            user_metadata={},
        )
        await save_fixture(existing_event)

        missing_row = tb_row()
        rows = [tb_row(id=existing_event.id), missing_row]

        missing = await find_missing(session, rows)

        assert missing == [missing_row]

    async def test_empty_rows(self, session: AsyncSession) -> None:
        assert await find_missing(session, []) == []


@pytest.mark.asyncio
class TestReingest:
    async def test_inserts_with_fresh_ingested_at_and_original_timestamp(
        self,
        session: AsyncSession,
        organization: Organization,
    ) -> None:
        original_timestamp = datetime(2026, 5, 20, 8, 30, 0)
        row = tb_row(timestamp=original_timestamp)
        before = utc_now()

        inserted_events, customer_ids = await reingest(session, [row], organization.id)

        assert len(inserted_events) == 1
        event = inserted_events[0]
        assert event.id == row["id"]
        assert event.ingested_at >= before
        assert event.timestamp == original_timestamp.replace(tzinfo=UTC)
        assert event.name == "ai.usage"
        assert event.source == EventSource.user
        assert event.organization_id == organization.id
        assert event.root_id == event.id
        assert customer_ids == set()

    async def test_preserves_parent_and_root(
        self,
        session: AsyncSession,
        organization: Organization,
    ) -> None:
        root_row = tb_row()
        root_id = root_row["id"]
        child_row = tb_row(parent_id=root_id, root_id=root_id)

        inserted_events, _ = await reingest(
            session, [root_row, child_row], organization.id
        )

        events_by_id = {event.id: event for event in inserted_events}
        child = events_by_id[child_row["id"]]
        assert child.parent_id == root_id
        assert child.root_id == root_id
        assert events_by_id[root_id].root_id == root_id

    async def test_rebuilds_cost_and_llm_metadata(
        self,
        session: AsyncSession,
        organization: Organization,
    ) -> None:
        row = tb_row(
            user_metadata='{"units": 5}',
            cost_amount=12.5,
            cost_currency="usd",
            llm_vendor="openai",
            llm_model="gpt-4o",
            llm_input_tokens=100,
            llm_output_tokens=50,
        )

        inserted_events, _ = await reingest(session, [row], organization.id)

        assert inserted_events[0].user_metadata == {
            "units": 5,
            "_cost": {"amount": 12.5, "currency": "usd"},
            "_llm": {
                "vendor": "openai",
                "model": "gpt-4o",
                "input_tokens": 100,
                "output_tokens": 50,
            },
        }

    async def test_creates_meter_events_with_new_ingested_at(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        organization: Organization,
    ) -> None:
        meter = await create_meter(save_fixture, organization=organization)
        matching_row = tb_row(name=METER_TEST_EVENT)
        non_matching_row = tb_row(name="other.event")

        inserted_events, _ = await reingest(
            session, [matching_row, non_matching_row], organization.id
        )

        result = await session.execute(
            select(MeterEvent).where(MeterEvent.meter_id == meter.id)
        )
        meter_events = result.scalars().all()
        assert len(meter_events) == 1
        meter_event = meter_events[0]
        assert meter_event.event_id == matching_row["id"]
        events_by_id = {event.id: event for event in inserted_events}
        assert meter_event.ingested_at == events_by_id[matching_row["id"]].ingested_at

    async def test_resolves_customers_by_id_and_external_id(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        organization: Organization,
    ) -> None:
        customer = await create_customer(
            save_fixture, organization=organization, email="direct@example.com"
        )
        external_customer = await create_customer(
            save_fixture,
            organization=organization,
            email="external@example.com",
            external_id="ext-123",
        )
        rows = [
            tb_row(customer_id=customer.id),
            tb_row(external_customer_id="ext-123"),
            tb_row(external_customer_id="unknown-external-id"),
        ]

        _, customer_ids = await reingest(session, rows, organization.id)

        assert customer_ids == {customer.id, external_customer.id}

    async def test_inserts_parents_before_children(
        self,
        session: AsyncSession,
        organization: Organization,
    ) -> None:
        root_row = tb_row()
        root_id = root_row["id"]
        child_row = tb_row(parent_id=root_id, root_id=root_id)
        grandchild_row = tb_row(parent_id=child_row["id"], root_id=root_id)

        inserted_events, _ = await reingest(
            session, [grandchild_row, child_row, root_row], organization.id
        )

        assert len(inserted_events) == 3

    async def test_raises_on_dangling_parent_reference(
        self,
        session: AsyncSession,
        organization: Organization,
    ) -> None:
        missing_parent_id = uuid.uuid4()
        row = tb_row(parent_id=missing_parent_id, root_id=missing_parent_id)

        with pytest.raises(ValueError, match=str(missing_parent_id)):
            await reingest(session, [row], organization.id)

    async def test_parent_already_in_postgres(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        organization: Organization,
    ) -> None:
        parent_event_id = uuid.uuid4()
        parent_event = Event(
            id=parent_event_id,
            root_id=parent_event_id,
            name="ai.usage",
            source=EventSource.user,
            organization_id=organization.id,
            user_metadata={},
        )
        await save_fixture(parent_event)
        row = tb_row(parent_id=parent_event.id, root_id=parent_event.id)

        inserted_events, _ = await reingest(session, [row], organization.id)

        assert len(inserted_events) == 1
        assert inserted_events[0].parent_id == parent_event.id

    async def test_idempotent_via_find_missing(
        self,
        session: AsyncSession,
        organization: Organization,
    ) -> None:
        rows = [tb_row(), tb_row()]

        first_missing = await find_missing(session, rows)
        inserted_events, _ = await reingest(session, first_missing, organization.id)
        assert len(inserted_events) == 2

        second_missing = await find_missing(session, rows)
        assert second_missing == []


@pytest.mark.skipif(not tinybird_available(), reason="Tinybird not running")
@pytest.mark.xdist_group(name="tinybird")
@pytest.mark.asyncio
class TestFetchTinybirdRows:
    async def test_round_trip(
        self,
        tinybird_client: TinybirdClient,
        save_fixture: SaveFixture,
        session: AsyncSession,
        organization: Organization,
    ) -> None:
        base = datetime.now(UTC).replace(microsecond=123000) - timedelta(minutes=5)
        start = base - timedelta(hours=1)
        end = base + timedelta(hours=1)

        customer = await create_customer(
            save_fixture, organization=organization, external_id="ext-tb-1"
        )

        def make_event(**kwargs: Any) -> Event:
            defaults: dict[str, Any] = {
                "id": uuid.uuid4(),
                "ingested_at": base,
                "timestamp": base,
                "name": "ai.usage",
                "source": EventSource.user,
                "organization_id": organization.id,
                "user_metadata": {},
            }
            defaults.update(kwargs)
            event = Event(**defaults)
            if event.root_id is None:
                event.root_id = event.id
            return event

        rich = make_event(
            external_customer_id="ext-tb-1",
            external_id="evt-ext-1",
            user_metadata={
                "units": 3,
                "model_label": "GPT-4o",
                "_cost": {"amount": 0.5, "currency": "usd"},
                "_llm": {
                    "vendor": "openai",
                    "model": "gpt-4o",
                    "input_tokens": 10,
                    "output_tokens": 5,
                },
            },
        )
        parent = make_event()
        child = make_event(parent_id=parent.id, root_id=parent.id)
        system_event = make_event(source=EventSource.system, name="order.paid")
        other_org_event = make_event(organization_id=uuid.uuid4())
        out_of_window_event = make_event(ingested_at=base - timedelta(hours=2))

        await tinybird_client.ingest(
            DATASOURCE_EVENTS,
            events_to_tinybird(
                [
                    rich,
                    parent,
                    child,
                    system_event,
                    other_org_event,
                    out_of_window_event,
                ]
            ),
            wait=True,
        )

        rows = await fetch_tinybird_rows(tinybird_client, organization.id, start, end)
        assert {row["id"] for row in rows} == {rich.id, parent.id, child.id}

        missing = await find_missing(session, rows)
        inserted_events, customer_ids = await reingest(
            session, missing, organization.id
        )

        events_by_id = {event.id: event for event in inserted_events}
        assert events_by_id.keys() == {rich.id, parent.id, child.id}

        restored = events_by_id[rich.id]
        assert restored.timestamp == base
        assert restored.ingested_at > base
        assert restored.name == "ai.usage"
        assert restored.source == EventSource.user
        assert restored.external_customer_id == "ext-tb-1"
        assert restored.external_id == "evt-ext-1"
        assert restored.user_metadata == rich.user_metadata
        assert events_by_id[child.id].parent_id == parent.id
        assert events_by_id[child.id].root_id == parent.id
        assert events_by_id[parent.id].root_id == parent.id
        assert customer_ids == {customer.id}
