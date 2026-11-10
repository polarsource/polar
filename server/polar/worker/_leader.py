import time
import uuid
from typing import TYPE_CHECKING

import structlog

from polar.logging import Logger

if TYPE_CHECKING:
    from polar.redis import SyncFailoverRedis

log: Logger = structlog.get_logger()

_RENEW_SCRIPT = """
if redis.call("get", KEYS[1]) == ARGV[1] then
    return redis.call("pexpire", KEYS[1], ARGV[2])
end
return redis.call("set", KEYS[1], ARGV[1], "NX", "PX", ARGV[2]) and 1 or 0
"""

_RELEASE_SCRIPT = """
if redis.call("get", KEYS[1]) == ARGV[1] then
    return redis.call("del", KEYS[1])
end
return 0
"""


class LeaderLeaseLost(Exception):
    pass


class LeaderLease:
    """
    Redis lease ensuring a single scheduler instance enqueues jobs.

    During a zero-downtime deploy the new instance starts before the old one is
    stopped; without the lease both would fire every cron due in that window.
    """

    def __init__(
        self,
        redis: "SyncFailoverRedis",
        key: str,
        *,
        ttl_seconds: float,
        poll_interval_seconds: float = 1.0,
    ) -> None:
        self._redis = redis
        self._key = key
        self._ttl_ms = int(ttl_seconds * 1000)
        self._poll_interval_seconds = poll_interval_seconds
        self._token = uuid.uuid4().hex
        self._renew = redis.register_script(_RENEW_SCRIPT)
        self._release = redis.register_script(_RELEASE_SCRIPT)

    def acquire(self) -> None:
        """Block until this instance holds the lease."""
        waiting_since: float | None = None
        while not self._redis.set(self._key, self._token, nx=True, px=self._ttl_ms):
            if waiting_since is None:
                waiting_since = time.monotonic()
                log.info("Waiting for the scheduler leader lease", key=self._key)
            time.sleep(self._poll_interval_seconds)
        log.info(
            "Acquired the scheduler leader lease",
            key=self._key,
            waited_seconds=(
                time.monotonic() - waiting_since if waiting_since is not None else 0
            ),
        )

    def renew(self) -> None:
        """
        Extend the lease, or re-take it if it expired without anyone else
        claiming it. Raises if another instance holds it.
        """
        if not self._renew(keys=[self._key], args=[self._token, self._ttl_ms]):
            raise LeaderLeaseLost(self._key)

    def release(self) -> None:
        self._release(keys=[self._key], args=[self._token])
