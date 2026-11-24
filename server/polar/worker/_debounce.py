import dataclasses
import uuid
from collections.abc import Callable, Mapping
from datetime import UTC, datetime, timedelta
from typing import TYPE_CHECKING, Any, NamedTuple, Never

import dramatiq
import redis
import redis.asyncio
import structlog

from polar.config import settings
from polar.logging import Logger
from polar.observability import TASK_DEBOUNCE_DELAY, TASK_DEBOUNCED
from polar.redis import SyncFailoverRedis

if TYPE_CHECKING:
    from ._enqueue import JSONSerializable

    RedisAsyncIO = redis.asyncio.Redis[str]
    RedisAsyncIOPipeline = redis.asyncio.client.Pipeline[str]
else:
    RedisAsyncIO = redis.asyncio.Redis
    RedisAsyncIOPipeline = redis.asyncio.client.Pipeline

log: Logger = structlog.get_logger()

DEBOUNCE_KEY_TTL = timedelta(hours=1)

# A newer enqueue takes ownership of the key; it must still run.
MARK_EXECUTED_IF_OWNER_SCRIPT = """
if redis.call("HGET", KEYS[1], "message_id") == ARGV[1] then
    redis.call("HSET", KEYS[1], "executed", 1)
    redis.call("HDEL", KEYS[1], "enqueue_timestamp")
end
"""
"""
The TTL for debounce keys, a fail-safe to avoid keys being stuck in Redis.
"""

DEBOUNCE_LOST_AFTER = timedelta(minutes=5)
"""
How long past its due time a waiting message is considered lost, e.g. after a failed
send, so the next enqueue sends a new one.
"""

# While a message is waiting, an enqueue only records its time: the waiting message
# reschedules itself until the enqueues stop. Once it started, it may have read the
# state before the new enqueue, so a new message is sent.
# Returns 1 when the message must be sent.
CLAIM_DEBOUNCE_KEY_SCRIPT = """
local key = KEYS[1]
local message_id = ARGV[1]
local now = tonumber(ARGV[2])
local delay = tonumber(ARGV[3])
local lost_after = tonumber(ARGV[4])
local ttl = ARGV[5]

local waiting, executed, started, due_timestamp = unpack(
    redis.call("HMGET", key, "message_id", "executed", "started", "due_timestamp")
)
if waiting
    and executed == "0"
    and started ~= waiting
    and now <= (tonumber(due_timestamp) or 0) + lost_after then
    redis.call("HSET", key, "last_enqueue_timestamp", now)
    return 0
end

redis.call("HSETNX", key, "enqueue_timestamp", now)
redis.call(
    "HSET", key,
    "message_id", message_id,
    "executed", 0,
    "last_enqueue_timestamp", now,
    "due_timestamp", now + delay
)
redis.call("EXPIRE", key, ttl)
return 1
"""

# Runs the waiting message once no enqueue came in for the min threshold, or once the
# first enqueue is older than the max threshold. Before that, the message must be
# rescheduled for when it's due.
# Returns {SKIP}, {RUN, first enqueue timestamp or -1} or {RESCHEDULE, delay}.
CHECK_DEBOUNCE_SCRIPT = """
local key = KEYS[1]
local message_id = ARGV[1]
local now = tonumber(ARGV[2])
local min_threshold = tonumber(ARGV[3])
local max_threshold = tonumber(ARGV[4])

local owner, executed, started, enqueue_timestamp, last_enqueue_timestamp = unpack(
    redis.call(
        "HMGET", key,
        "message_id", "executed", "started", "enqueue_timestamp", "last_enqueue_timestamp"
    )
)

if not owner then
    return {1, -1}
end
if owner ~= message_id or executed == "1" then
    return {0}
end
-- Retry of a message that already started
if started == message_id then
    return {1, -1}
end

local first_enqueue = tonumber(enqueue_timestamp) or now
local due = math.min(
    (tonumber(last_enqueue_timestamp) or 0) + min_threshold,
    first_enqueue + max_threshold
)
if due > now then
    return {2, due - now}
end

redis.call("HSET", key, "started", message_id)
redis.call("HDEL", key, "enqueue_timestamp")
return {1, first_enqueue}
"""

