import contextlib
from collections.abc import AsyncGenerator

import structlog
from fastapi import Depends
from redis.asyncio.lock import Lock
from redis.exceptions import LockError, LockNotOwnedError

from polar.exceptions import PolarError
from polar.logging import Logger
from polar.redis import Redis, get_redis

log: Logger = structlog.get_logger()


class LockerError(PolarError):
    def __init__(
        self,
        message: str = "A concurrency error occured. Try again later.",
        status_code: int = 500,
    ) -> None:
        super().__init__(message, status_code)


class ExpiredLockError(LockerError):
    pass


class TimeoutLockError(LockerError):
    pass


class Locker:
    """
    Helper class to acquire distributed locks.
    """

    def __init__(self, redis: Redis) -> None:
        self.redis = redis

    @contextlib.asynccontextmanager
    async def lock(
        self,
        name: str,
        *,
        timeout: float,
        blocking_timeout: float,
        sleep: float = 0.1,
        thread_local: bool = True,
    ) -> AsyncGenerator[Lock, None]:
        """
        Acquire a distributed lock on the Redis server.

        Args:
            name: Name of the lock. Automatically prefixed by `polarlock:`.
            timeout: The lifetime of the lock in seconds.
            blocking_timeout: The maximum amount of time in seconds to spend trying
            to acquire the lock.
            sleep: Amount of time in seconds to sleep between each iteration.
            Defaults to 0.1 seconds.

        Raises:
            ExpiredLockError: The lock reached its `timeout` lifetime before
            we released it.
            TimeoutLockError: The lock could not be acquired within `blocking_timeout`
            limit.
        """
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

        try:
            await lock.acquire()
        except LockError as e:
            log.error(
                "could not acquire lock before set limit",
                name=name,
                blocking_timeout=blocking_timeout,
            )
            raise TimeoutLockError() from e

        log.debug("acquired lock", name=name)

        yield lock

        try:
            await lock.release()
        except LockNotOwnedError as e:
            log.error(
                "could not release lock as it already expired",
                name=name,
                timeout=timeout,
            )
            raise ExpiredLockError() from e
        log.debug("released lock", name=name)


async def get_locker(redis: Redis = Depends(get_redis)) -> Locker:
    return Locker(redis)
