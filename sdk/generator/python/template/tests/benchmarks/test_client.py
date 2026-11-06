import pytest
from pytest_codspeed import BenchmarkFixture

from polar.outpost.client import consumed_units, decode_state
from tests.benchmarks import BUCKET_COUNTS, encode_state

pytestmark = pytest.mark.benchmark


@pytest.mark.parametrize("buckets", BUCKET_COUNTS)
def test_decode_state(benchmark: BenchmarkFixture, buckets: int) -> None:
    benchmark(decode_state, encode_state(buckets))


@pytest.mark.parametrize("buckets", BUCKET_COUNTS)
def test_consumed_units_sum(benchmark: BenchmarkFixture, buckets: int) -> None:
    benchmark(consumed_units, decode_state(encode_state(buckets)), "sum")
