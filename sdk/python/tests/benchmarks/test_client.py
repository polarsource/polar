import asyncio

import httpx
import pytest
from pytest_codspeed import BenchmarkFixture
from redis.asyncio import Redis

from polar.outpost.client import LocalState, Outpost, consumed_units, decode_state
from tests.benchmarks import BUCKET_COUNTS, REDUCER, encode_state

pytestmark = pytest.mark.benchmark


@pytest.mark.parametrize("buckets", BUCKET_COUNTS)
def test_decode_state(benchmark: BenchmarkFixture, buckets: int) -> None:
    benchmark(decode_state, encode_state(buckets))


@pytest.mark.parametrize("buckets", BUCKET_COUNTS)
def test_consumed_units_sum(benchmark: BenchmarkFixture, buckets: int) -> None:
    benchmark(consumed_units, decode_state(encode_state(buckets)), "sum")


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


def test_warm_meter_read(
    benchmark: BenchmarkFixture, loop: asyncio.AbstractEventLoop
) -> None:
    outpost = loop.run_until_complete(warm_outpost())
    benchmark(
        lambda: loop.run_until_complete(
            outpost.meter(meter_id="meter", external_customer_id="alice")
        )
    )
