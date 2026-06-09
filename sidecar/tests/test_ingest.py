from typing import Any

import httpx
import pytest
from httpx import ASGITransport
from sqlalchemy import select

from polar.app import app
from polar.db import async_session
from polar.models import Event


async def _ingest(events: list[dict[str, Any]]) -> httpx.Response:
    transport = ASGITransport(app=app)
    async with httpx.AsyncClient(
        transport=transport, base_url="http://testserver"
    ) as client:
        return await client.post("/v1/events/ingest", json={"events": events})


@pytest.mark.asyncio
async def test_ingest_buffers_unacknowledged() -> None:
    response = await _ingest(
        [
            {"name": "usage", "external_customer_id": "cus_1", "external_id": "evt_1"},
            {"name": "usage", "external_customer_id": "cus_2", "external_id": "evt_2"},
        ]
    )

    assert response.status_code == 200
    assert response.json() == {"inserted": 2, "duplicates": 0}

    async with async_session() as session:
        events = (
            (await session.execute(select(Event).order_by(Event.id))).scalars().all()
        )

    assert [event.external_id for event in events] == ["evt_1", "evt_2"]
    assert all(event.acknowledged_at is None for event in events)
    assert all("timestamp" in event.body for event in events)


@pytest.mark.asyncio
async def test_ingest_requires_external_id() -> None:
    response = await _ingest([{"name": "usage", "external_customer_id": "cus_1"}])

    assert response.status_code == 422
    assert response.json()["detail"][0]["loc"] == ["body", "events", 0, "external_id"]

    async with async_session() as session:
        count = len((await session.execute(select(Event))).scalars().all())
    assert count == 0


@pytest.mark.asyncio
async def test_ingest_dedupes_within_batch() -> None:
    response = await _ingest(
        [
            {"name": "usage", "external_customer_id": "cus_1", "external_id": "dup"},
            {"name": "usage", "external_customer_id": "cus_1", "external_id": "dup"},
        ]
    )

    assert response.status_code == 200
    assert response.json() == {"inserted": 1, "duplicates": 1}


@pytest.mark.asyncio
async def test_ingest_dedupes_across_requests() -> None:
    first = await _ingest(
        [{"name": "usage", "external_customer_id": "cus_1", "external_id": "evt_1"}]
    )
    assert first.json() == {"inserted": 1, "duplicates": 0}

    second = await _ingest(
        [
            {"name": "usage", "external_customer_id": "cus_1", "external_id": "evt_1"},
            {"name": "usage", "external_customer_id": "cus_1", "external_id": "evt_9"},
        ]
    )
    assert second.json() == {"inserted": 1, "duplicates": 1}

    async with async_session() as session:
        external_ids = sorted(
            (await session.execute(select(Event.external_id))).scalars().all()
        )
    assert external_ids == ["evt_1", "evt_9"]
