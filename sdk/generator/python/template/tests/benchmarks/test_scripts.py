import collections.abc
import itertools

import pytest
from pytest_codspeed import BenchmarkFixture
from redis import Redis

from polar.outpost.client import (
    APPLY_SNAPSHOT_SCRIPT,
    READ_STATE_SCRIPT,
    WRITE_BUCKET_SCRIPT,
)
from polar.outpost.reducer import BUCKET_SIZE
from tests.benchmarks import BUCKET_COUNTS, CHANNEL, COLD_UNTIL, EPOCH, encode_state

pytestmark = pytest.mark.benchmark


# One event usually matches several reducers; ingest sends their WRITE_BUCKET calls in one pipeline.
REDUCERS = ["tokens", "calls", "cost"]


def state_key(identity: str) -> str:
    return f"outpost:v1:state:{identity}"


def identity_of(buckets: int) -> str:
    return f"external:alice:tokens-{buckets}"


def key_of(buckets: int) -> str:
    return state_key(identity_of(buckets))


# An event of 7 units in the given bucket: what WRITE_BUCKET takes after the key count. Each
# call brings a new external_id, as events do; the same one would be a duplicate and write nothing.
_ids = itertools.count(1)


def write_args(identity: str, bucket_start: int) -> list[str | int]:
    pending_key = f"outpost:v1:pending:{identity}:{bucket_start}"
    return [
        state_key(identity),
        pending_key,
        identity,
        CHANNEL,
        EPOCH,
        bucket_start,
    ] + [
        1,
        7,
        7,
        7,
        f"event-{next(_ids)}",
    ]


def seed_state(redis: Redis, identity: str, buckets: int) -> None:
    redis.hset(state_key(identity), items=encode_state(buckets))


@pytest.fixture(scope="module")
def redis(redis_socket: str) -> collections.abc.Iterator[Redis]:
    # No coroutine can be benchmarked (see the `loop` fixture in conftest.py): the sync client
    # stands in for redis.asyncio; both share the connection and parser code.
    client = Redis(unix_socket_path=redis_socket)
    for buckets in BUCKET_COUNTS:
        seed_state(client, identity_of(buckets), buckets)
    for reducer in REDUCERS:
        seed_state(client, f"external:alice:{reducer}", 1)
    yield client
    client.close()


@pytest.mark.parametrize("buckets", BUCKET_COUNTS)
def test_write_bucket_one_event(
    benchmark: BenchmarkFixture, redis: Redis, buckets: int
) -> None:
    newest_bucket_start = COLD_UNTIL + (buckets - 1) * BUCKET_SIZE
    # The client loads each script once and calls it by hash.
    sha = redis.script_load(WRITE_BUCKET_SCRIPT)
    identity = identity_of(buckets)

    def write() -> None:
        redis.evalsha(sha, 2, *write_args(identity, newest_bucket_start))

    benchmark(write)


def test_write_bucket_three_reducers(benchmark: BenchmarkFixture, redis: Redis) -> None:
    sha = redis.script_load(WRITE_BUCKET_SCRIPT)

    def write() -> None:
        pipeline = redis.pipeline(transaction=False)
        for reducer in REDUCERS:
            identity = f"external:alice:{reducer}"
            pipeline.evalsha(sha, 2, *write_args(identity, COLD_UNTIL))
        pipeline.execute()

    benchmark(write)


@pytest.mark.parametrize("buckets", BUCKET_COUNTS)
def test_read_state(benchmark: BenchmarkFixture, redis: Redis, buckets: int) -> None:
    sha = redis.script_load(READ_STATE_SCRIPT)
    benchmark(redis.evalsha, sha, 1, key_of(buckets), EPOCH)


@pytest.mark.parametrize("buckets", BUCKET_COUNTS)
def test_apply_snapshot(
    benchmark: BenchmarkFixture, redis: Redis, buckets: int
) -> None:
    sha = redis.script_load(APPLY_SNAPSHOT_SCRIPT)
    # Same cold_until and version as the seeded state: the script rescans every field and
    # rewrites the cold summary, but seals no bucket, so the state keeps its size.
    benchmark(
        redis.evalsha,
        sha,
        1,
        key_of(buckets),
        identity_of(buckets),
        CHANNEL,
        EPOCH,
        COLD_UNTIL,
        COLD_UNTIL + 1,
        1000,
        123456,
        1,
        999,
    )
