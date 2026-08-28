import asyncio
import contextlib
import enum
import functools
import inspect
import math
import time
from collections.abc import Iterator, Mapping, Sequence
from typing import Any

import dramatiq
import logfire
import structlog
from dramatiq.common import compute_backoff
from dramatiq.errors import Retry
from dramatiq.middleware.current_message import CurrentMessage
from dramatiq.middleware.group_callbacks import GroupCallbacks
from dramatiq.middleware.retries import DEFAULT_MAX_BACKOFF

from polar import tasks  # noqa: F401  (registers all actors with the broker)
from polar.config import settings
from polar.logging import CorrelationID, Logger

from . import _sqs
from ._broker import TASK_TIME_LIMIT_DEFAULT_MS
from ._debounce import DebounceContext, check_debounce, finalize_debounce
from ._enqueue import resolve_sqs_actors
from ._httpx import _close_client, setup_httpx
from ._redis import RedisMiddleware, _close_redis, setup_redis
from ._sqlalchemy import dispose_sqlalchemy_engine, setup_sqlalchemy

log: Logger = structlog.get_logger()

_MAX_UNWRAP_DEPTH = 10

# Canary: fail fast if Dramatiq changes the CurrentMessage API we rely on.
assert hasattr(CurrentMessage, "_MESSAGE"), (
    "Dramatiq CurrentMessage._MESSAGE no longer exists — "
    "polar/worker/_runner.py needs updating to match the new API"
)


class UnknownActor(Exception):
    def __init__(self, actor_name: str) -> None:
        self.actor_name = actor_name
        super().__init__(f"No registered actor named {actor_name!r}")


class TaskTimeoutError(Exception):
    def __init__(self, actor_name: str, timeout_seconds: float) -> None:
        self.actor_name = actor_name
        self.timeout_seconds = timeout_seconds
        super().__init__(
            f"Task {actor_name!r} timed out after {timeout_seconds:g} seconds"
        )


def _unwrap_to_coroutine(fn: Any, actor_name: str) -> Any:
    """Unwrap decorator layers until reaching the async function.

    Stops at our ``actor`` wrapper (``_wrapped_fn``), which is itself a
    coroutine and opens its own JobQueueManager for sub-task flushing.
    """
    for _ in range(_MAX_UNWRAP_DEPTH):
        if inspect.iscoroutinefunction(fn):
            return fn
        if hasattr(fn, "__wrapped__"):
            fn = fn.__wrapped__
        else:
            break
    raise TypeError(
        f"Actor {actor_name!r}: could not unwrap to a coroutine function "
        f"after {_MAX_UNWRAP_DEPTH} levels."
    )


@functools.cache
def build_registry() -> dict[str, Any]:
    registry: dict[str, Any] = {}
    broker = dramatiq.get_broker()
    for actor_name in broker.get_declared_actors():
        actor_obj = broker.get_actor(actor_name)
        registry[actor_name] = _unwrap_to_coroutine(actor_obj.fn, actor_name)
    return registry


def validate_allowlist() -> None:
    """Reject allowlisted actors that can't behave correctly over SQS."""
    broker = dramatiq.get_broker()
    default_min_threshold = int(
        settings.WORKER_DEFAULT_DEBOUNCE_MIN_THRESHOLD.total_seconds()
    )
    for actor_name in resolve_sqs_actors():
        actor_obj = broker.get_actor(actor_name)
        queue_name = _sqs.actor_to_queue_name(actor_name)
        if len(queue_name) > 80:
            raise ValueError(f"SQS queue name {queue_name!r} exceeds 80 characters")
        if actor_obj.options.get("debounce_key") is not None:
            min_threshold = actor_obj.options.get(
                "debounce_min_threshold", default_min_threshold
            )
            if min_threshold > _sqs.MAX_DELAY_SECONDS:
                raise ValueError(
                    f"Actor {actor_name!r} debounce_min_threshold exceeds the "
                    f"{_sqs.MAX_DELAY_SECONDS}s SQS delay cap"
                )


def get_actor_max_retries(actor_name: str) -> int:
    actor = dramatiq.get_broker().get_actor(actor_name)
    return actor.options.get("max_retries", settings.WORKER_MAX_RETRIES)


def compute_retry_backoff(
    actor_name: str, receive_count: int, exception: BaseException | None = None
) -> int:
    """Seconds to delay the next redelivery, mirroring Dramatiq's Retries middleware."""
    max_backoff_seconds = math.ceil(DEFAULT_MAX_BACKOFF / 1000)
    if isinstance(exception, Retry) and exception.delay is not None:
        return min(math.ceil(exception.delay / 1000), max_backoff_seconds)
    actor = dramatiq.get_broker().get_actor(actor_name)
    min_backoff = actor.options.get(
        "min_backoff", settings.WORKER_MIN_BACKOFF_MILLISECONDS
    )
    max_backoff = min(
        actor.options.get("max_backoff", DEFAULT_MAX_BACKOFF), DEFAULT_MAX_BACKOFF
    )
    retries = max(receive_count - 1, 0)
    _, delay_ms = compute_backoff(retries, factor=min_backoff, max_backoff=max_backoff)
    return min(math.ceil(delay_ms / 1000), max_backoff_seconds)


class RetryAction(enum.Enum):
    DEAD_LETTER = "dead_letter"
    RE_ENQUEUE = "re_enqueue"
    SCHEDULE = "schedule"
    SET_VISIBILITY = "set_visibility"


