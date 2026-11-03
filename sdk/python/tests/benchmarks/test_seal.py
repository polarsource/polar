import collections.abc

import pytest
from pytest_codspeed import BenchmarkFixture
from redis import Redis

from polar.outpost.client import APPLY_SNAPSHOT_SCRIPT
from polar.outpost.reducer import BUCKET_SIZE
from tests.benchmarks import BUCKET_COUNTS, CHANNEL, COLD_UNTIL, EPOCH, encode_state

pytestmark = pytest.mark.benchmark


def identity_of(buckets: int) -> str:
    return f"external:alice:tokens-{buckets}"


def key_of(buckets: int) -> str:
    return f"outpost:v1:state:{identity_of(buckets)}"


@pytest.fixture(scope="module")
def redis(redis_socket: str) -> collections.abc.Iterator[Redis]:
    # No coroutine can be benchmarked (see the `loop` fixture in conftest.py): the sync client
    # stands in for redis.asyncio; both share the connection and parser code.
    client = Redis(unix_socket_path=redis_socket)
    yield client
    client.close()


@pytest.mark.parametrize("buckets", BUCKET_COUNTS)
def test_apply_snapshot_seals_buckets(
    benchmark: BenchmarkFixture, redis: Redis, buckets: int
) -> None:
    sha = redis.script_load(APPLY_SNAPSHOT_SCRIPT)
    key = key_of(buckets)
    fields = encode_state(buckets)
    # The snapshot moves cold_until past every local bucket, so each call seals them all. The
    # transaction seeds the state first, at a cost the script's changes don't move.
    cutoff = COLD_UNTIL + buckets * BUCKET_SIZE

    def seal() -> None:
        pipeline = redis.pipeline(transaction=True)
        pipeline.hset(key, items=fields)
        pipeline.evalsha(
            sha,
            1,
            key,
            identity_of(buckets),
            CHANNEL,
            EPOCH,
            cutoff,
            cutoff + 1,
            1000,
            123456,
            1,
            999,
        )
        pipeline.execute()

    benchmark(seal)
