import asyncio
import collections.abc
import datetime

import httpx
import pytest
from pytest_codspeed import BenchmarkFixture
from redis.asyncio import Redis

from polar.outpost.client import LocalState, Outpost, consumed_units, decode_state
from polar.outpost.reducer import BUCKET_SIZE, Reducer

pytestmark = pytest.mark.benchmark

COLD_UNTIL = int(
    datetime.datetime(2026, 10, 1, 12, 0, 0, tzinfo=datetime.UTC).timestamp()
    * 1_000_000
)
# 5-minute buckets: 5 minutes, 1 hour, 24 hours of usage since the last snapshot.
BUCKET_COUNTS = [1, 12, 288]


# The flat field list decode_state reads: one `bucket:<start>:<statistic>` entry per bucket.
def encode_state(buckets: int) -> list[str]:
    fields = [
        "epoch",
        "0123456789abcdef0123456789abcdef",
        "revision",
        "4242",
        "cold_until",
        str(COLD_UNTIL),
        "snapshot_version",
        str(COLD_UNTIL + 1),
        "cold:count",
        "1000",
        "cold:sum",
        "123456",
        "cold:min",
        "1",
        "cold:max",
        "999",
        "credited:meter",
        "1000000",
    ]
    for index in range(buckets):
        prefix = f"bucket:{COLD_UNTIL + index * BUCKET_SIZE}:"
        fields += [f"{prefix}count", "10", f"{prefix}sum", str(100 + index)]
        fields += [f"{prefix}min", "1", f"{prefix}max", str(50 + index)]
    return fields


@pytest.mark.parametrize("buckets", BUCKET_COUNTS)
def test_decode_state(benchmark: BenchmarkFixture, buckets: int) -> None:
    benchmark(decode_state, encode_state(buckets))


@pytest.mark.parametrize("buckets", BUCKET_COUNTS)
def test_consumed_units_sum(benchmark: BenchmarkFixture, buckets: int) -> None:
    benchmark(consumed_units, decode_state(encode_state(buckets)), "sum")


REDUCER: Reducer = {
    "id": "tokens",
    "meter_ids": ["meter"],
    "filter": {"conjunction": "and", "clauses": []},
    "aggregation": {"func": "sum", "property": "tokens"},
}


async def warm_outpost() -> Outpost:
    # Configured, synced, state cached and actor known: a read touches neither Redis nor Polar.
    outpost = Outpost(
        "redis://127.0.0.1:1", client=httpx.AsyncClient(), telemetry=False
    )
    outpost._redis = Redis.from_url(outpost.redis_url)
    outpost._redis_available = True
    outpost._synced.set()
    outpost._configured.set()
    outpost._reducers = [REDUCER]
    identity = f"external:alice:{REDUCER['id']}"
    outpost._cache[identity] = LocalState(state=decode_state(encode_state(1)))
    outpost._actors.add(identity)
    return outpost


# pytest-codspeed cannot benchmark a coroutine (CodSpeedHQ/pytest-codspeed#101): one event loop
# drives the reads, and its constant overhead is part of every measurement.
@pytest.fixture(scope="module")
def loop() -> collections.abc.Iterator[asyncio.AbstractEventLoop]:
    loop = asyncio.new_event_loop()
    yield loop
    loop.close()


def test_warm_meter_read(
    benchmark: BenchmarkFixture, loop: asyncio.AbstractEventLoop
) -> None:
    outpost = loop.run_until_complete(warm_outpost())
    benchmark(
        lambda: loop.run_until_complete(
            outpost.meter(meter_id="meter", external_customer_id="alice")
        )
    )