def plan_retry(
    actor_name: str,
    receive_count: int,
    exception: BaseException | None,
    *,
    scheduler_available: bool,
) -> tuple[RetryAction, int]:
    """Pick where a failed task waits out its backoff, and for how many seconds."""
    retries_used = receive_count - 1
    if retries_used >= get_actor_max_retries(actor_name):
        return RetryAction.DEAD_LETTER, 0

    backoff_seconds = compute_retry_backoff(actor_name, receive_count, exception)
    if backoff_seconds <= _sqs.MAX_DELAY_SECONDS:
        return RetryAction.RE_ENQUEUE, backoff_seconds
    if not scheduler_available:
        return RetryAction.SET_VISIBILITY, min(
            backoff_seconds, _sqs.MAX_VISIBILITY_TIMEOUT_SECONDS
        )
    return RetryAction.SCHEDULE, backoff_seconds


@contextlib.contextmanager
def _task_span(
    actor_name: str,
    message: dramatiq.Message[Any],
    correlation_id: str,
    source_correlation_id: str | None,
) -> Iterator[None]:
    if actor_name in settings.LOGFIRE_IGNORED_ACTORS:
        with logfire.suppress_instrumentation():
            yield
    else:
        with logfire.span(
            "TASK {actor}",
            actor=actor_name,
            message=message.asdict(),
            correlation_id=correlation_id,
            source_correlation_id=source_correlation_id,
        ):
            yield


async def run_task(
    actor_name: str,
    args: Sequence[Any] = (),
    kwargs: dict[str, Any] | None = None,
    *,
    receive_count: int = 1,
    source_correlation_id: str | None = None,
    remaining_time_seconds: float | None = None,
    message_timestamp: int | None = None,
    message_id: str | None = None,
    debounce_key: str | None = None,
    message_options: Mapping[str, Any] | None = None,
) -> None:
    registry = build_registry()
    fn = registry.get(actor_name)
    if fn is None:
        raise UnknownActor(actor_name)

    kwargs = kwargs or {}
    broker = dramatiq.get_broker()
    actor_obj = broker.get_actor(actor_name)
    time_limit_ms = actor_obj.options.get("time_limit", TASK_TIME_LIMIT_DEFAULT_MS)
    timeout_seconds = time_limit_ms / 1000
    if remaining_time_seconds is not None:
        timeout_seconds = max(0.0, min(timeout_seconds, remaining_time_seconds))
    message: dramatiq.Message[Any] = dramatiq.Message(
        queue_name=actor_obj.queue_name,
        actor_name=actor_name,
        args=tuple(args),
        kwargs=kwargs,
        options={
            **(message_options or {}),
            "retries": receive_count - 1,
            "max_retries": actor_obj.options.get(
                "max_retries", settings.WORKER_MAX_RETRIES
            ),
        },
        message_timestamp=message_timestamp
        if message_timestamp is not None
        else int(time.time() * 1000),
    )

    max_age = actor_obj.options.get("max_age")
    if max_age and int(time.time() * 1000) - message.message_timestamp >= max_age:
        log.warning(
            "polar.worker.task_age_limit_exceeded",
            actor_name=actor_name,
            max_age=max_age,
        )
        return

    correlation_id = CorrelationID.set()
    structlog.contextvars.bind_contextvars(
        actor_name=actor_name,
        correlation_id=correlation_id,
        source_correlation_id=source_correlation_id,
    )
    token = CurrentMessage._MESSAGE.set(message)
    try:
        debounce_context: DebounceContext | None = None
        if message_id is not None and debounce_key is not None:
            debounce_context = await check_debounce(
                RedisMiddleware.get(), actor_obj, message_id, debounce_key
            )
            if debounce_context is None:
                return

        # Retries are expected: re-raise outside the span so Logfire doesn't record an error
        retry: Retry | None = None
        failure: BaseException | None = None
        try:
            with _task_span(actor_name, message, correlation_id, source_correlation_id):
                try:
                    timeout_cm = asyncio.timeout(timeout_seconds)
                    async with timeout_cm:
                        await fn(*args, **kwargs)
                except TimeoutError:
                    if timeout_cm.expired():
                        raise TaskTimeoutError(actor_name, timeout_seconds) from None
                    raise
                except Retry as e:
                    retry = e
        except BaseException as e:
            failure = e
            raise
        finally:
            if debounce_context is not None:
                await finalize_debounce(
                    RedisMiddleware.get(), actor_obj, debounce_context, failure or retry
                )
        if retry is not None:
            raise retry
        if message.options.get("group_completion_uuid"):
            group_callbacks = next(
                middleware
                for middleware in broker.middleware
                if isinstance(middleware, GroupCallbacks)
            )
            await asyncio.to_thread(
                group_callbacks.after_process_message, broker, message
            )
    finally:
        CurrentMessage._MESSAGE.reset(token)
        structlog.contextvars.unbind_contextvars(
            "actor_name", "correlation_id", "source_correlation_id"
        )


def bootstrap(*, pool_pre_ping: bool = False) -> None:
    """Initialize worker resources (DB engine + Redis + HTTPX) for the SQS runner."""
    setup_sqlalchemy(pool_name="worker-sqs", pool_pre_ping=pool_pre_ping)
    setup_redis()
    setup_httpx()
    validate_allowlist()


async def shutdown() -> None:
    await dispose_sqlalchemy_engine()
    await _close_redis()
    await _close_client()


__all__ = [
    "RetryAction",
    "TaskTimeoutError",
    "UnknownActor",
    "bootstrap",
    "build_registry",
    "compute_retry_backoff",
    "get_actor_max_retries",
    "plan_retry",
    "run_task",
    "shutdown",
    "validate_allowlist",
]
