from collections.abc import Callable
from datetime import UTC, datetime, timedelta
from typing import TYPE_CHECKING, Any, Never

import dramatiq
import redis
import redis.asyncio
import structlog

from polar.config import settings
from polar.logging import Logger
from polar.observability import TASK_DEBOUNCE_DELAY, TASK_DEBOUNCED

if TYPE_CHECKING:
    from ._enqueue import JSONSerializable

    RedisAsyncIO = redis.asyncio.Redis[str]
else:
    RedisAsyncIO = redis.asyncio.Redis

log: Logger = structlog.get_logger()

DEBOUNCE_KEY_TTL = timedelta(hours=1)
"""
The TTL for debounce keys, a fail-safe to avoid keys being stuck in Redis.
"""


def now_timestamp() -> int:
    return int(datetime.now(UTC).timestamp())


async def set_debounce_key(
    redis: RedisAsyncIO,
    actor: dramatiq.Actor[Any, Any],
    message_id: str,
    args: tuple["JSONSerializable", ...],
    kwargs: dict[str, "JSONSerializable"],
) -> tuple[str, int] | None:
    debounce_key_factory: Callable[..., str] | None = actor.options.get("debounce_key")
    if debounce_key_factory is None:
        return None

    key = debounce_key_factory(*args, **kwargs)
    delay: int = (
        actor.options.get(
            "debounce_min_threshold",
            int(settings.WORKER_DEFAULT_DEBOUNCE_MIN_THRESHOLD.total_seconds()),
        )
        * 1000
    )

    async with redis.pipeline(transaction=True) as pipe:
        # Always keep the oldest timestamp, if it exists
        await pipe.hsetnx(key, "enqueue_timestamp", now_timestamp())
        # Change owner to current message_id
        await pipe.hset(key, "message_id", message_id)
        # Set task as non-executed
        await pipe.hset(key, "executed", 0)
        # Set TTL to avoid keys being stuck in Redis
        await pipe.expire(key, DEBOUNCE_KEY_TTL)
        await pipe.execute()

    log.debug("Set debounce key", key=key, delay=delay)

    return key, delay


class DebounceMiddleware(dramatiq.Middleware):
    """
    Middleware allowing to debounce tasks.
    """

    def __init__(self, redis_pool: redis.ConnectionPool) -> None:
        self._redis = redis.Redis(connection_pool=redis_pool, decode_responses=False)

    @property
    def actor_options(self) -> set[str]:
        return {"debounce_key", "debounce_min_threshold", "debounce_max_threshold"}

    def before_process_message(
        self, broker: dramatiq.Broker, message: dramatiq.MessageProxy
    ) -> None:
        debounce_key = message.options.get("debounce_key")
        if debounce_key is None:
            return

        log.debug("Checking debounce key", debounce_key=debounce_key)

        debounce_data = self._redis.hgetall(debounce_key)
        if not debounce_data:
            return

        # Already executed in this debounce window
        if int(debounce_data.get(b"executed", 0)):
            log.debug(
                "Debounce key already executed, skipping", debounce_key=debounce_key
            )
            self._skip_debounced(message)

        message_owner = debounce_data[b"message_id"].decode("utf-8")
        enqueue_timestamp = int(debounce_data[b"enqueue_timestamp"])
        message.options["debounce_enqueue_timestamp"] = enqueue_timestamp

        # Owner always executes
        if message_owner == message.message_id:
            return

        # Not owner: check max threshold
        max_threshold = self._get_debounce_max_threshold(broker, message)
        if enqueue_timestamp + max_threshold < now_timestamp():
            log.info(
                "Max debounce threshold reached, executing",
                debounce_key=debounce_key,
                owner_message_id=message_owner,
            )
            message.options["debounce_max_threshold_execution"] = True
            return

        # Not owner, max threshold not reached: skip
        log.info(
            "Debounce owned by another message, skipping",
            debounce_key=debounce_key,
            owner_message_id=message_owner,
        )
        self._skip_debounced(message)

    def after_process_message(
        self,
        broker: dramatiq.Broker,
        message: dramatiq.MessageProxy,
        *,
        result: Any = None,
        exception: BaseException | None = None,
    ) -> None:
        debounce_key = message.options.get("debounce_key")
        if debounce_key is None:
            return

        enqueue_timestamp: int | None = message.options.get(
            "debounce_enqueue_timestamp"
        )
        if enqueue_timestamp is not None:
            delay = now_timestamp() - enqueue_timestamp
            queue_name = message.queue_name or "default"
            TASK_DEBOUNCE_DELAY.labels(
                queue=queue_name, task_name=message.actor_name
            ).observe(delay)

        with self._redis.pipeline(transaction=True) as pipe:
            if message.options.pop("debounce_max_threshold_execution", False):
                log.debug(
                    "Bumping debounce key enqueue timestamp after max threshold execution",
                    debounce_key=debounce_key,
                )
                pipe.hset(debounce_key, "enqueue_timestamp", now_timestamp())
                pipe.expire(debounce_key, DEBOUNCE_KEY_TTL)
            elif exception is None:
                log.debug("Marking debounce key as executed", debounce_key=debounce_key)
                pipe.hset(debounce_key, "executed", 1)
                pipe.hdel(debounce_key, "enqueue_timestamp")
            pipe.execute()

    def _get_debounce_max_threshold(
        self, broker: dramatiq.Broker, message: dramatiq.MessageProxy
    ) -> int:
        actor = broker.get_actor(message.actor_name)
        return message.options.get(
            "debounce_max_threshold",
            actor.options.get(
                "debounce_max_threshold",
                int(settings.WORKER_DEFAULT_DEBOUNCE_MAX_THRESHOLD.total_seconds()),
            ),
        )

    def _skip_debounced(self, message: dramatiq.MessageProxy) -> Never:
        queue_name = message.queue_name or "default"
        TASK_DEBOUNCED.labels(queue=queue_name, task_name=message.actor_name).inc()
        raise dramatiq.middleware.SkipMessage()


__all__ = ["DebounceMiddleware", "set_debounce_key"]
