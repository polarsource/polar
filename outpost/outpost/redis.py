import collections.abc
import contextlib
import typing

from redis.asyncio import Redis as RedisClient
from redis.commands.core import AsyncScript

from outpost.reducer import Updates

MIN_MAX_SCRIPT = """
local value = tonumber(ARGV[2])
assert(value and value == value and math.abs(value) ~= math.huge, 'Invalid value')
assert(ARGV[3] == 'min' or ARGV[3] == 'max', 'Invalid aggregation function')
local stored = redis.call('HGET', KEYS[1], ARGV[1])
local previous = stored and assert(tonumber(stored), 'Invalid stored value')
if previous then
    assert(previous == previous and math.abs(previous) ~= math.huge,
        'Invalid stored value')
end
if not previous or (ARGV[3] == 'min' and value < previous)
    or (ARGV[3] == 'max' and value > previous) then
    return redis.call('HSET', KEYS[1], ARGV[1], ARGV[2])
end
return 0
"""


class Redis(RedisClient):
    min_max_script: AsyncScript


@contextlib.asynccontextmanager
async def create_redis(url: str) -> collections.abc.AsyncGenerator[Redis]:
    redis = typing.cast(Redis, Redis.from_url(url))
    async with redis:
        redis.min_max_script = redis.register_script(MIN_MAX_SCRIPT)
        await redis.script_load(MIN_MAX_SCRIPT)
        yield redis


async def write_updates(redis: Redis, updates: Updates) -> None:
    async with redis.pipeline(transaction=False) as pipeline:
        for (customer_id, meter_id, func), value in updates.items():
            key = f"outpost:meters:{customer_id}"
            if func in ("count", "sum"):
                pipeline.hincrby(key, meter_id, typing.cast(int, value))
            else:
                await redis.min_max_script(
                    keys=[key], args=[meter_id, value, func], client=pipeline
                )
        await pipeline.execute()
