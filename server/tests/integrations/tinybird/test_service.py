import asyncio
import json
import uuid
from datetime import UTC, datetime

import httpx
import pytest
import respx

from polar.integrations.tinybird.client import TinybirdClient, TinybirdRequestError
from polar.integrations.tinybird.service import (
    DATASOURCE_EVENTS,
    TinybirdEventsQuery,
    TinybirdEventTypesQuery,
    _event_to_tinybird,
)
from polar.models import Event
from polar.models.event import EventSource
from tests.fixtures.tinybird import tinybird_available

pytestmark = pytest.mark.xdist_group(name="tinybird")


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


@pytest.mark.skipif(not tinybird_available(), reason="Tinybird not running")
@pytest.mark.asyncio
class TestTinybirdDelete:
    async def test_delete_by_id(self, tinybird_client: TinybirdClient) -> None:
        org_id = uuid.uuid4()
        events = [
            create_test_event(
                organization_id=org_id, name="delete.test", source=EventSource.system
            ),
            create_test_event(
                organization_id=org_id, name="delete.test", source=EventSource.system
            ),
            create_test_event(
                organization_id=org_id, name="keep.test", source=EventSource.system
            ),
        ]

        tinybird_events = [_event_to_tinybird(e) for e in events]
        await tinybird_client.ingest(DATASOURCE_EVENTS, tinybird_events, wait=True)

        query = TinybirdEventsQuery(org_id)
        stats_before = await query.get_event_type_stats()
        stats_by_name = {s.name: s for s in stats_before}
        assert stats_by_name["delete.test"].occurrences == 2
        assert stats_by_name["keep.test"].occurrences == 1

        event_to_delete = events[0]
        delete_condition = f"id = '{event_to_delete.id}'"
        result = await tinybird_client.delete(DATASOURCE_EVENTS, delete_condition)

        assert "job_id" in result
        job_id = result["job_id"]

        job = await tinybird_client.get_job(job_id)
        while job.get("status") not in ("done", "error"):
            await asyncio.sleep(0.5)
            job = await tinybird_client.get_job(job_id)

        assert job["status"] == "done"

        stats_after = await query.get_event_type_stats()
        stats_by_name_after = {s.name: s for s in stats_after}
        assert stats_by_name_after["delete.test"].occurrences == 1
        assert stats_by_name_after["keep.test"].occurrences == 1

    async def test_delete_multiple_by_id(self, tinybird_client: TinybirdClient) -> None:
        org_id = uuid.uuid4()
        events = [
            create_test_event(
                organization_id=org_id, name="batch.delete", source=EventSource.system
            ),
            create_test_event(
                organization_id=org_id, name="batch.delete", source=EventSource.system
            ),
            create_test_event(
                organization_id=org_id, name="batch.keep", source=EventSource.system
            ),
        ]

        tinybird_events = [_event_to_tinybird(e) for e in events]
        await tinybird_client.ingest(DATASOURCE_EVENTS, tinybird_events, wait=True)

        query = TinybirdEventsQuery(org_id)
        stats_before = await query.get_event_type_stats()
        stats_by_name = {s.name: s for s in stats_before}
        assert stats_by_name["batch.delete"].occurrences == 2
        assert stats_by_name["batch.keep"].occurrences == 1

        ids_to_delete = [str(events[0].id), str(events[1].id)]
        delete_condition = f"id IN ('{ids_to_delete[0]}', '{ids_to_delete[1]}')"
        result = await tinybird_client.delete(DATASOURCE_EVENTS, delete_condition)

        job_id = result["job_id"]
        job = await tinybird_client.get_job(job_id)
        while job.get("status") not in ("done", "error"):
            await asyncio.sleep(0.5)
            job = await tinybird_client.get_job(job_id)

        assert job["status"] == "done"

        stats_after = await query.get_event_type_stats()
        stats_by_name_after = {s.name: s for s in stats_after}
        assert "batch.delete" not in stats_by_name_after
        assert stats_by_name_after["batch.keep"].occurrences == 1


@pytest.mark.asyncio
class TestTinybirdRequestError:
    async def test_endpoint_400_raises_request_error_with_body(self) -> None:
        error_response = {
            "error": "[Error] Illegal type UUID of argument for aggregate function"
        }
        client = TinybirdClient(
            api_url="https://api.tinybird.co",
            clickhouse_url="https://clickhouse.tinybird.co",
            api_token="test_token",
            read_token="test_token",
            clickhouse_username="test",
            clickhouse_token="test_token",
        )

        with respx.mock:
            respx.get("https://api.tinybird.co/v0/pipes/metrics.json").mock(
                return_value=httpx.Response(400, json=error_response)
            )

            with pytest.raises(TinybirdRequestError) as exc_info:
                await client.endpoint("metrics", {"org_ids": "123"})

            error = exc_info.value
            assert error.status_code == 400
            assert error.endpoint == "metrics"
            assert error.error_body == error_response
            assert "Illegal type UUID" in str(error)

    async def test_endpoint_500_raises_request_error(self) -> None:
        client = TinybirdClient(
            api_url="https://api.tinybird.co",
            clickhouse_url="https://clickhouse.tinybird.co",
            api_token="test_token",
            read_token="test_token",
            clickhouse_username="test",
            clickhouse_token="test_token",
        )

        with respx.mock:
            respx.get("https://api.tinybird.co/v0/pipes/metrics.json").mock(
                return_value=httpx.Response(500, text="Internal Server Error")
            )

            with pytest.raises(TinybirdRequestError) as exc_info:
                await client.endpoint("metrics")

            error = exc_info.value
            assert error.status_code == 500
            assert error.endpoint == "metrics"
