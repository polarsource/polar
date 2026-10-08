import collections.abc
import contextlib
import typing

from redis.asyncio import Redis

from outpost.env import Environment
from outpost.reducer import EventKey, Updates

BUCKET_TTL = 86400

WRITE_UPDATES_SCRIPT = """
local ttl = ARGV[1]
for i, key in ipairs(KEYS) do
    local offset = 1 + (i - 1) * 3
    local field, func, raw_value = ARGV[offset + 1], ARGV[offset + 2], ARGV[offset + 3]
    if func == 'count' then
        redis.call('HINCRBY', key, field, raw_value)
    elseif func == 'sum' then
        redis.call('HINCRBYFLOAT', key, field, raw_value)
    else
        local value = tonumber(raw_value)
        assert(value and value == value and math.abs(value) ~= math.huge, 'Invalid value')
        assert(func == 'min' or func == 'max', 'Invalid aggregation function')
        local stored = redis.call('HGET', key, field)
        local previous = stored and assert(tonumber(stored), 'Invalid stored value')
        if previous then
            assert(previous == previous and math.abs(previous) ~= math.huge,
                'Invalid stored value')
        end
        if not previous or (func == 'min' and value < previous)
            or (func == 'max' and value > previous) then
            redis.call('HSET', key, field, raw_value)
        end
    end
    redis.call('EXPIRE', key, ttl)
end
return 0
"""


class RedisStorage:
    def __init__(self, redis: Redis) -> None:
        self.redis = redis
        self.write_updates_script = redis.register_script(WRITE_UPDATES_SCRIPT)

    @classmethod
    @contextlib.asynccontextmanager
    async def create(
        cls, env: Environment
    ) -> collections.abc.AsyncIterator[typing.Self]:
        async with Redis.from_url(str(env.redis_url)) as redis:
            storage = cls(redis)
            await redis.script_load(WRITE_UPDATES_SCRIPT)
            yield storage

    async def write_updates(self, updates: Updates) -> None:
        if not updates:
            return
        keys: list[str] = []
        args: list[str | int | float] = [BUCKET_TTL]
        for (customer_id, reducer_id, bucket_start, func), value in updates.items():
            keys.append(f"outpost:buckets:{customer_id}")
            args.extend((f"{reducer_id}:{bucket_start}", func, value))
        await self.write_updates_script(keys=keys, args=args)

    async def claim(self, keys: collections.abc.Sequence[EventKey]) -> list[bool]:
        if not keys:
            return []
        async with self.redis.pipeline(transaction=False) as pipe:
            for customer_id, bucket_start, external_id in keys:
                key = f"outpost:events:{customer_id}:{bucket_start}"
                pipe.sadd(key, external_id)
                pipe.expire(key, BUCKET_TTL)
            results = await pipe.execute()
        return [bool(added) for added in results[::2]]
