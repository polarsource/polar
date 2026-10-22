import collections.abc
import json

import pytest
from pytest_codspeed import BenchmarkFixture
from redis import Redis

from polar.outpost.client import CONFIRM_SCRIPT
from tests.benchmarks import CHANNEL, COLD_UNTIL, EPOCH, encode_state

pytestmark = pytest.mark.benchmark

# Events pending in one bucket: a batch the buffer just delivered, and a backlog after a 429.
PENDING_COUNTS = [1, 100, 1000]
# What WRITE_BUCKET stores per event: count, sum, min and max, as strings.
ENTRY = json.dumps(["1", "7", "7", "7"])


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
    state_key = f"outpost:state:{identity}"
    pending_key = f"outpost:pending:{identity}:{COLD_UNTIL}"
    ids = [f"event-{index}" for index in range(pending)]
    fields = encode_state(1) + [
        f"pending:{COLD_UNTIL}:count",
        str(pending),
        f"pending:{COLD_UNTIL}:sum",
        str(7 * pending),
        f"pending:{COLD_UNTIL}:min",
        "7",
        f"pending:{COLD_UNTIL}:max",
        "7",
    ]
    entries = [field for external_id in ids for field in (external_id, ENTRY)]

    # Each call confirms every pending event. The transaction seeds the state and the pending
    # events first, at a cost the script's changes don't move.
    def confirm() -> None:
        pipeline = redis.pipeline(transaction=True)
        pipeline.hset(state_key, items=fields)
        pipeline.hset(pending_key, items=entries)
        pipeline.evalsha(
            sha, 2, state_key, pending_key, identity, CHANNEL, EPOCH, COLD_UNTIL, *ids
        )
        pipeline.execute()

    benchmark(confirm)
