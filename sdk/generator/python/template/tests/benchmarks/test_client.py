import datetime

import pytest
from pytest_codspeed import BenchmarkFixture

from polar.outpost.client import consumed_units, decode_state
from polar.outpost.reducer import BUCKET_SIZE

pytestmark = pytest.mark.benchmark

COLD_UNTIL = int(
    datetime.datetime(2026, 10, 1, 12, 0, 0, tzinfo=datetime.UTC).timestamp()
    * 1_000_000
)
# 5-minute buckets: 5 minutes, 1 hour, 24 hours of usage since the last snapshot.
BUCKET_COUNTS = [1, 12, 288]


# The flat field list decode_state reads: one `bucket:<start>:<statistic>` entry per bucket.
def encode_state(buckets: int) -> list[str]:
    fields = [
        "epoch",
        "0123456789abcdef0123456789abcdef",
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
    ]
    for index in range(buckets):
        prefix = f"bucket:{COLD_UNTIL + index * BUCKET_SIZE}:"
        fields += [f"{prefix}count", "10", f"{prefix}sum", str(100 + index)]
        fields += [f"{prefix}min", "1", f"{prefix}max", str(50 + index)]
    return fields


@pytest.mark.parametrize("buckets", BUCKET_COUNTS)
def test_decode_state(benchmark: BenchmarkFixture, buckets: int) -> None:
    benchmark(decode_state, encode_state(buckets))


@pytest.mark.parametrize("buckets", BUCKET_COUNTS)
def test_consumed_units_sum(benchmark: BenchmarkFixture, buckets: int) -> None:
    benchmark(consumed_units, decode_state(encode_state(buckets)), "sum")
