import contextlib
import functools
import inspect
import math
from collections.abc import Iterator, Sequence
from typing import Any

import dramatiq
import logfire
import structlog
from dramatiq.common import compute_backoff
from dramatiq.middleware.current_message import CurrentMessage
from dramatiq.middleware.retries import DEFAULT_MAX_BACKOFF

from polar import tasks  # noqa: F401  (registers all actors with the broker)
from polar.config import settings
from polar.logging import CorrelationID, Logger

from . import _sqs
from ._redis import _close_redis, setup_redis
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
    for actor_name in settings.WORKER_SQS_ACTORS:
        actor_obj = broker.get_actor(actor_name)
        queue_name = _sqs.actor_to_queue_name(actor_name)
        if len(queue_name) > 80:
            raise ValueError(f"SQS queue name {queue_name!r} exceeds 80 characters")
        if actor_obj.options.get("debounce_key") is not None:
            raise ValueError(
                f"Actor {actor_name!r} uses debounce, unsupported over SQS"
            )


def compute_retry_backoff(actor_name: str, receive_count: int) -> int:
    """Seconds to delay the next SQS redelivery, mirroring Dramatiq's Retries middleware."""
    actor = dramatiq.get_broker().get_actor(actor_name)
    min_backoff = actor.options.get(
        "min_backoff", settings.WORKER_MIN_BACKOFF_MILLISECONDS
    )
    max_backoff = min(
        actor.options.get("max_backoff", DEFAULT_MAX_BACKOFF), DEFAULT_MAX_BACKOFF
    )
    retries = max(receive_count - 1, 0)
    _, delay_ms = compute_backoff(retries, factor=min_backoff, max_backoff=max_backoff)
    return min(math.ceil(delay_ms / 1000), _sqs.MAX_VISIBILITY_TIMEOUT_SECONDS)


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
) -> None:
    registry = build_registry()
    fn = registry.get(actor_name)
    if fn is None:
        raise UnknownActor(actor_name)

    kwargs = kwargs or {}
    actor_obj = dramatiq.get_broker().get_actor(actor_name)
    message: dramatiq.Message[Any] = dramatiq.Message(
        queue_name=actor_obj.queue_name,
        actor_name=actor_name,
        args=tuple(args),
        kwargs=kwargs,
        options={
            "retries": receive_count - 1,
            "max_retries": actor_obj.options.get(
                "max_retries", settings.WORKER_MAX_RETRIES
            ),
        },
    )

    correlation_id = CorrelationID.set()
    structlog.contextvars.bind_contextvars(
        actor_name=actor_name,
        correlation_id=correlation_id,
        source_correlation_id=source_correlation_id,
    )
    token = CurrentMessage._MESSAGE.set(message)
    try:
        with _task_span(actor_name, message, correlation_id, source_correlation_id):
            await fn(*args, **kwargs)
    finally:
        CurrentMessage._MESSAGE.reset(token)
        structlog.contextvars.unbind_contextvars(
            "actor_name", "correlation_id", "source_correlation_id"
        )


def bootstrap() -> None:
    """Initialize worker resources (DB engine + Redis) for the SQS runner."""
    setup_sqlalchemy(pool_name="worker-sqs")
    setup_redis()
    validate_allowlist()


async def shutdown() -> None:
    await dispose_sqlalchemy_engine()
    await _close_redis()


__all__ = [
    "UnknownActor",
    "bootstrap",
    "build_registry",
    "compute_retry_backoff",
    "run_task",
    "shutdown",
    "validate_allowlist",
]
