import asyncio
import collections.abc
import dataclasses
import datetime
import typing

import pytest
from pytest_codspeed import BenchmarkFixture
from redis import Redis

from polar.metering import EventInput
from polar.outpost.client import Outpost
from polar.outpost.reducer import BUCKET_SIZE, Reducer
from tests.benchmarks import BUCKET_COUNTS, COLD_UNTIL, DATA, encode_state

pytestmark = pytest.mark.benchmark

INGEST: dict[str, typing.Any] = DATA["ingest"]
# Every event feeds `tokens`; an LLM call also feeds `calls` and `cost`.
REDUCERS: list[Reducer] = INGEST["reducers"]
# encode_state seeds every bucket with 10 events.
SEEDED = 10


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
        return f"outpost:v1:state:external:{self.customer}:{reducer}"


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
        for scenario in [*ONE_REDUCER.values(), THREE_REDUCERS]:
            for reducer in scenario.reducers:
                client.hset(
                    scenario.state_key(reducer), items=encode_state(scenario.buckets)
                )
        yield client


def benchmark_ingest(
    benchmark: BenchmarkFixture,
    loop: asyncio.AbstractEventLoop,
    outpost: Outpost,
    redis: Redis,
    scenario: Scenario,
) -> None:
    timestamp = datetime.datetime.fromtimestamp(
        scenario.newest_bucket_start / 1_000_000, datetime.UTC
    )
    event = typing.cast(
        EventInput,
        {
            **scenario.event,
            "external_customer_id": scenario.customer,
            "timestamp": timestamp.isoformat(),
        },
    )
    ingested = 0

    def ingest() -> None:
        nonlocal ingested
        # Every call carries its own external_id, as production events do.
        tracked = typing.cast(EventInput, {**event, "external_id": f"event-{ingested}"})
        loop.run_until_complete(outpost.track(tracked))
        ingested += 1

    benchmark(ingest)
    field = f"bucket:{scenario.newest_bucket_start}:count"
    for reducer in scenario.reducers:
        count = redis.hget(scenario.state_key(reducer), field)
        assert count is not None and int(count) == SEEDED + ingested, reducer


@pytest.mark.parametrize("buckets", BUCKET_COUNTS)
def test_ingest_one_event(
    benchmark: BenchmarkFixture,
    loop: asyncio.AbstractEventLoop,
    outpost: Outpost,
    redis: Redis,
    buckets: int,
) -> None:
    benchmark_ingest(benchmark, loop, outpost, redis, ONE_REDUCER[buckets])


def test_ingest_one_event_three_reducers(
    benchmark: BenchmarkFixture,
    loop: asyncio.AbstractEventLoop,
    outpost: Outpost,
    redis: Redis,
) -> None:
    benchmark_ingest(benchmark, loop, outpost, redis, THREE_REDUCERS)
