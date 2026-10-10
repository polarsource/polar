import collections.abc
import contextlib
import typing

from redis.asyncio import Redis

from outpost.env import Environment
from outpost.reducer import CustomerState, EventKey, Snapshot, Updates

BUCKET_TTL = 86400

WRITE_UPDATES_SCRIPT = """
local ttl = ARGV[1]
for i = 1, #KEYS, 2 do
    local key, snapshot_key = KEYS[i], KEYS[i + 1]
    local offset = 1 + (i - 1) * 2
    local field, func, raw_value, bucket_start =
        ARGV[offset + 1], ARGV[offset + 2], ARGV[offset + 3], ARGV[offset + 4]
    local cold_until = tonumber(redis.call('HGET', snapshot_key, 'cold_until'))
    if not cold_until or tonumber(bucket_start) >= cold_until then
        if func == 'count' then
            redis.call('HINCRBY', key, field, raw_value)
        elseif func == 'sum' then
            redis.call('HINCRBYFLOAT', key, field, raw_value)
        else
            local value = tonumber(raw_value)
            assert(value and value == value and math.abs(value) ~= math.huge,
                'Invalid value')
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
        if cold_until then
            redis.call('EXPIRE', snapshot_key, ttl)
        end
    end
end
return 0
"""

APPLY_SNAPSHOT_SCRIPT = """
local snapshot_key, buckets_key = KEYS[1], KEYS[2]
local cold_until, ttl, field_count = tonumber(ARGV[1]), ARGV[2], tonumber(ARGV[3])
local current = tonumber(redis.call('HGET', snapshot_key, 'cold_until'))
if current and current > cold_until then
    return 0
end
redis.call('DEL', snapshot_key)
redis.call('HSET', snapshot_key, 'cold_until', cold_until)
local i = 4
for _ = 1, field_count do
    redis.call('HSET', snapshot_key, ARGV[i], ARGV[i + 1])
    i = i + 2
end
for _, field in ipairs(redis.call('HKEYS', buckets_key)) do
    if tonumber(string.match(field, ':(%d+)$')) < cold_until then
        redis.call('HDEL', buckets_key, field)
    end
end
if not current then
    while i <= #ARGV do
        redis.call('HSET', buckets_key, ARGV[i], ARGV[i + 1])
        i = i + 2
    end
end
redis.call('EXPIRE', snapshot_key, ttl)
if redis.call('EXISTS', buckets_key) == 1 then
    redis.call('EXPIRE', buckets_key, ttl)
end
return 1
"""


class RedisStorage:
    def __init__(self, redis: Redis) -> None:
        self.redis = redis
        self.write_updates_script = redis.register_script(WRITE_UPDATES_SCRIPT)
        self.apply_snapshot_script = redis.register_script(APPLY_SNAPSHOT_SCRIPT)

    @classmethod
    @contextlib.asynccontextmanager
    async def create(
        cls, env: Environment
    ) -> collections.abc.AsyncIterator[typing.Self]:
        async with Redis.from_url(str(env.redis_url)) as redis:
            storage = cls(redis)
            await redis.script_load(WRITE_UPDATES_SCRIPT)
            await redis.script_load(APPLY_SNAPSHOT_SCRIPT)
            yield storage

    async def write_updates(self, updates: Updates) -> None:
        if not updates:
            return
        keys: list[str] = []
        args: list[str | int | float] = [BUCKET_TTL]
        for (customer_id, reducer_id, bucket_start, func), value in updates.items():
            keys.extend(
                (f"outpost:buckets:{customer_id}", f"outpost:snapshot:{customer_id}")
            )
            args.extend((f"{reducer_id}:{bucket_start}", func, value, bucket_start))
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

    async def apply_snapshot(self, snapshot: Snapshot) -> None:
        customer_id = snapshot["external_customer_id"]
        args: list[str | int | float] = [
            snapshot["cold_until"],
            BUCKET_TTL,
            len(snapshot["cold"]) + len(snapshot["credited"]),
        ]
        for reducer_id, value in snapshot["cold"].items():
            args.extend((f"cold:{reducer_id}", value))
        for meter_id, value in snapshot["credited"].items():
            args.extend((f"credited:{meter_id}", value))
        for bucket in snapshot["buckets"]:
            args.extend(
                (f"{bucket['reducer_id']}:{bucket['bucket_start']}", bucket["value"])
            )
        await self.apply_snapshot_script(
            keys=[f"outpost:snapshot:{customer_id}", f"outpost:buckets:{customer_id}"],
            args=args,
        )

    async def read(self, customer_id: str) -> CustomerState:
        async with self.redis.pipeline(transaction=True) as pipe:
            pipe.hgetall(f"outpost:snapshot:{customer_id}")
            pipe.hgetall(f"outpost:buckets:{customer_id}")
            snapshot, stored_buckets = await pipe.execute()
        buckets: dict[tuple[str, int], int | float] = {}
        for field, value in stored_buckets.items():
            reducer_id, bucket_start = field.decode().rsplit(":", 1)
            buckets[(reducer_id, int(bucket_start))] = float(value)
        state: CustomerState = {
            "cold_until": None,
            "cold": {},
            "credited": {},
            "buckets": buckets,
        }
        for field, value in snapshot.items():
            match field.decode().split(":", 1):
                case ["cold_until"]:
                    state["cold_until"] = int(value)
                case ["cold", reducer_id]:
                    state["cold"][reducer_id] = float(value)
                case ["credited", meter_id]:
                    state["credited"][meter_id] = float(value)
        return state
