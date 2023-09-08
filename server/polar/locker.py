import contextlib
from collections.abc import AsyncGenerator

import structlog
from fastapi import Depends
from redis.asyncio.lock import Lock

from polar.logging import Logger
from polar.redis import Redis, get_redis

log: Logger = structlog.get_logger()


class Locker:
    def __init__(self, redis: Redis) -> None:
        self.redis = redis

    @contextlib.asynccontextmanager
    async def lock(
        self,
        name: str,
        timeout: float | None = 1.0,
        sleep: float = 0.1,
        blocking_timeout: float | None = None,
        thread_local: bool = True,
    ) -> AsyncGenerator[Lock, None]:
        lock = Lock(
            self.redis,
            f"polarlock:{name}",
            timeout=timeout,
            sleep=sleep,
            blocking=True,
            blocking_timeout=blocking_timeout,
            thread_local=thread_local,
        )

        log.debug("try to acquire lock", name=name)
        await lock.acquire()
        log.debug("acquired lock", name=name)

        yield lock

        await lock.release()
        log.debug("released lock", name=name)


async def get_locker(redis: Redis = Depends(get_redis)) -> Locker:
    return Locker(redis)