# Called once the rescheduled message is sent, so a failed send leaves the key to the
# original message, which is retried.
HAND_OVER_DEBOUNCE_SCRIPT = """
if redis.call("HGET", KEYS[1], "message_id") == ARGV[1] then
    redis.call("HSET", KEYS[1], "message_id", ARGV[2], "due_timestamp", ARGV[3])
    redis.call("EXPIRE", KEYS[1], ARGV[4])
end
"""

SKIP, RUN, RESCHEDULE = 0, 1, 2

DEBOUNCE_KEY_PREFIX = "debounce:"
"""
Implicitly added prefix to avoid collisions in Redis.
"""


def now_timestamp() -> int:
    return int(datetime.now(UTC).timestamp())


def get_min_threshold(actor_options: Mapping[str, Any]) -> int:
    return actor_options.get(
        "debounce_min_threshold",
        int(settings.WORKER_DEFAULT_DEBOUNCE_MIN_THRESHOLD.total_seconds()),
    )


def get_max_threshold(actor_options: Mapping[str, Any]) -> int:
    return actor_options.get(
        "debounce_max_threshold",
        int(settings.WORKER_DEFAULT_DEBOUNCE_MAX_THRESHOLD.total_seconds()),
    )


def set_debounce_key(
    pipeline: RedisAsyncIOPipeline,
    actor: dramatiq.Actor[Any, Any],
    message_id: str,
    args: tuple["JSONSerializable", ...],
    kwargs: dict[str, "JSONSerializable"],
    delay: int | None = None,
) -> tuple[str, int] | None:
    """Queue the claim of the debounce key and return it with the job's delay in
    milliseconds; its pipeline result is 0 when the message must not be sent.

    The job runs with the arguments of the first enqueue of its debounce window, so
    jobs sharing a key must be interchangeable.
    """
    debounce_key_factory: Callable[..., str | None] | None = actor.options.get(
        "debounce_key"
    )
    if debounce_key_factory is None:
        return None

    debounce_key = debounce_key_factory(*args, **kwargs)
    if debounce_key is None:
        return None

    key = f"{DEBOUNCE_KEY_PREFIX}{debounce_key}"
    delay = max(delay or 0, get_min_threshold(actor.options) * 1000)

    pipeline.eval(
        CLAIM_DEBOUNCE_KEY_SCRIPT,
        1,
        key,
        message_id,
        now_timestamp(),
        delay // 1000,
        int(DEBOUNCE_LOST_AFTER.total_seconds()),
        int(DEBOUNCE_KEY_TTL.total_seconds()),
    )

    log.debug("Set debounce key", key=key, delay=delay)

    return key, delay


@dataclasses.dataclass
class DebounceContext:
    debounce_key: str
    message_id: str
    enqueue_timestamp: int | None


class DebounceReschedule(NamedTuple):
    message_id: str
    delay: int
    """Delay in milliseconds."""


async def check_debounce(
    redis: RedisAsyncIO,
    actor: dramatiq.Actor[Any, Any],
    message_id: str,
    debounce_key: str,
) -> DebounceContext | DebounceReschedule | None:
    log.debug("Checking debounce key", debounce_key=debounce_key)

    action, *value = await redis.eval(
        CHECK_DEBOUNCE_SCRIPT,
        1,
        debounce_key,
        message_id,
        now_timestamp(),
        get_min_threshold(actor.options),
        get_max_threshold(actor.options),
    )

    if action == RUN:
        enqueue_timestamp = value[0]
        return DebounceContext(
            debounce_key=debounce_key,
            message_id=message_id,
            enqueue_timestamp=enqueue_timestamp if enqueue_timestamp >= 0 else None,
        )

    TASK_DEBOUNCED.labels(queue=actor.queue_name, task_name=actor.actor_name).inc()
    if action == RESCHEDULE:
        log.debug("Debounce not due yet, rescheduling", debounce_key=debounce_key)
        return DebounceReschedule(str(uuid.uuid4()), value[0] * 1000)

    log.debug("Debounce owned by another message, skipping", debounce_key=debounce_key)
    return None


def _hand_over_args(
    debounce_key: str, message_id: str, reschedule: DebounceReschedule
) -> tuple[Any, ...]:
    return (
        HAND_OVER_DEBOUNCE_SCRIPT,
        1,
        debounce_key,
        message_id,
        reschedule.message_id,
        now_timestamp() + reschedule.delay // 1000,
        int(DEBOUNCE_KEY_TTL.total_seconds()),
    )


