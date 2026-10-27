import asyncio
import collections.abc
import typing

import pytest
from pytest_codspeed import BenchmarkFixture
from redis import Redis

from polar.metering import CustomerMeter
from polar.outpost.client import Outpost
from polar.outpost.reducer import Reducer
from tests.benchmarks import BUCKET_COUNTS, REDUCER, SNAPSHOT, encode_state

pytestmark = pytest.mark.benchmark


@pytest.fixture(scope="module")
def reducers() -> list[Reducer]:
    return [REDUCER]


@pytest.fixture(scope="module")
def snapshot() -> dict[str, typing.Any]:
    return SNAPSHOT


def customer_of(buckets: int) -> str:
    return f"alice-{buckets}"


# The seeded cold sum plus the sum of every local bucket encode_state writes.
def consumed_of(buckets: int) -> int:
    return SNAPSHOT["sum"] + sum(100 + index for index in range(buckets))


# Local buckets since the snapshot, as earlier writers leave them; the snapshot keeps them.
@pytest.fixture(scope="module", autouse=True)
def local_buckets(redis_socket: str) -> collections.abc.Iterator[None]:
    client = Redis(unix_socket_path=redis_socket)
    for buckets in BUCKET_COUNTS:
        key = f"outpost:v1:state:external:{customer_of(buckets)}:{REDUCER['id']}"
        client.hset(key, items=encode_state(buckets))
    client.close()
    yield


@pytest.mark.parametrize("buckets", BUCKET_COUNTS)
def test_warm_meter_read_over_buckets(
    benchmark: BenchmarkFixture,
    loop: asyncio.AbstractEventLoop,
    outpost: Outpost,
    buckets: int,
) -> None:
    customer = customer_of(buckets)

    def read() -> CustomerMeter | None:
        return loop.run_until_complete(
            outpost.meter(meter_id="meter", external_customer_id=customer)
        )

    loop.run_until_complete(outpost.actor(external_customer_id=customer))
    meter = read()
    assert meter is not None and meter.consumed_units == consumed_of(buckets)
    benchmark(read)
