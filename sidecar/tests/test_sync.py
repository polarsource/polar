from collections.abc import AsyncIterator

import httpx
import pytest
import pytest_asyncio
from sqlalchemy import delete, select

from polar.db import async_session, init_db
from polar.models import Event
from polar.sync import flush_once


@pytest_asyncio.fixture(autouse=True)
async def _clean_events() -> AsyncIterator[None]:
    await init_db()
    async with async_session() as session:
        await session.execute(delete(Event))
        await session.commit()
    yield
    async with async_session() as session:
        await session.execute(delete(Event))
        await session.commit()


@pytest.mark.asyncio
async def test_flush_records_polar_event_ids() -> None:
    async with async_session() as session:
        session.add_all(
            [
                Event(external_id="e1", body={"name": "usage", "external_id": "e1"}),
                Event(external_id="e2", body={"name": "usage", "external_id": "e2"}),
            ]
        )
        await session.commit()

    captured: dict[str, str | None] = {}

    def handler(request: httpx.Request) -> httpx.Response:
        captured["return_events"] = request.url.params.get("return_events")
        return httpx.Response(
            200,
            json={
                "inserted": 2,
                "duplicates": 0,
                "events": [
                    {"id": "polar_1", "external_id": "e1"},
                    {"id": "polar_2", "external_id": "e2"},
                ],
            },
        )

    async with httpx.AsyncClient(
        transport=httpx.MockTransport(handler), base_url="http://testserver"
    ) as client:
        await flush_once(client)

    assert captured["return_events"] == "true"
    async with async_session() as session:
        events = (
            (await session.execute(select(Event).order_by(Event.id))).scalars().all()
        )

    assert all(event.acknowledged_at is not None for event in events)
    assert {event.external_id: event.polar_event_id for event in events} == {
        "e1": "polar_1",
        "e2": "polar_2",
    }


@pytest.mark.asyncio
async def test_flush_acknowledges_duplicates_without_polar_id() -> None:
    """Re-flushed events upstream already had come back absent from `events`;
    they still get acknowledged but keep a NULL polar_event_id (delta-conservative)."""
    async with async_session() as session:
        session.add_all(
            [
                Event(external_id="e1", body={"name": "usage", "external_id": "e1"}),
                Event(external_id="e2", body={"name": "usage", "external_id": "e2"}),
            ]
        )
        await session.commit()

    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(
            200,
            json={
                "inserted": 1,
                "duplicates": 1,
                "events": [{"id": "polar_1", "external_id": "e1"}],
            },
        )

    async with httpx.AsyncClient(
        transport=httpx.MockTransport(handler), base_url="http://testserver"
    ) as client:
        await flush_once(client)

    async with async_session() as session:
        events = (
            (await session.execute(select(Event).order_by(Event.id))).scalars().all()
        )

    assert all(event.acknowledged_at is not None for event in events)
    assert {event.external_id: event.polar_event_id for event in events} == {
        "e1": "polar_1",
        "e2": None,
    }
