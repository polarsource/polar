import collections.abc
import datetime
import os
import subprocess
import tempfile
import time

import pytest
from pytest_codspeed import BenchmarkFixture
from redis import Redis

from polar.outpost.client import (
    APPLY_SNAPSHOT_SCRIPT,
    READ_STATE_SCRIPT,
    WRITE_BUCKET_SCRIPT,
)
from polar.outpost.reducer import BUCKET_SIZE

pytestmark = pytest.mark.benchmark

COLD_UNTIL = int(
    datetime.datetime(2026, 10, 1, 12, 0, 0, tzinfo=datetime.UTC).timestamp()
    * 1_000_000
)
# 5-minute buckets: 5 minutes, 1 hour, 24 hours of usage since the last snapshot.
BUCKET_COUNTS = [1, 12, 288]
CHANNEL = "outpost:bench:updates"
EPOCH = "0123456789abcdef0123456789abcdef"


# One event usually matches several reducers; ingest sends their WRITE_BUCKET calls in one pipeline.
REDUCERS = ["tokens", "calls", "cost"]


def state_key(identity: str) -> str:
    return f"outpost:state:{identity}"


def identity_of(buckets: int) -> str:
    return f"external:alice:tokens-{buckets}"


def key_of(buckets: int) -> str:
    return state_key(identity_of(buckets))


def seed_state(redis: Redis, identity: str, buckets: int) -> None:
    fields = [
        "epoch",
        EPOCH,
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
        "credited_version:meter",
        str(COLD_UNTIL + 1),
    ]
    for index in range(buckets):
        prefix = f"bucket:{COLD_UNTIL + index * BUCKET_SIZE}:"
        fields += [f"{prefix}count", "10", f"{prefix}sum", str(100 + index)]
        fields += [f"{prefix}min", "1", f"{prefix}max", str(50 + index)]
    redis.hset(state_key(identity), items=fields)


@pytest.fixture(scope="module")
def redis() -> collections.abc.Iterator[Redis]:
    with tempfile.TemporaryDirectory(prefix="polar-outpost-bench-") as directory:
        socket = os.path.join(directory, "redis.sock")
        process = subprocess.Popen(
            [
                "redis-server",
                "--port",
                "0",
                "--unixsocket",
                socket,
                "--save",
                "",
                "--appendonly",
                "no",
            ],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
        try:
            deadline = time.monotonic() + 5
            while not os.path.exists(socket):
                if process.poll() is not None or time.monotonic() > deadline:
                    raise RuntimeError("redis-server did not start")
                time.sleep(0.01)
            # pytest-codspeed cannot benchmark a coroutine (CodSpeedHQ/pytest-codspeed#101), so the
            # sync client stands in for redis.asyncio; both share the connection and parser code.
            client = Redis(unix_socket_path=socket)
            for buckets in BUCKET_COUNTS:
                seed_state(client, identity_of(buckets), buckets)
            for reducer in REDUCERS:
                seed_state(client, f"external:alice:{reducer}", 1)
            yield client
            client.close()
        finally:
            process.terminate()
            process.wait()


@pytest.mark.parametrize("buckets", BUCKET_COUNTS)
def test_write_bucket_one_event(
    benchmark: BenchmarkFixture, redis: Redis, buckets: int
) -> None:
    newest_bucket_start = COLD_UNTIL + (buckets - 1) * BUCKET_SIZE
    benchmark(
        redis.eval,
        WRITE_BUCKET_SCRIPT,
        1,
        key_of(buckets),
        identity_of(buckets),
        CHANNEL,
        EPOCH,
        newest_bucket_start,
        1,
        7,
        7,
        7,
    )


def test_write_bucket_three_reducers(benchmark: BenchmarkFixture, redis: Redis) -> None:
    def write() -> None:
        pipeline = redis.pipeline(transaction=False)
        for reducer in REDUCERS:
            identity = f"external:alice:{reducer}"
            pipeline.eval(
                WRITE_BUCKET_SCRIPT,
                1,
                state_key(identity),
                identity,
                CHANNEL,
                EPOCH,
                COLD_UNTIL,
                1,
                7,
                7,
                7,
            )
        pipeline.execute()

    benchmark(write)


@pytest.mark.parametrize("buckets", BUCKET_COUNTS)
def test_read_state(benchmark: BenchmarkFixture, redis: Redis, buckets: int) -> None:
    # The client loads the read and snapshot scripts once and calls them by hash.
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
        "meter",
        1_000_000,
        1000,
        123456,
        1,
        999,
    )
