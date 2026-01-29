import uuid
from datetime import UTC, datetime

import pytest

from polar.config import settings
from polar.integrations.tinybird.client import TinybirdClient
from polar.integrations.tinybird.service import DATASOURCE_EVENTS, _event_to_tinybird
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
    now = datetime.now(UTC)
    return Event(
        id=uuid.uuid4(),
        ingested_at=now,
        timestamp=now,
        name=name,
        source=source,
        organization_id=organization_id or uuid.uuid4(),
        user_metadata=user_metadata or {},
    )


@pytest.mark.skipif(not tinybird_available(), reason="Tinybird not running")
@pytest.mark.asyncio
class TestTinybirdE2E:
    async def test_ingest_and_query(self, tinybird_workspace: str) -> None:
        """Verify events can be ingested and queried back."""
        token = tinybird_workspace
        client = TinybirdClient(
            api_url=settings.TINYBIRD_API_URL,
            clickhouse_url=settings.TINYBIRD_CLICKHOUSE_URL,
            api_token=token,
            clickhouse_token=token,
        )

        event = create_test_event(name="test.e2e.event")
        tinybird_event = _event_to_tinybird(event)

        await client.ingest(DATASOURCE_EVENTS, [tinybird_event], wait=True)

        rows = await client.query(
            f"SELECT * FROM {DATASOURCE_EVENTS} WHERE id = '{event.id}'"
        )
        assert len(rows) == 1
        assert rows[0]["name"] == "test.e2e.event"

    async def test_ingest_multiple_and_aggregate(self, tinybird_workspace: str) -> None:
        """Verify multiple events can be ingested and aggregated."""
        token = tinybird_workspace
        client = TinybirdClient(
            api_url=settings.TINYBIRD_API_URL,
            clickhouse_url=settings.TINYBIRD_CLICKHOUSE_URL,
            api_token=token,
            clickhouse_token=token,
        )

        org_id = uuid.uuid4()
        events = [
            create_test_event(organization_id=org_id, name="order.created"),
            create_test_event(organization_id=org_id, name="order.created"),
            create_test_event(organization_id=org_id, name="order.created"),
            create_test_event(organization_id=org_id, name="subscription.created"),
            create_test_event(organization_id=org_id, name="subscription.created"),
            create_test_event(organization_id=org_id, name="subscription.canceled"),
        ]
        tinybird_events = [_event_to_tinybird(e) for e in events]

        await client.ingest(DATASOURCE_EVENTS, tinybird_events, wait=True)

        rows = await client.query(f"""
            SELECT name, count() as count
            FROM {DATASOURCE_EVENTS}
            WHERE organization_id = '{org_id}'
            GROUP BY name
            ORDER BY count DESC
        """)

        assert len(rows) == 3
        assert rows[0]["name"] == "order.created"
        assert rows[0]["count"] == 3
        assert rows[1]["name"] == "subscription.created"
        assert rows[1]["count"] == 2
        assert rows[2]["name"] == "subscription.canceled"
        assert rows[2]["count"] == 1

    async def test_event_types_materialized_view(self, tinybird_workspace: str) -> None:
        """Verify the event_types_by_customer_id materialized view aggregates correctly."""
        token = tinybird_workspace
        client = TinybirdClient(
            api_url=settings.TINYBIRD_API_URL,
            clickhouse_url=settings.TINYBIRD_CLICKHOUSE_URL,
            api_token=token,
            clickhouse_token=token,
        )

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

        await client.ingest(DATASOURCE_EVENTS, tinybird_events, wait=True)

        rows = await client.query(f"""
            SELECT
                name,
                countMerge(occurrences) as occurrences
            FROM event_types_by_customer_id
            WHERE organization_id = '{org_id}' AND customer_id = '{customer_id}'
            GROUP BY name
            ORDER BY occurrences DESC
        """)

        assert len(rows) == 3
        assert rows[0]["name"] == "page.viewed"
        assert rows[0]["occurrences"] == 4
        assert rows[1]["name"] == "button.clicked"
        assert rows[1]["occurrences"] == 2
        assert rows[2]["name"] == "form.submitted"
        assert rows[2]["occurrences"] == 1
