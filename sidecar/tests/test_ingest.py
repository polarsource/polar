import httpx
import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from polar.models import Event


@pytest.mark.asyncio
async def test_ingest_buffers_unacknowledged(
    client: httpx.AsyncClient, session: AsyncSession
) -> None:
    response = await client.post(
        "/v1/events/ingest",
        json={
            "events": [
                {"name": "usage", "external_customer_id": "cus_1", "external_id": "e1"},
                {"name": "usage", "external_customer_id": "cus_2", "external_id": "e2"},
            ]
        },
    )

    assert response.status_code == 200
    assert response.json() == {"inserted": 2, "duplicates": 0}

    events = (await session.execute(select(Event).order_by(Event.id))).scalars().all()
    assert [event.external_id for event in events] == ["e1", "e2"]
    assert all(event.acknowledged_at is None for event in events)
    assert all("timestamp" in event.body for event in events)


@pytest.mark.asyncio
async def test_ingest_requires_external_id(
    client: httpx.AsyncClient, session: AsyncSession
) -> None:
    response = await client.post(
        "/v1/events/ingest",
        json={"events": [{"name": "usage", "external_customer_id": "cus_1"}]},
    )

    assert response.status_code == 422
    assert response.json()["detail"][0]["loc"] == ["body", "events", 0, "external_id"]

    count = len((await session.execute(select(Event))).scalars().all())
    assert count == 0


@pytest.mark.asyncio
async def test_ingest_dedupes_within_batch(client: httpx.AsyncClient) -> None:
    response = await client.post(
        "/v1/events/ingest",
        json={
            "events": [
                {
                    "name": "usage",
                    "external_customer_id": "cus_1",
                    "external_id": "dup",
                },
                {
                    "name": "usage",
                    "external_customer_id": "cus_1",
                    "external_id": "dup",
                },
            ]
        },
    )

    assert response.status_code == 200
    assert response.json() == {"inserted": 1, "duplicates": 1}


@pytest.mark.asyncio
async def test_ingest_dedupes_across_requests(
    client: httpx.AsyncClient, session: AsyncSession
) -> None:
    first = await client.post(
        "/v1/events/ingest",
        json={
            "events": [
                {"name": "usage", "external_customer_id": "c", "external_id": "e1"}
            ]
        },
    )
    assert first.json() == {"inserted": 1, "duplicates": 0}

    second = await client.post(
        "/v1/events/ingest",
        json={
            "events": [
                {"name": "usage", "external_customer_id": "c", "external_id": "e1"},
                {"name": "usage", "external_customer_id": "c", "external_id": "e9"},
            ]
        },
    )
    assert second.json() == {"inserted": 1, "duplicates": 1}

    external_ids = sorted(
        (await session.execute(select(Event.external_id))).scalars().all()
    )
    assert external_ids == ["e1", "e9"]
