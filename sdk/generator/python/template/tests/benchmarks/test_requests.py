import asyncio
import collections.abc
import json
import pathlib
import subprocess
import typing

import httpx2
import pytest
from anyio import from_thread, to_thread
from pytest_codspeed import BenchmarkFixture

from polar.base import parse_response_json
from polar.{{ version }} import PolarAsync
from polar.{{ version }}.outputs import (
    CustomerIndividual,
    CustomerTeam,
    ListResourceCustomer,
)

pytestmark = pytest.mark.benchmark

DATA_PATH = pathlib.Path(__file__).with_name("customers.json")
DATA = json.loads(DATA_PATH.read_bytes())


def customer_page(
    count: int,
    customer_type: typing.Literal["individual", "team", "mixed"] = "individual",
) -> bytes:
    items = [
        {
            **DATA["customer"],
            "type": ("individual" if index % 2 else "team")
            if customer_type == "mixed"
            else customer_type,
            "id": f"00000000-0000-4000-8000-{index:012d}",
            "external_id": f"customer-{index}",
            "email": f"customer-{index}@example.com",
        }
        for index in range(1, count + 1)
    ]
    return json.dumps(
        {"items": items, "pagination": {"total_count": count, "max_page": 1}},
        separators=(",", ":"),
    ).encode()


@pytest.fixture
def customer_server() -> collections.abc.Iterator[str]:
    with subprocess.Popen(
        ["node", DATA_PATH.with_name("customer-server.mjs"), DATA_PATH],
        stdout=subprocess.PIPE,
        text=True,
    ) as server:
        try:
            assert server.stdout is not None
            base_url = server.stdout.readline().strip()
            assert base_url.startswith("http://127.0.0.1:"), "HTTP server did not start"
            yield base_url
        finally:
            server.terminate()


@pytest.mark.anyio
@pytest.mark.parametrize("anyio_backend", ["asyncio"])
async def test_concurrent_customer_requests(
    benchmark: BenchmarkFixture,
    customer_server: str,
) -> None:
    async with PolarAsync("benchmark", base_url=customer_server) as polar:

        async def batch() -> list[ListResourceCustomer]:
            return await asyncio.gather(
                *(polar.customers.list(limit=1) for _ in range(DATA["concurrency"]))
            )

        pages = await batch()
        assert all(page.items[0].id == DATA["customer"]["id"] for page in pages)
        await to_thread.run_sync(benchmark, from_thread.run, batch)


@pytest.mark.parametrize("customer_type", ["individual", "team", "mixed"])
def test_decode_customer_page(
    benchmark: BenchmarkFixture,
    customer_type: typing.Literal["individual", "team", "mixed"],
) -> None:
    response = httpx2.Response(
        200, content=customer_page(DATA["page_size"], customer_type)
    )

    def decode() -> ListResourceCustomer:
        return parse_response_json(response, ListResourceCustomer)

    page = decode()
    assert len(page.items) == DATA["page_size"]
    for index, item in enumerate(page.items, start=1):
        expected_type = (
            ("individual" if index % 2 else "team")
            if customer_type == "mixed"
            else customer_type
        )
        assert isinstance(
            item, CustomerIndividual if expected_type == "individual" else CustomerTeam
        )
    assert page.items[-1].external_id == f"customer-{DATA['page_size']}"
    benchmark(decode)
