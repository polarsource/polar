import collections.abc
import contextlib
import time
import uuid

import anyio
from redis.asyncio import Redis
from redis.asyncio.retry import Retry
from redis.backoff import EqualJitterBackoff, NoBackoff
from redis.exceptions import ConnectionError as RedisConnectionError
from redis.exceptions import RedisError
from redis.exceptions import TimeoutError as RedisTimeoutError

DEFAULT_TIMEOUT = {{ redis_constants.timeout / 1000 }}
REDIS_RECONNECT_DELAY = {{ redis_constants.reconnect_delay / 1000 }}
MAX_REDIS_RECONNECT_DELAY = {{ redis_constants.max_reconnect_delay / 1000 }}

EXTEND_LOCK_SCRIPT = """
{{ redis_scripts.common.extend_lock }}"""

RELEASE_LOCK_SCRIPT = """
{{ redis_scripts.common.release_lock }}"""

BACKOFF_SCRIPT = """
{{ redis_scripts.common.backoff }}"""


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


async def release_lock(redis: Redis, key: str, token: str) -> None:
    with contextlib.suppress(RedisError):
        await redis.eval(RELEASE_LOCK_SCRIPT, 1, key, token)


@contextlib.asynccontextmanager
async def connect_redis(
    url: str, *, timeout: float = DEFAULT_TIMEOUT
) -> collections.abc.AsyncGenerator[Redis, None]:
    async with Redis.from_url(
        url,
        retry=Retry(NoBackoff(), 0),
        socket_timeout=timeout,
        socket_connect_timeout=timeout,
    ) as redis:
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
