from collections.abc import AsyncIterator, Callable
from typing import Any

import httpx
import pytest
import pytest_asyncio
from sqlalchemy.ext.asyncio import AsyncSession

from polar.app import app
from polar.models import Event

FILTER = {
    "conjunction": "and",
    "clauses": [{"property": "name", "operator": "eq", "value": "ai_usage"}],
}
SUM_TOKENS = {"func": "sum", "property": "tokens"}
COUNT = {"func": "count"}
MAX_TOKENS = {"func": "max", "property": "tokens"}


def _event(
    external_id: str,
    polar_event_id: str | None,
    *,
    tokens: int,
    name: str = "ai_usage",
    external_customer_id: str = "cus_1",
) -> Event:
    return Event(
        external_id=external_id,
        polar_event_id=polar_event_id,
        body={
            "name": name,
            "external_customer_id": external_customer_id,
            "timestamp": "2026-06-09T10:00:00+00:00",
            "metadata": {"tokens": tokens},
        },
    )


def _meter(
    *,
    consumed: float,
    credited: int,
    last_balanced: str | None,
    aggregation: dict[str, Any],
    filter: dict[str, Any] = FILTER,
) -> dict[str, Any]:
    return {
        "id": "cm_1",
        "created_at": "2026-06-09T10:00:00Z",
        "modified_at": "2026-06-09T10:00:00Z",
        "customer_id": "cus_uuid",
        "meter_id": "meter_uuid",
        "consumed_units": consumed,
        "credited_units": credited,
        "balance": credited - consumed,
        "last_balanced_event_id": last_balanced,
        "customer": {"id": "cus_uuid", "external_id": "cus_1"},
        "meter": {"filter": filter, "aggregation": aggregation},
    }


def _list(*meters: dict[str, Any]) -> dict[str, Any]:
    return {
        "items": list(meters),
        "pagination": {"total_count": len(meters), "max_page": 1},
    }


@pytest_asyncio.fixture
async def set_upstream() -> AsyncIterator[Callable[..., None]]:
    clients: list[httpx.AsyncClient] = []

    def _set(payload: dict[str, Any], status: int = 200) -> None:
        def handler(request: httpx.Request) -> httpx.Response:
            return httpx.Response(status, json=payload)

        upstream = httpx.AsyncClient(
            transport=httpx.MockTransport(handler), base_url="http://upstream"
        )
        app.state.client = upstream
        clients.append(upstream)

    yield _set

    for upstream in clients:
        await upstream.aclose()


@pytest.mark.asyncio
async def test_list_merges_sum_delta_past_watermark(
    client: httpx.AsyncClient,
    session: AsyncSession,
    set_upstream: Callable[..., None],
) -> None:
    session.add_all(
        [
            _event("e0", "polar_w", tokens=5),  # the watermark
            _event("e1", "polar_1", tokens=3),  # flushed, past watermark
            _event("e2", None, tokens=7),  # buffered, not yet flushed
        ]
    )
    await session.flush()
    set_upstream(
        _list(
            _meter(
                consumed=5,
                credited=100,
                last_balanced="polar_w",
                aggregation=SUM_TOKENS,
            )
        )
    )

    response = await client.get("/v1/customer-meters/")

    assert response.status_code == 200
    item = response.json()["items"][0]
    assert item["consumed_units"] == 15.0  # 5 upstream + (3 + 7) delta
    assert item["balance"] == 85.0


@pytest.mark.asyncio
async def test_list_merges_count_delta(
    client: httpx.AsyncClient,
    session: AsyncSession,
    set_upstream: Callable[..., None],
) -> None:
    session.add_all(
        [
            _event("e0", "polar_w", tokens=5),
            _event("e1", "polar_1", tokens=3),
            _event("e2", None, tokens=7),
        ]
    )
    await session.flush()
    set_upstream(
        _list(
            _meter(consumed=1, credited=10, last_balanced="polar_w", aggregation=COUNT)
        )
    )

    response = await client.get("/v1/customer-meters/")

    item = response.json()["items"][0]
    assert item["consumed_units"] == 3.0  # 1 upstream + 2 events past watermark
    assert item["balance"] == 7.0


