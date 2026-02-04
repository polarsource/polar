import json
import uuid
from datetime import UTC, datetime

import pytest

from polar.integrations.tinybird.client import TinybirdClient
from polar.integrations.tinybird.service import (
    DATASOURCE_EVENTS,
    TinybirdEventsQuery,
    TinybirdEventTypesQuery,
    _event_to_tinybird,
)
from polar.models import Event
from polar.models.event import EventSource
from tests.fixtures.tinybird import tinybird_available


def create_test_event(
    *,
    organization_id: uuid.UUID | None = None,
    name: str = "test.event",
    source: EventSource = EventSource.system,
    user_metadata: dict[str, object] | None = None,
) -> Event:
    """Create an Event object for testing (not persisted to DB)."""
    now = datetime.now(UTC)
    event = Event(
        id=uuid.uuid4(),
        ingested_at=now,
        timestamp=now,
        name=name,
        source=source,
        organization_id=organization_id or uuid.uuid4(),
        user_metadata=user_metadata or {},
    )
    return event


class TestEventToTinybird:
    def test_basic_conversion(self) -> None:
        event = create_test_event(name="order.paid")
        result = _event_to_tinybird(event)

        assert result["id"] == str(event.id)
        assert result["name"] == "order.paid"
        assert result["source"] == "system"
        assert result["organization_id"] == str(event.organization_id)
        assert result["user_metadata"] == "{}"

    def test_system_event_denormalizes_metadata(self) -> None:
        event = create_test_event(
            name="order.paid",
            source=EventSource.system,
            user_metadata={
                "amount": 1000,
                "currency": "usd",
                "order_id": "order_123",
            },
        )
        result = _event_to_tinybird(event)

        assert result["amount"] == 1000
        assert result["currency"] == "usd"
        assert result["order_id"] == "order_123"
        assert result["user_metadata"] == "{}"

    def test_user_event_does_not_denormalize_metadata(self) -> None:
        event = create_test_event(
            name="custom.event",
            source=EventSource.user,
            user_metadata={
                "meter_id": "meter_credits_usage",
                "amount": 0.24,
                "currency": "usd",
            },
        )
        result = _event_to_tinybird(event)

        assert result["meter_id"] is None
        assert result["amount"] is None
        assert result["currency"] is None
        metadata = json.loads(result["user_metadata"])
        assert metadata["meter_id"] == "meter_credits_usage"
        assert metadata["amount"] == 0.24
        assert metadata["currency"] == "usd"

    def test_user_event_still_extracts_cost_and_llm(self) -> None:
        event = create_test_event(
            name="llm.request",
            source=EventSource.user,
            user_metadata={
                "_cost": {"amount": 0.05, "currency": "usd"},
                "_llm": {
                    "vendor": "openai",
                    "model": "gpt-4",
                    "input_tokens": 100,
                    "output_tokens": 50,
                },
            },
        )
        result = _event_to_tinybird(event)

        assert result["source"] == "user"
        assert result["cost_amount"] == 0.05
        assert result["cost_currency"] == "usd"
        assert result["llm_vendor"] == "openai"
        assert result["llm_model"] == "gpt-4"
        assert result["llm_input_tokens"] == 100
        assert result["llm_output_tokens"] == 50
        assert result["user_metadata"] == "{}"

    def test_nullable_fields_are_none(self) -> None:
        event = create_test_event()
        result = _event_to_tinybird(event)

        assert result["customer_id"] is None
        assert result["external_customer_id"] is None
        assert result["parent_id"] is None
        assert result["meter_id"] is None
        assert result["amount"] is None


