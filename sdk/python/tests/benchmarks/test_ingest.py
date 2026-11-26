import asyncio
import collections.abc
import dataclasses
import datetime
import typing
import uuid

import httpx2
import pytest
from pytest_codspeed import BenchmarkFixture
from redis import Redis

from polar.metering import EventExternalCustomerInput, Metering
from polar.metering.outbox.redis import RedisOutbox
from polar.outpost.reducer import BUCKET_SIZE, Reducer
from polar.v2027_01 import PolarAsync
from tests.benchmarks import BUCKET_COUNTS, COLD_UNTIL, DATA, encode_state
from tests.benchmarks.conftest import hold_open, polar_server

pytestmark = pytest.mark.benchmark

INGEST: dict[str, typing.Any] = DATA["ingest"]
# Every event feeds `tokens`; an LLM call also feeds `calls` and `cost`.
REDUCERS: list[Reducer] = INGEST["reducers"]
# encode_state seeds every bucket with 10 events.
SEEDED = 10
STREAM = "benchmark:metering:events"


@dataclasses.dataclass
class Scenario:
    customer: str
    buckets: int
    event: dict[str, typing.Any]
    reducers: list[str]

    @property
    def newest_bucket_start(self) -> int:
        return COLD_UNTIL + (self.buckets - 1) * BUCKET_SIZE

    def state_key(self, reducer: str) -> str:
        return f"outpost:v1:org:state:external:{self.customer}:{reducer}"


ONE_REDUCER = {
    buckets: Scenario(f"alice-{buckets}", buckets, INGEST["embedding"], ["tokens"])
    for buckets in BUCKET_COUNTS
}
THREE_REDUCERS = Scenario(
    "bob", 1, INGEST["llm_call"], [reducer["id"] for reducer in REDUCERS]
)


@pytest.fixture(scope="module")
def reducers() -> list[Reducer]:
    return REDUCERS


@pytest.fixture(scope="module")
def redis(redis_socket: str) -> collections.abc.Iterator[Redis]:
    with Redis(unix_socket_path=redis_socket) as client:
        # A warm customer has a state for every reducer: ingesting fetches none.
        for scenario in [*ONE_REDUCER.values(), THREE_REDUCERS]:
            for reducer in REDUCERS:
                client.hset(
                    scenario.state_key(reducer["id"]),
                    items=encode_state(scenario.buckets),
                )
        yield client


@pytest.fixture(scope="module")
def metering(
    loop: asyncio.AbstractEventLoop, redis_socket: str, reducers: list[Reducer]
) -> collections.abc.Iterator[Metering]:
    polar = PolarAsync(f"benchmark-{uuid.uuid4()}", base_url="http://polar.test")
    client = polar._client._client
    polar._client._client = httpx2.AsyncClient(
        base_url=client.base_url,
        headers=client.headers,
        transport=httpx2.ASGITransport(polar_server(reducers, None)),
    )
    redis_url = f"unix://{redis_socket}"
    outbox = RedisOutbox.create(polar, redis_url, stream=STREAM)
    with hold_open(
        loop, polar, polar.metering(outbox=outbox, outpost={"redis_url": redis_url})
    ) as active:
        yield active


def benchmark_ingest(
    benchmark: BenchmarkFixture,
    loop: asyncio.AbstractEventLoop,
    metering: Metering,
    redis: Redis,
    scenario: Scenario,
) -> None:
    timestamp = datetime.datetime.fromtimestamp(
        scenario.newest_bucket_start / 1_000_000, datetime.UTC
    )
    event = typing.cast(
        EventExternalCustomerInput,
        {
            **scenario.event,
            "external_customer_id": scenario.customer,
            "timestamp": timestamp.isoformat(),
        },
    )
    ingested = 0
    entries_before = int(redis.xinfo_stream(STREAM)["entries-added"])

    def ingest() -> None:
        nonlocal ingested
        # Every call carries its own external_id, as production events do.
        tracked = typing.cast(
            EventExternalCustomerInput, {**event, "external_id": f"event-{ingested}"}
        )
        loop.run_until_complete(metering.track(**tracked))
        ingested += 1

    benchmark(ingest)
    loop.run_until_complete(metering.flush())
    assert int(redis.xinfo_stream(STREAM)["entries-added"]) - entries_before == ingested
    field = f"bucket:{scenario.newest_bucket_start}:count"
    for reducer in scenario.reducers:
        count = redis.hget(scenario.state_key(reducer), field)
        assert count is not None and int(count) == SEEDED + ingested, reducer


@pytest.mark.parametrize("buckets", BUCKET_COUNTS)
def test_ingest_one_event(
    benchmark: BenchmarkFixture,
    loop: asyncio.AbstractEventLoop,
    metering: Metering,
    redis: Redis,
    buckets: int,
) -> None:
    benchmark_ingest(benchmark, loop, metering, redis, ONE_REDUCER[buckets])


def test_ingest_one_event_three_reducers(
    benchmark: BenchmarkFixture,
    loop: asyncio.AbstractEventLoop,
    metering: Metering,
    redis: Redis,
) -> None:
    benchmark_ingest(benchmark, loop, metering, redis, THREE_REDUCERS)
