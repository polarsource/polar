import collections.abc

import pytest
from pytest_codspeed import BenchmarkFixture
from redis import Redis

from polar.outpost.client import CONFIRM_SCRIPT
from tests.benchmarks import (
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


def identity_of(pending: int) -> str:
    return f"external:alice:tokens-{pending}"


@pytest.fixture(scope="module")
def redis(redis_socket: str) -> collections.abc.Iterator[Redis]:
    # No coroutine can be benchmarked (see the `loop` fixture in conftest.py): the sync client
    # stands in for redis.asyncio; both share the connection and parser code.
    client = Redis(unix_socket_path=redis_socket)
    yield client
    client.close()


@pytest.mark.parametrize("pending", PENDING_COUNTS)
def test_confirm_pending_events(
    benchmark: BenchmarkFixture, redis: Redis, pending: int
) -> None:
    sha = redis.script_load(CONFIRM_SCRIPT)
    identity = identity_of(pending)
    state_key = f"outpost:v1:state:{identity}"
    pending_key = f"outpost:v1:pending:{identity}:{COLD_UNTIL}"
    ids = pending_ids(pending)
    fields = encode_state(1) + encode_pending(COLD_UNTIL, pending)
    entries = pending_entries(ids)

    # Each call confirms every pending event. The transaction seeds the state and the pending
    # events first, at a cost the script's changes don't move.
    def confirm() -> None:
        pipeline = redis.pipeline(transaction=True)
        pipeline.hset(state_key, items=fields)
        pipeline.hset(pending_key, items=entries)
        pipeline.evalsha(
            sha,
            2,
            state_key,
            pending_key,
            identity,
            CHANNEL,
            EPOCH,
            COLD_UNTIL,
            "",
            *ids,
        )
        pipeline.execute()

    benchmark(confirm)