@pytest.mark.skipif(not tinybird_available(), reason="Tinybird not running")
@pytest.mark.asyncio
class TestTinybirdEventsQuery:
    async def test_get_event_type_stats(self, tinybird_client: TinybirdClient) -> None:
        org_id = uuid.uuid4()
        events = [
            create_test_event(
                organization_id=org_id,
                name="order.created",
                source=EventSource.system,
            ),
            create_test_event(
                organization_id=org_id,
                name="order.created",
                source=EventSource.system,
            ),
            create_test_event(
                organization_id=org_id,
                name="order.created",
                source=EventSource.system,
            ),
            create_test_event(
                organization_id=org_id,
                name="subscription.created",
                source=EventSource.system,
            ),
            create_test_event(
                organization_id=org_id,
                name="custom.event",
                source=EventSource.user,
            ),
        ]

        tinybird_events = [_event_to_tinybird(e) for e in events]
        await tinybird_client.ingest(DATASOURCE_EVENTS, tinybird_events, wait=True)

        query = TinybirdEventsQuery(org_id)
        stats = await query.get_event_type_stats()

        stats_by_name = {(s.name, s.source): s for s in stats}

        assert len(stats) == 3
        assert stats_by_name[("order.created", EventSource.system)].occurrences == 3
        assert (
            stats_by_name[("subscription.created", EventSource.system)].occurrences == 1
        )
        assert stats_by_name[("custom.event", EventSource.user)].occurrences == 1

    async def test_filter_by_source(self, tinybird_client: TinybirdClient) -> None:
        org_id = uuid.uuid4()
        events = [
            create_test_event(
                organization_id=org_id, name="system.event", source=EventSource.system
            ),
            create_test_event(
                organization_id=org_id, name="system.event", source=EventSource.system
            ),
            create_test_event(
                organization_id=org_id, name="user.event", source=EventSource.user
            ),
        ]

        tinybird_events = [_event_to_tinybird(e) for e in events]
        await tinybird_client.ingest(DATASOURCE_EVENTS, tinybird_events, wait=True)

        query = TinybirdEventsQuery(org_id).filter_source(EventSource.user)
        stats = await query.get_event_type_stats()

        assert len(stats) == 1
        assert stats[0].name == "user.event"
        assert stats[0].occurrences == 1

    async def test_filter_by_customer_id(self, tinybird_client: TinybirdClient) -> None:
        org_id = uuid.uuid4()
        customer_1 = uuid.uuid4()
        customer_2 = uuid.uuid4()

        events = [
            create_test_event(
                organization_id=org_id, name="event.a", source=EventSource.user
            ),
            create_test_event(
                organization_id=org_id, name="event.a", source=EventSource.user
            ),
            create_test_event(
                organization_id=org_id, name="event.b", source=EventSource.user
            ),
        ]
        events[0].customer_id = customer_1
        events[1].customer_id = customer_1
        events[2].customer_id = customer_2

        tinybird_events = [_event_to_tinybird(e) for e in events]
        await tinybird_client.ingest(DATASOURCE_EVENTS, tinybird_events, wait=True)

        query = TinybirdEventsQuery(org_id).filter_customer_id([customer_1])
        stats = await query.get_event_type_stats()

        assert len(stats) == 1
        assert stats[0].name == "event.a"
        assert stats[0].occurrences == 2

    async def test_get_event_type_stats_from_mv(
        self, tinybird_client: TinybirdClient
    ) -> None:
        org_id = uuid.uuid4()
        customer_id = uuid.uuid4()
        events = [
            create_test_event(organization_id=org_id, name="page.viewed"),
            create_test_event(organization_id=org_id, name="page.viewed"),
            create_test_event(organization_id=org_id, name="page.viewed"),
            create_test_event(organization_id=org_id, name="page.viewed"),
            create_test_event(organization_id=org_id, name="button.clicked"),
            create_test_event(organization_id=org_id, name="button.clicked"),
            create_test_event(organization_id=org_id, name="form.submitted"),
        ]
        for e in events:
            e.customer_id = customer_id

        tinybird_events = [_event_to_tinybird(e) for e in events]
        await tinybird_client.ingest(DATASOURCE_EVENTS, tinybird_events, wait=True)

        query = TinybirdEventTypesQuery(org_id)
        stats = await query.get_event_type_stats()

        stats_by_name = {s.name: s for s in stats}
        assert len(stats) == 3
        assert stats_by_name["page.viewed"].occurrences == 4
        assert stats_by_name["button.clicked"].occurrences == 2
        assert stats_by_name["form.submitted"].occurrences == 1

    async def test_organization_isolation(
        self, tinybird_client: TinybirdClient
    ) -> None:
        org_1 = uuid.uuid4()
        org_2 = uuid.uuid4()

        events = [
            create_test_event(
                organization_id=org_1, name="org1.event", source=EventSource.system
            ),
            create_test_event(
                organization_id=org_1, name="org1.event", source=EventSource.system
            ),
            create_test_event(
                organization_id=org_2, name="org2.event", source=EventSource.system
            ),
        ]

        tinybird_events = [_event_to_tinybird(e) for e in events]
        await tinybird_client.ingest(DATASOURCE_EVENTS, tinybird_events, wait=True)

        query = TinybirdEventsQuery(org_1)
        stats = await query.get_event_type_stats()

        assert len(stats) == 1
        assert stats[0].name == "org1.event"
        assert stats[0].occurrences == 2
