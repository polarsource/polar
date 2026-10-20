import asyncio
import collections.abc
import datetime
import json
import typing

import httpx
import pytest
from httpx_ws.transport import ASGIWebSocketTransport
from pytest_codspeed import BenchmarkFixture
from redis import Redis

from polar.ingestion import EventInput
from polar.outpost.client import Outpost
from polar.outpost.reducer import BUCKET_SIZE, Filter, Reducer
from tests.benchmarks import BUCKET_COUNTS, COLD_UNTIL, encode_state

pytestmark = pytest.mark.benchmark

LLM_CALLS: Filter = {
    "conjunction": "and",
    "clauses": [{"property": "name", "operator": "eq", "value": "llm.call"}],
}
# Every event feeds `tokens`; an LLM call also feeds `calls` and `cost`.
REDUCERS: list[Reducer] = [
    {
        "id": "tokens",
        "meter_ids": ["tokens"],
        "filter": {"conjunction": "and", "clauses": []},
        "aggregation": {"func": "sum", "property": "tokens"},
    },
    {
        "id": "calls",
        "meter_ids": ["calls"],
        "filter": LLM_CALLS,
        "aggregation": {"func": "count"},
    },
    {
        "id": "cost",
        "meter_ids": ["cost"],
        "filter": LLM_CALLS,
        "aggregation": {"func": "sum", "property": "cost"},
    },
]


def timestamp_of(bucket_start: int) -> str:
    return datetime.datetime.fromtimestamp(
        bucket_start / 1_000_000, datetime.UTC
    ).isoformat()


# Polar's side of the WebSocket: the configuration, nothing else. Snapshots only matter to reads.
async def polar_server(
    scope: typing.Any, receive: typing.Any, send: typing.Any
) -> None:
    await receive()
    await send({"type": "websocket.accept"})
    await send(
        {
            "type": "websocket.send",
            "text": json.dumps({"type": "connection", "payload": {"id": "bench"}}),
        }
    )
    while (message := await receive())["type"] != "websocket.disconnect":
        if json.loads(message["text"])["type"] == "configuration":
            payload = {"reducers": REDUCERS}
            await send(
                {
                    "type": "websocket.send",
                    "text": json.dumps({"type": "configuration", "payload": payload}),
                }
            )


# One task holds the Outpost open, since a task group must close in the task that opened it;
# the benchmarks drive ingest from their own tasks on the same loop.
@pytest.fixture(scope="module")
def outpost(
    loop: asyncio.AbstractEventLoop, redis_socket: str
) -> collections.abc.Iterator[Outpost]:
    with Redis(unix_socket_path=redis_socket) as redis:
        for buckets in BUCKET_COUNTS:
            key = f"outpost:state:external:alice-{buckets}:tokens"
            redis.hset(key, items=encode_state(buckets))
        for reducer in REDUCERS:
            key = f"outpost:state:external:bob:{reducer['id']}"
            redis.hset(key, items=encode_state(1))

    client = httpx.AsyncClient(
        base_url="http://polar.test", transport=ASGIWebSocketTransport(polar_server)
    )
    outpost = Outpost(f"unix://{redis_socket}", client=client, telemetry=False)
    stop = asyncio.Event()
    ready = loop.create_future()

    async def hold() -> None:
        async with client, outpost:
            ready.set_result(None)
            await stop.wait()

    held = loop.create_task(hold())
    loop.run_until_complete(
        asyncio.wait({ready, held}, return_when=asyncio.FIRST_COMPLETED)
    )
    if held.done():
        held.result()
    yield outpost
    stop.set()
    loop.run_until_complete(held)


def ingest(
    loop: asyncio.AbstractEventLoop, outpost: Outpost, event: EventInput
) -> None:
    loop.run_until_complete(outpost.ingest(event))


@pytest.mark.parametrize("buckets", BUCKET_COUNTS)
def test_ingest_one_event(
    benchmark: BenchmarkFixture,
    loop: asyncio.AbstractEventLoop,
    outpost: Outpost,
    buckets: int,
) -> None:
    event: EventInput = {
        "external_customer_id": f"alice-{buckets}",
        "name": "embedding",
        "timestamp": timestamp_of(COLD_UNTIL + (buckets - 1) * BUCKET_SIZE),
        "metadata": {"tokens": 7},
    }
    benchmark(ingest, loop, outpost, event)


def test_ingest_one_event_three_reducers(
    benchmark: BenchmarkFixture, loop: asyncio.AbstractEventLoop, outpost: Outpost
) -> None:
    event: EventInput = {
        "external_customer_id": "bob",
        "name": "llm.call",
        "timestamp": timestamp_of(COLD_UNTIL),
        "metadata": {"tokens": 7, "cost": 3},
    }
    benchmark(ingest, loop, outpost, event)
