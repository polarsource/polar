import collections.abc

import pytest
from fakeredis import FakeAsyncRedis

from outpost.reducer import Snapshot
from outpost.storage import Storage
from outpost.storage.memory import MemoryStorage
from outpost.storage.redis import RedisStorage


@pytest.fixture(params=["memory", "redis"])
async def storage(
    request: pytest.FixtureRequest,
) -> collections.abc.AsyncIterator[Storage]:
    if request.param == "memory":
        yield MemoryStorage()
        return
    async with FakeAsyncRedis() as client:
        yield RedisStorage(client)


def snapshot(
    sealed_until: int,
    sealed: float = 10,
    buckets: list[tuple[int, float]] | None = None,
) -> Snapshot:
    return {
        "external_customer_id": "customer",
        "sealed_until": sealed_until,
        "sealed": {"reducer": sealed},
        "buckets": [
            {"reducer_id": "reducer", "bucket_start": start, "value": value}
            for start, value in buckets or []
        ],
    }


@pytest.mark.anyio
@pytest.mark.parametrize("anyio_backend", ["asyncio"])
class TestSnapshot:
    async def test_cold(self, anyio_backend: str, storage: Storage) -> None:
        await storage.write_updates({("customer", "reducer", 300, "count"): 1})

        assert await storage.read("customer") == {
            "sealed_until": None,
            "sealed": {},
            "buckets": {("reducer", 300): 1},
        }

    async def test_seeds_open_buckets_when_cold(
        self, anyio_backend: str, storage: Storage
    ) -> None:
        await storage.apply_snapshot(snapshot(600, buckets=[(600, 3)]))
        await storage.write_updates({("customer", "reducer", 600, "count"): 1})

        assert await storage.read("customer") == {
            "sealed_until": 600,
            "sealed": {"reducer": 10},
            "buckets": {("reducer", 600): 4},
        }

    async def test_drops_sealed_buckets(
        self, anyio_backend: str, storage: Storage
    ) -> None:
        await storage.apply_snapshot(snapshot(600))
        await storage.write_updates(
            {
                ("customer", "reducer", 600, "count"): 1,
                ("customer", "reducer", 900, "count"): 2,
            }
        )

        await storage.apply_snapshot(snapshot(900, sealed=11, buckets=[(900, 5)]))
        await storage.write_updates(
            {
                ("customer", "reducer", 600, "count"): 1,
                ("customer", "reducer", 900, "count"): 1,
            }
        )

        assert await storage.read("customer") == {
            "sealed_until": 900,
            "sealed": {"reducer": 11},
            "buckets": {("reducer", 900): 3},
        }

    async def test_ignores_older_snapshot(
        self, anyio_backend: str, storage: Storage
    ) -> None:
        await storage.apply_snapshot(snapshot(900, sealed=11))
        await storage.apply_snapshot(snapshot(600, sealed=10))

        assert await storage.read("customer") == {
            "sealed_until": 900,
            "sealed": {"reducer": 11},
            "buckets": {},
        }
