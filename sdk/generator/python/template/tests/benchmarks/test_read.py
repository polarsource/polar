import asyncio
import typing

import pytest
from pytest_codspeed import BenchmarkFixture

from polar.metering import CustomerMeter
from polar.outpost.client import Outpost
from polar.outpost.reducer import Reducer
from tests.benchmarks import CREDIT_REDUCER, REDUCER, SNAPSHOT

pytestmark = pytest.mark.benchmark


@pytest.fixture(scope="module")
def reducers() -> list[Reducer]:
    return [REDUCER, CREDIT_REDUCER]


@pytest.fixture(scope="module")
def snapshot() -> dict[str, typing.Any]:
    return SNAPSHOT


def test_warm_meter_read(
    benchmark: BenchmarkFixture, loop: asyncio.AbstractEventLoop, outpost: Outpost
) -> None:
    def read() -> CustomerMeter | None:
        return loop.run_until_complete(
            outpost.meter(meter_id="meter", external_customer_id="alice")
        )

    loop.run_until_complete(outpost.actor(external_customer_id="alice"))
    meter = read()
    assert meter is not None and meter.credited_units == SNAPSHOT["sum"]
    benchmark(read)
