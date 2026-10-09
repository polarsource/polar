import collections.abc

import pytest
from fakeredis import FakeAsyncRedis
from redis.exceptions import ResponseError

from outpost.storage.redis import BUCKET_TTL, RedisStorage


@pytest.fixture
async def redis() -> collections.abc.AsyncIterator[RedisStorage]:
    async with FakeAsyncRedis() as client:
        yield RedisStorage(client)


@pytest.mark.anyio
@pytest.mark.parametrize("anyio_backend", ["asyncio"])
class TestWriteUpdates:
    async def test_mixed_batch(self, anyio_backend: str, redis: RedisStorage) -> None:
        await redis.write_updates(
            {
                ("customer", "count", 300, "count"): 2,
                ("customer", "min", 300, "min"): -4.5,
                ("other", "sum", 300, "sum"): 1.5,
                ("other", "max", 300, "max"): 10.5,
            },
        )
        assert await redis.redis.hgetall("outpost:buckets:customer") == {
            b"count:300": b"2",
            b"min:300": b"-4.5",
        }
        assert await redis.redis.hgetall("outpost:buckets:other") == {
            b"sum:300": b"1.5",
            b"max:300": b"10.5",
        }

    @pytest.mark.parametrize("value", [-(2**63), 2**63 - 1])
    async def test_integer_boundaries(
        self, anyio_backend: str, redis: RedisStorage, value: int
    ) -> None:
        await redis.write_updates({("customer", "count", 300, "count"): value})
        with pytest.raises(ResponseError):
            await redis.write_updates(
                {("customer", "count", 300, "count"): 1 if value > 0 else -1}
            )
        assert (
            await redis.redis.hget("outpost:buckets:customer", "count:300")
            == str(value).encode()
        )

    async def test_increments(self, anyio_backend: str, redis: RedisStorage) -> None:
        await redis.redis.hset("outpost:buckets:customer", "large:300", 2**53)
        await redis.write_updates(
            {
                ("customer", "count", 300, "count"): 3,
                ("customer", "sum", 300, "sum"): 6,
                ("customer", "large", 300, "count"): 1,
                ("other", "count", 300, "count"): 1,
            },
        )
        await redis.write_updates(
            {
                ("customer", "count", 300, "count"): 2,
                ("customer", "sum", 300, "sum"): -7.25,
            },
        )
        assert await redis.redis.hgetall("outpost:buckets:customer") == {
            b"count:300": b"5",
            b"sum:300": b"-1.25",
            b"large:300": str(2**53 + 1).encode(),
        }
        assert await redis.redis.hgetall("outpost:buckets:other") == {
            b"count:300": b"1"
        }

    async def test_min_max(self, anyio_backend: str, redis: RedisStorage) -> None:
        for value in (0, -4.5, 10.5, 1):
            await redis.write_updates(
                {
                    ("customer", "min", 300, "min"): value,
                    ("customer", "max", 300, "max"): value,
                },
            )
        assert await redis.redis.hgetall("outpost:buckets:customer") == {
            b"min:300": b"-4.5",
            b"max:300": b"10.5",
        }

    async def test_expires(self, anyio_backend: str, redis: RedisStorage) -> None:
        await redis.write_updates({("customer", "count", 300, "count"): 1})
        assert 0 < await redis.redis.ttl("outpost:buckets:customer") <= BUCKET_TTL

    async def test_refreshes_snapshot(
        self, anyio_backend: str, redis: RedisStorage
    ) -> None:
        await redis.apply_snapshot(
            {
                "external_customer_id": "customer",
                "cold_until": 300,
                "cold": {"reducer": 1},
                "buckets": [],
            }
        )
        await redis.redis.expire("outpost:snapshot:customer", 10)

        await redis.write_updates({("customer", "reducer", 300, "count"): 1})

        assert await redis.redis.ttl("outpost:snapshot:customer") > 10

    async def test_empty(self, anyio_backend: str, redis: RedisStorage) -> None:
        await redis.write_updates({})
        assert await redis.redis.dbsize() == 0

    @pytest.mark.parametrize("func", ["count", "sum", "min", "max"])
    async def test_invalid_stored_value(
        self, anyio_backend: str, redis: RedisStorage, func: str
    ) -> None:
        await redis.redis.hset("outpost:buckets:customer", "reducer:300", "invalid")
        with pytest.raises(ResponseError):
            await redis.write_updates({("customer", "reducer", 300, func): 1})
        assert (
            await redis.redis.hget("outpost:buckets:customer", "reducer:300")
            == b"invalid"
        )


@pytest.mark.anyio
@pytest.mark.parametrize("anyio_backend", ["asyncio"])
class TestClaim:
    async def test_claim(self, anyio_backend: str, redis: RedisStorage) -> None:
        keys = [("customer", 300, "a"), ("customer", 300, "a"), ("customer", 600, "a")]
        assert await redis.claim(keys) == [True, False, True]
        assert await redis.claim(keys[:1]) == [False]
        assert 0 < await redis.redis.ttl("outpost:events:customer:300") <= BUCKET_TTL

    async def test_empty(self, anyio_backend: str, redis: RedisStorage) -> None:
        assert await redis.claim([]) == []
        assert await redis.redis.dbsize() == 0
