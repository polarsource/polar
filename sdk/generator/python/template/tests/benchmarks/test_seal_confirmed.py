import collections.abc

import pytest
from pytest_codspeed import BenchmarkFixture
from redis import Redis

from polar.outpost.client import APPLY_SNAPSHOT_SCRIPT, CONFIRM_SCRIPT
from polar.outpost.reducer import BUCKET_SIZE
from tests.benchmarks import (
    BUCKET_COUNTS,
    CHANNEL,
    COLD_UNTIL,
    EPOCH,
    PENDING_COUNTS,
    encode_pending,
    encode_state,
    pending_entries,
    pending_ids,
)

pytestmark = pytest.mark.benchmark


@pytest.fixture(scope="module")
def redis(redis_socket: str) -> collections.abc.Iterator[Redis]:
    # No coroutine can be benchmarked (see the `loop` fixture in conftest.py): the sync client
    # stands in for redis.asyncio; both share the connection and parser code.
    client = Redis(unix_socket_path=redis_socket)
    yield client
    client.close()


# What a snapshot costs once Polar confirmed the newest bucket's pending events: CONFIRM then
# APPLY_SNAPSHOT in one transaction, as the client runs them.
@pytest.mark.parametrize("pending", PENDING_COUNTS)
@pytest.mark.parametrize("buckets", BUCKET_COUNTS)
def test_apply_snapshot_after_confirm(
    benchmark: BenchmarkFixture, redis: Redis, buckets: int, pending: int
) -> None:
    confirm_sha = redis.script_load(CONFIRM_SCRIPT)
    apply_snapshot_sha = redis.script_load(APPLY_SNAPSHOT_SCRIPT)
    identity = f"external:alice:tokens-{buckets}-{pending}"
    state_key = f"outpost:v1:state:{identity}"
    newest_bucket_start = COLD_UNTIL + (buckets - 1) * BUCKET_SIZE
    pending_key = f"outpost:v1:pending:{identity}:{newest_bucket_start}"
    ids = pending_ids(pending)
    fields = encode_state(buckets) + encode_pending(newest_bucket_start, pending)
    entries = pending_entries(ids)
    # The snapshot moves cold_until past every local bucket, so each call seals them all. The
    # transaction seeds the state and the pending events first, at a cost the scripts' changes
    # don't move.
    cutoff = COLD_UNTIL + buckets * BUCKET_SIZE

    def seal() -> None:
        pipeline = redis.pipeline(transaction=True)
        pipeline.hset(state_key, items=fields)
        pipeline.hset(pending_key, items=entries)
        pipeline.evalsha(
            confirm_sha,
            2,
            state_key,
            pending_key,
            identity,
            CHANNEL,
            EPOCH,
            newest_bucket_start,
            "",
            *ids,
        )
        pipeline.evalsha(
            apply_snapshot_sha,
            1,
            state_key,
            identity,
            CHANNEL,
            EPOCH,
            cutoff,
            cutoff + 1,
            "meter",
            1_000_000,
            1000,
            123456,
            1,
            999,
        )
        pipeline.execute()

    benchmark(seal)
