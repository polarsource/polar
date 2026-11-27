import collections.abc
import contextlib
import time
import uuid

import anyio
from redis.asyncio import BlockingConnectionPool, Redis
from redis.asyncio.retry import Retry
from redis.backoff import EqualJitterBackoff, NoBackoff
from redis.exceptions import ConnectionError as RedisConnectionError
from redis.exceptions import RedisError
from redis.exceptions import TimeoutError as RedisTimeoutError

REDIS_CONNECTIONS = 32
DEFAULT_TIMEOUT = 5.0
REDIS_RECONNECT_DELAY = 0.1
MAX_REDIS_RECONNECT_DELAY = 2.0

EXTEND_LOCK_SCRIPT = """
-- Keeps the lock for another ttl milliseconds, if it still holds this instance's token.
local lock = KEYS[1]
local token = ARGV[1]
local ttl = ARGV[2]

if redis.call('GET', lock) == token then
    return redis.call('PEXPIRE', lock, ttl)
end
return 0
"""

RELEASE_LOCK_SCRIPT = """
-- Deletes the lock, if it still holds this instance's token: once the lock expired, another
-- instance may hold it.
local lock = KEYS[1]
local token = ARGV[1]

if redis.call('GET', lock) == token then
    return redis.call('DEL', lock)
end
return 0
"""

BACKOFF_SCRIPT = """
-- Counts one more failure in a row on a key the whole fleet shares, such as the pull's, and
-- says when to try again. Each failure in a row doubles the wait, up to a maximum. Failures
-- met during one wait count as one: they only move the retry later, never sooner.
local key = KEYS[1]
local now = tonumber(ARGV[1])
local first_delay = tonumber(ARGV[2])
local max_delay = tonumber(ARGV[3])
-- Optional: the key expires this many milliseconds later, and its failures with it.
local forget_after = ARGV[4]

local waiting_until = tonumber(redis.call('HGET', key, 'retry_at')) or 0
local failures = waiting_until > now and tonumber(redis.call('HGET', key, 'failures'))
    or redis.call('HINCRBY', key, 'failures', 1)
local delay = math.min(max_delay, first_delay * 2 ^ math.min(failures - 1, 16))
local retry_at = math.max(waiting_until, now + delay)
redis.call('HSET', key, 'retry_at', retry_at)
if forget_after then
    redis.call('PEXPIRE', key, forget_after)
end
return retry_at
"""


class RedisReconnectBackoff(EqualJitterBackoff):
    def __init__(self) -> None:
        super().__init__(cap=MAX_REDIS_RECONNECT_DELAY, base=REDIS_RECONNECT_DELAY)

    def compute(self, failures: int) -> float:
        # Bounded exponent: a long outage would overflow the float otherwise.
        return super().compute(min(failures, 16))


async def take_lock(redis: Redis, key: str, ttl: float) -> str | None:
    """A lock holds its owner's token: only the owner extends or releases it. Past its
    TTL, it may be another instance's."""
    token = uuid.uuid4().hex
    taken = await redis.set(key, token, px=int(ttl * 1000), nx=True)
    return token if taken else None


async def extend_lock(redis: Redis, key: str, token: str, ttl: float) -> bool:
    return bool(await redis.eval(EXTEND_LOCK_SCRIPT, 1, key, token, int(ttl * 1000)))


async def release_lock(redis: Redis, key: str, token: str) -> bool:
    try:
        await redis.eval(RELEASE_LOCK_SCRIPT, 1, key, token)
    except RedisError:
        return False
    return True


@contextlib.asynccontextmanager
async def connect_redis(
    url: str, *, timeout: float = DEFAULT_TIMEOUT
) -> collections.abc.AsyncGenerator[Redis, None]:
    pool = BlockingConnectionPool.from_url(
        url,
        max_connections=REDIS_CONNECTIONS,
        timeout=timeout,
        retry=Retry(NoBackoff(), 0),
        socket_timeout=timeout,
        socket_connect_timeout=timeout,
    )
    async with Redis.from_pool(pool) as redis:
        # A connection the server closes at once, as under a burst of new ones, is tried
        # again until the timeout.
        deadline = anyio.current_time() + timeout
        backoff = RedisReconnectBackoff()
        failures = 0
        while True:
            try:
                await redis.ping()
                break
            except (RedisConnectionError, RedisTimeoutError):
                failures += 1
                if anyio.current_time() >= deadline:
                    raise
                await anyio.sleep(backoff.compute(failures))
        yield redis


async def back_off(
    redis: Redis | None,
    key: str,
    *forget: int,
    first: float,
    maximum: float,
) -> float:
    """One more failure on the key, for the whole fleet: when to try again."""
    now = int(time.time() * 1000)
    retry_at = now + int(first * 1000)
    if redis is not None:
        with contextlib.suppress(RedisError):
            retry_at = await redis.eval(
                BACKOFF_SCRIPT,
                1,
                key,
                now,
                int(first * 1000),
                int(maximum * 1000),
                *forget,
            )
    return retry_at / 1000
