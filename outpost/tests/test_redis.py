import collections.abc
import typing

import pytest
from fakeredis import FakeAsyncRedis
from redis.exceptions import ResponseError

from outpost.redis import WRITE_UPDATES_SCRIPT, Redis, write_updates


@pytest.fixture
async def redis() -> collections.abc.AsyncIterator[Redis]:
    async with FakeAsyncRedis() as client:
        redis = typing.cast(Redis, client)
        redis.write_updates_script = redis.register_script(WRITE_UPDATES_SCRIPT)
        yield redis


@pytest.mark.anyio
@pytest.mark.parametrize("anyio_backend", ["asyncio"])
class TestWriteUpdates:
    async def test_mixed_batch(self, anyio_backend: str, redis: Redis) -> None:
        await write_updates(
            redis,
            {
                ("customer", "count", "count"): 2,
                ("customer", "min", "min"): -4.5,
                ("other", "sum", "sum"): 2**53 + 1,
                ("other", "max", "max"): 10.5,
            },
        )
        assert await redis.hgetall("outpost:meters:customer") == {
            b"count": b"2",
            b"min": b"-4.5",
        }
        assert await redis.hgetall("outpost:meters:other") == {
            b"sum": str(2**53 + 1).encode(),
            b"max": b"10.5",
        }

    @pytest.mark.parametrize("value", [-(2**63), 2**63 - 1])
    async def test_integer_boundaries(
        self, anyio_backend: str, redis: Redis, value: int
    ) -> None:
        await write_updates(redis, {("customer", "sum", "sum"): value})
        with pytest.raises(ResponseError):
            await write_updates(
                redis, {("customer", "sum", "sum"): 1 if value > 0 else -1}
            )
        assert await redis.hget("outpost:meters:customer", "sum") == str(value).encode()

    async def test_increments(self, anyio_backend: str, redis: Redis) -> None:
        await redis.hset("outpost:meters:customer", "large", 2**53)
        await write_updates(
            redis,
            {
                ("customer", "count", "count"): 3,
                ("customer", "sum", "sum"): 6,
                ("customer", "large", "sum"): 1,
                ("other", "count", "count"): 1,
            },
        )
        await write_updates(
            redis,
            {("customer", "count", "count"): 2, ("customer", "sum", "sum"): -7},
        )
        assert await redis.hgetall("outpost:meters:customer") == {
            b"count": b"5",
            b"sum": b"-1",
            b"large": str(2**53 + 1).encode(),
        }
        assert await redis.hgetall("outpost:meters:other") == {b"count": b"1"}

    async def test_min_max(self, anyio_backend: str, redis: Redis) -> None:
        for value in (0, -4.5, 10.5, 1):
            await write_updates(
                redis,
                {("customer", "min", "min"): value, ("customer", "max", "max"): value},
            )
        assert await redis.hgetall("outpost:meters:customer") == {
            b"min": b"-4.5",
            b"max": b"10.5",
        }

    async def test_empty(self, anyio_backend: str, redis: Redis) -> None:
        await write_updates(redis, {})
        assert await redis.dbsize() == 0

    @pytest.mark.parametrize("func", ["count", "sum", "min", "max"])
    async def test_invalid_stored_value(
        self, anyio_backend: str, redis: Redis, func: str
    ) -> None:
        await redis.hset("outpost:meters:customer", "meter", "invalid")
        with pytest.raises(ResponseError):
            await write_updates(redis, {("customer", "meter", func): 1})
        assert await redis.hget("outpost:meters:customer", "meter") == b"invalid"