async def hand_over_debounce(
    redis: RedisAsyncIO,
    debounce_key: str,
    message_id: str,
    reschedule: DebounceReschedule,
) -> None:
    await redis.eval(*_hand_over_args(debounce_key, message_id, reschedule))


async def finalize_debounce(
    redis: RedisAsyncIO,
    actor: dramatiq.Actor[Any, Any],
    context: DebounceContext,
    exception: BaseException | None,
) -> None:
    debounce_key = context.debounce_key
    if context.enqueue_timestamp is not None:
        delay = now_timestamp() - context.enqueue_timestamp
        TASK_DEBOUNCE_DELAY.labels(
            queue=actor.queue_name, task_name=actor.actor_name
        ).observe(delay)

    if exception is None:
        log.debug("Marking debounce key as executed", debounce_key=debounce_key)
        await redis.eval(
            MARK_EXECUTED_IF_OWNER_SCRIPT, 1, debounce_key, context.message_id
        )


class DebounceMiddleware(dramatiq.Middleware):
    """
    Middleware allowing to debounce tasks.
    """

    def __init__(self, redis_pool: redis.ConnectionPool) -> None:
        self._redis = SyncFailoverRedis(
            connection_pool=redis_pool, decode_responses=False
        )

    @property
    def actor_options(self) -> set[str]:
        return {"debounce_key", "debounce_min_threshold", "debounce_max_threshold"}

    @property
    def ephemeral_options(self) -> set[str]:
        return {"debounce_enqueue_timestamp"}

    def before_process_message(
        self, broker: dramatiq.Broker, message: dramatiq.MessageProxy
    ) -> None:
        debounce_key = message.options.get("debounce_key")
        if debounce_key is None:
            return

        log.debug("Checking debounce key", debounce_key=debounce_key)

        actor = broker.get_actor(message.actor_name)
        action, *value = self._redis.eval(
            CHECK_DEBOUNCE_SCRIPT,
            1,
            debounce_key,
            message.message_id,
            now_timestamp(),
            get_min_threshold(actor.options),
            get_max_threshold(actor.options),
        )

        if action == RUN:
            enqueue_timestamp = value[0]
            message.options["debounce_enqueue_timestamp"] = (
                enqueue_timestamp if enqueue_timestamp >= 0 else None
            )
            return

        if action == RESCHEDULE:
            log.debug("Debounce not due yet, rescheduling", debounce_key=debounce_key)
            reschedule = DebounceReschedule(str(uuid.uuid4()), value[0] * 1000)
            broker.enqueue(
                message.copy(message_id=reschedule.message_id), delay=reschedule.delay
            )
            self._redis.eval(
                *_hand_over_args(debounce_key, message.message_id, reschedule)
            )
        else:
            log.debug(
                "Debounce owned by another message, skipping", debounce_key=debounce_key
            )
        self._skip_debounced(message)

    def after_skip_message(
        self, broker: dramatiq.Broker, message: dramatiq.MessageProxy
    ) -> None:
        message.options.pop("debounce_enqueue_timestamp", None)

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

        enqueue_timestamp: int | None = message.options.pop(
            "debounce_enqueue_timestamp"
        )
        if enqueue_timestamp is not None:
            delay = now_timestamp() - enqueue_timestamp
            queue_name = message.queue_name or "default"
            TASK_DEBOUNCE_DELAY.labels(
                queue=queue_name, task_name=message.actor_name
            ).observe(delay)

        if exception is None:
            log.debug("Marking debounce key as executed", debounce_key=debounce_key)
            self._redis.eval(
                MARK_EXECUTED_IF_OWNER_SCRIPT, 1, debounce_key, message.message_id
            )

    def _skip_debounced(self, message: dramatiq.MessageProxy) -> Never:
        queue_name = message.queue_name or "default"
        TASK_DEBOUNCED.labels(queue=queue_name, task_name=message.actor_name).inc()
        raise dramatiq.middleware.SkipMessage()


__all__ = [
    "DebounceContext",
    "DebounceMiddleware",
    "DebounceReschedule",
    "check_debounce",
    "finalize_debounce",
    "hand_over_debounce",
    "set_debounce_key",
]
