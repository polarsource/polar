from collections.abc import AsyncIterator
from datetime import UTC, datetime
from typing import Any

import httpx
import pytest
import pytest_asyncio
from sqlalchemy import delete

from polar.db import async_session, init_db
from polar.models import CustomerMeter, Event
from polar.poll import poll_once
from polar.repository import CustomerMeterRepository

FILTER = {
    "conjunction": "and",
    "clauses": [{"property": "name", "operator": "eq", "value": "ai_usage"}],
}
SUM_TOKENS = {"func": "sum", "property": "tokens"}


def _event(external_id: str, polar_event_id: str, tokens: int) -> Event:
    return Event(
        external_id=external_id,
        polar_event_id=polar_event_id,
        body={
            "name": "ai_usage",
            "external_customer_id": "cus_1",
            "timestamp": "2026-06-09T10:00:00+00:00",
            "metadata": {"tokens": tokens},
        },
    )


def _cached_meter(*, consumed: float, last_balanced: str) -> CustomerMeter:
    return CustomerMeter(
        id="cm_1",
        customer_id="cus_uuid",
        meter_id="m1",
        external_customer_id="cus_1",
        filter=FILTER,
        aggregation=SUM_TOKENS,
        consumed_units=consumed,
        credited_units=100,
        balance=100 - consumed,
        last_balanced_event_id=last_balanced,
        snapshot={"id": "cm_1", "consumed_units": consumed},
        polled_at=datetime(2026, 6, 9, 10, 0, tzinfo=UTC),
    )


def _upstream_payload(*, consumed: float, last_balanced: str) -> dict[str, Any]:
    return {
        "items": [
            {
                "id": "cm_1",
                "created_at": "2026-06-09T10:00:00Z",
                "modified_at": "2026-06-09T10:00:00Z",
                "customer_id": "cus_uuid",
                "meter_id": "m1",
                "consumed_units": consumed,
                "credited_units": 100,
                "balance": 100 - consumed,
                "last_balanced_event_id": last_balanced,
                "customer": {"id": "cus_uuid", "external_id": "cus_1"},
                "meter": {"filter": FILTER, "aggregation": SUM_TOKENS},
            }
        ],
        "pagination": {"total_count": 1, "max_page": 1},
    }


@pytest_asyncio.fixture(autouse=True)
async def _clean() -> AsyncIterator[None]:
    await init_db()
    async with async_session() as session:
        await session.execute(delete(Event))
        await session.execute(delete(CustomerMeter))
        await session.commit()
    yield
    async with async_session() as session:
        await session.execute(delete(Event))
        await session.execute(delete(CustomerMeter))
        await session.commit()


def _client(handler: Any) -> httpx.AsyncClient:
    return httpx.AsyncClient(
        transport=httpx.MockTransport(handler), base_url="http://upstream"
    )


@pytest.mark.asyncio
async def test_poll_refreshes_dirty_customer() -> None:
    async with async_session() as session:
        session.add(_cached_meter(consumed=5.0, last_balanced="polar_w"))
        session.add_all([_event("e0", "polar_w", 5), _event("e1", "polar_1", 3)])
        await session.commit()

    requests: list[str] = []

    def handler(request: httpx.Request) -> httpx.Response:
        requests.append(str(request.url))
        return httpx.Response(
            200, json=_upstream_payload(consumed=8.0, last_balanced="polar_1")
        )

    async with _client(handler) as client:
        await poll_once(client)

    assert any("external_customer_id=cus_1" in url for url in requests)
    async with async_session() as session:
        cached = await CustomerMeterRepository(session).get_by_id("cm_1")
    assert cached is not None
    assert cached.consumed_units == 8.0  # base advanced
    assert cached.last_balanced_event_id == "polar_1"


@pytest.mark.asyncio
async def test_poll_skips_converged_customer() -> None:
    async with async_session() as session:
        # watermark == latest matching event → nothing past it → converged
        session.add(_cached_meter(consumed=8.0, last_balanced="polar_1"))
        session.add_all([_event("e0", "polar_w", 5), _event("e1", "polar_1", 3)])
        await session.commit()

    requests: list[str] = []

    def handler(request: httpx.Request) -> httpx.Response:
        requests.append(str(request.url))
        return httpx.Response(200, json={"items": [], "pagination": {}})

    async with _client(handler) as client:
        await poll_once(client)

    assert requests == []


@pytest.mark.asyncio
async def test_poll_rearms_on_new_event() -> None:
    async with async_session() as session:
        # converged base, then a brand-new unflushed event lands → dirty again
        session.add(_cached_meter(consumed=8.0, last_balanced="polar_1"))
        session.add_all(
            [
                _event("e0", "polar_w", 5),
                _event("e1", "polar_1", 3),
                _event("e2", None, 7),  # not yet flushed, past the watermark
            ]
        )
        await session.commit()

    requests: list[str] = []

    def handler(request: httpx.Request) -> httpx.Response:
        requests.append(str(request.url))
        return httpx.Response(
            200, json=_upstream_payload(consumed=8.0, last_balanced="polar_1")
        )

    async with _client(handler) as client:
        await poll_once(client)

    assert any("external_customer_id=cus_1" in url for url in requests)


@pytest.mark.asyncio
async def test_poll_with_empty_cache_makes_no_requests() -> None:
    requests: list[str] = []

    def handler(request: httpx.Request) -> httpx.Response:
        requests.append(str(request.url))
        return httpx.Response(200, json={"items": [], "pagination": {}})

    async with _client(handler) as client:
        await poll_once(client)

    assert requests == []
