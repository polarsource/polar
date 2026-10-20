import asyncio
import collections.abc
import json

import httpx
import pytest
from pytest_codspeed import BenchmarkFixture
from redis import Redis as SyncRedis
from redis.asyncio import Redis

from polar.metering import CustomerMeter
from polar.outpost.client import LocalState, Outpost, consumed_units, decode_state
from polar.outpost.reducer import Reducer
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


@pytest.fixture(scope="module")
def reducers() -> list[Reducer]:
    return [REDUCER]


# A snapshotted state: no read waits for Polar.
@pytest.fixture(scope="module")
def redis(redis_socket: str) -> collections.abc.Iterator[SyncRedis]:
    with SyncRedis(unix_socket_path=redis_socket) as client:
        client.hset(
            f"outpost:state:external:alice:{REDUCER['id']}", items=encode_state(1)
        )
        yield client


def test_warm_meter_read(
    benchmark: BenchmarkFixture, loop: asyncio.AbstractEventLoop, outpost: Outpost
) -> None:
    def read() -> CustomerMeter | None:
        return loop.run_until_complete(
            outpost.meter(meter_id="meter", external_customer_id="alice")
        )

    meter = read()
    assert meter is not None and meter.credited_units == 1_000_000
    benchmark(read)


@pytest.mark.parametrize("buckets", BUCKET_COUNTS)
def test_receive_state_update(
    benchmark: BenchmarkFixture, loop: asyncio.AbstractEventLoop, buckets: int
) -> None:
    outpost = loop.run_until_complete(warm_outpost())
    identity = f"external:alice:{REDUCER['id']}"
    local = outpost._cache[identity]
    current = decode_state(encode_state(buckets))
    # Another instance wrote one event: the next revision of the same state.
    newer = encode_state(buckets)
    newer[newer.index("revision") + 1] = str(current.revision + 1)
    data = json.dumps({"customer": identity, "state": newer}).encode()

    def receive() -> None:
        local.state = current
        loop.run_until_complete(outpost._receive_redis(data))

    benchmark(receive)
    assert outpost._sync_applied == outpost._sync_received
