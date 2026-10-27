import asyncio
import json

import httpx
import pytest
from pytest_codspeed import BenchmarkFixture
from redis.asyncio import Redis

from polar.outpost.client import LocalState, Outpost, consumed_units, decode_state
from tests.benchmarks import BUCKET_COUNTS, EPOCH, REDUCER, encode_state

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


@pytest.mark.parametrize("buckets", BUCKET_COUNTS)
def test_receive_state_update(
    benchmark: BenchmarkFixture, loop: asyncio.AbstractEventLoop, buckets: int
) -> None:
    outpost = loop.run_until_complete(warm_outpost())
    identity = f"external:alice:{REDUCER['id']}"
    local = outpost._cache[identity]
    current = decode_state(encode_state(buckets))
    revision = current.revision
    # Another instance wrote one event: the next revision, with the newest bucket.
    bucket = [
        "epoch",
        EPOCH,
        "revision",
        str(revision + 1),
        *encode_state(buckets)[-8:],
    ]
    data = json.dumps({"customer": identity, "bucket": bucket}).encode()

    def receive() -> None:
        current.revision = revision
        local.state = current
        loop.run_until_complete(outpost._receive_redis(data))

    benchmark(receive)
    assert outpost._sync_applied == outpost._sync_received
