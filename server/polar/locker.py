import contextlib
from collections.abc import AsyncGenerator

import logfire
import structlog
from fastapi import Depends
from redis.asyncio.lock import Lock
from redis.exceptions import LockNotOwnedError

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
            TimeoutLockError: The lock could not be acquired within `blocking_timeout`
            limit.
        """
        lock = Lock(
            self.redis,
            self._get_key(name),
            timeout=timeout,
            sleep=sleep,
            blocking=True,
            blocking_timeout=blocking_timeout,
            thread_local=thread_local,
        )

        with logfire.span(
            "Acquire distributed lock {name}",
            name=name,
            timeout=timeout,
            blocking_timeout=blocking_timeout,
        ):
            log.debug("try to acquire lock", name=name)
            acquired = await lock.acquire()

            if not acquired:
                log.error(
                    "could not acquire lock before set limit",
                    name=name,
                    blocking_timeout=blocking_timeout,
                )
                raise TimeoutLockError()
            else:
                log.debug("acquired lock", name=name)

        with logfire.span(
            "Distributed lock {name} acquired",
            name=name,
            timeout=timeout,
            blocking_timeout=blocking_timeout,
        ):
            try:
                yield lock
            finally:
                try:
                    await lock.release()
                except LockNotOwnedError:
                    log.warning(
                        "Already expired lock cannot be released",
                        name=name,
                        timeout=timeout,
                    )
                else:
                    log.debug("released lock", name=name)

    async def is_locked(self, name: str) -> bool:
        """
        Check if a lock is currently held.

        Args:
            name: Name of the lock. Automatically prefixed by `polarlock:`.

        Returns:
            bool: True if the lock is currently held, False otherwise.
        """
        lock = Lock(self.redis, self._get_key(name))
        return await lock.locked()

    def _get_key(self, name: str) -> str:
        return f"polarlock:{name}"


async def get_locker(redis: Redis = Depends(get_redis)) -> Locker:
    return Locker(redis)
