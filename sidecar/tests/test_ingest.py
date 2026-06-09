import httpx
import pytest
from httpx import ASGITransport
from sqlalchemy import select

from polar.app import app
from polar.db import async_session, init_db
from polar.models import Event


@pytest.mark.asyncio
async def test_ingest_buffers_events_unacknowledged() -> None:
    await init_db()

    transport = ASGITransport(app=app)
    async with httpx.AsyncClient(
        transport=transport, base_url="http://testserver"
    ) as client:
        response = await client.post(
            "/v1/events/ingest",
            json={
                "events": [
                    {
                        "name": "ai_usage",
                        "external_customer_id": "cus_1",
                        "external_id": "evt_1",
                    },
                    {"name": "ai_usage", "external_customer_id": "cus_2"},
                ]
            },
        )

    assert response.status_code == 200
    assert response.json() == {"inserted": 2, "duplicates": 0}

    async with async_session() as session:
        events = (
            (await session.execute(select(Event).order_by(Event.id))).scalars().all()
        )

    assert len(events) == 2
    assert [event.external_id for event in events] == ["evt_1", None]
    assert all(event.acknowledged_at is None for event in events)
    assert all("timestamp" in event.body for event in events)
    assert events[0].body["name"] == "ai_usage"