@pytest.mark.asyncio
async def test_non_summable_aggregation_passes_through(
    client: httpx.AsyncClient,
    session: AsyncSession,
    set_upstream: Callable[..., None],
) -> None:
    session.add_all([_event("e1", "polar_1", tokens=3)])
    await session.flush()
    set_upstream(
        _list(
            _meter(
                consumed=5,
                credited=100,
                last_balanced="polar_w",
                aggregation=MAX_TOKENS,
            )
        )
    )

    response = await client.get("/v1/customer-meters/")

    item = response.json()["items"][0]
    assert item["consumed_units"] == 5
    assert item["balance"] == 95


@pytest.mark.asyncio
async def test_null_watermark_counts_all_matching_events(
    client: httpx.AsyncClient,
    session: AsyncSession,
    set_upstream: Callable[..., None],
) -> None:
    session.add_all(
        [
            _event("e0", "polar_0", tokens=5),
            _event("e1", "polar_1", tokens=3),
            _event("e2", None, tokens=7),
        ]
    )
    await session.flush()
    set_upstream(
        _list(
            _meter(consumed=0, credited=100, last_balanced=None, aggregation=SUM_TOKENS)
        )
    )

    response = await client.get("/v1/customer-meters/")

    item = response.json()["items"][0]
    assert item["consumed_units"] == 15.0  # nothing balanced upstream → all local
    assert item["balance"] == 85.0


@pytest.mark.asyncio
async def test_missing_watermark_passes_through(
    client: httpx.AsyncClient,
    session: AsyncSession,
    set_upstream: Callable[..., None],
) -> None:
    session.add_all([_event("e1", "polar_1", tokens=3)])
    await session.flush()
    set_upstream(
        _list(
            _meter(
                consumed=5,
                credited=100,
                last_balanced="polar_missing",
                aggregation=SUM_TOKENS,
            )
        )
    )

    response = await client.get("/v1/customer-meters/")

    item = response.json()["items"][0]
    assert item["consumed_units"] == 5  # watermark not local → upstream untouched
    assert item["balance"] == 95


@pytest.mark.asyncio
async def test_delta_respects_filter_and_customer(
    client: httpx.AsyncClient,
    session: AsyncSession,
    set_upstream: Callable[..., None],
) -> None:
    session.add_all(
        [
            _event("e0", "polar_w", tokens=5),
            _event("e1", "polar_1", tokens=3),  # matches
            _event("e_name", "polar_2", tokens=100, name="other"),  # filtered out
            _event("e_cust", "polar_3", tokens=100, external_customer_id="cus_2"),
        ]
    )
    await session.flush()
    set_upstream(
        _list(
            _meter(
                consumed=5,
                credited=100,
                last_balanced="polar_w",
                aggregation=SUM_TOKENS,
            )
        )
    )

    response = await client.get("/v1/customer-meters/")

    item = response.json()["items"][0]
    assert item["consumed_units"] == 8.0  # 5 upstream + only e1 (3)
    assert item["balance"] == 92.0


@pytest.mark.asyncio
async def test_get_by_id_merges(
    client: httpx.AsyncClient,
    session: AsyncSession,
    set_upstream: Callable[..., None],
) -> None:
    session.add_all(
        [
            _event("e0", "polar_w", tokens=5),
            _event("e1", "polar_1", tokens=3),
        ]
    )
    await session.flush()
    set_upstream(
        _meter(
            consumed=5, credited=100, last_balanced="polar_w", aggregation=SUM_TOKENS
        )
    )

    response = await client.get("/v1/customer-meters/cm_1")

    body = response.json()
    assert body["consumed_units"] == 8.0
    assert body["balance"] == 92.0
