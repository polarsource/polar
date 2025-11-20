from __future__ import annotations

import contextlib
import json
import uuid
from collections.abc import AsyncIterator, Awaitable, Callable, Iterable, Mapping
from contextvars import ContextVar
from enum import IntEnum
from typing import Any, ParamSpec, TypeAlias

from vercel.workers.client import send as _queue_send  # type: ignore[reportMissingImports]

from polar.config import settings
from polar.kit.db.postgres import (
    AsyncSessionMaker as AsyncSessionMakerType,
    create_async_sessionmaker,
)
from polar.postgres import AsyncEngine, AsyncSession, create_async_engine
from polar.redis import Redis, create_redis

from .registry import ACTOR_QUEUES, register_actor

JSONSerializable: TypeAlias = (
    Mapping[str, "JSONSerializable"]
    | Iterable["JSONSerializable"]
    | str
    | int
    | float
    | bool
    | uuid.UUID
    | None
)

P = ParamSpec("P")


class TaskPriority(IntEnum):
    HIGH = 0
    MEDIUM = 50
    LOW = 100


class TaskQueue:
    HIGH_PRIORITY = "high_priority"
    DEFAULT = "default"


class Retry(Exception):
    """Signal that a task should be retried by the queue."""

    def __init__(self, *args: Any, delay: int | None = None, **kwargs: Any) -> None:
        super().__init__(*args)
        self.delay = delay


_retry_attempt: ContextVar[int] = ContextVar("polar.worker.retry_attempt", default=0)
_retry_max_retries: ContextVar[int] = ContextVar(
    "polar.worker.retry_max_retries", default=settings.WORKER_MAX_RETRIES
)


def _set_retry_context_from_metadata(
    delivery_count: int | None, max_retries: int | None = None
) -> None:
    """Set retry context based on queue delivery metadata."""
    if delivery_count is None or delivery_count < 0:
        delivery_count = 0
    _retry_attempt.set(delivery_count)
    if max_retries is None:
        max_retries = settings.WORKER_MAX_RETRIES
    _retry_max_retries.set(max_retries)


def get_retries() -> int:
    """Return the current retry attempt for the running task."""
    return _retry_attempt.get()


def can_retry() -> bool:
    """Return True if the current task should be retried again."""
    return get_retries() < _retry_max_retries.get()


_engine: AsyncEngine | None = None
_sessionmaker: AsyncSessionMakerType | None = None


def _ensure_sessionmaker() -> None:
    global _engine, _sessionmaker
    if _engine is None:
        _engine = create_async_engine("worker")
        _sessionmaker = create_async_sessionmaker(_engine)


@contextlib.asynccontextmanager
async def AsyncSessionMaker() -> AsyncIterator[AsyncSession]:
    """
    Context manager to handle a database session for worker tasks.
    """
    _ensure_sessionmaker()
    assert _sessionmaker is not None
    async with _sessionmaker() as session:
        try:
            yield session
        except Exception:
            await session.rollback()
            raise
        else:
            await session.commit()


_redis: Redis | None = None


class RedisMiddleware:
    """
    Backwards-compatible facade providing a shared Redis client for workers.
    """

    @classmethod
    def get(cls) -> Redis:
        global _redis
        if _redis is None:
            _redis = create_redis("worker")
        return _redis


def _json_default(obj: Any) -> Any:
    if isinstance(obj, uuid.UUID):
        return str(obj)
    raise TypeError(f"Object of type {type(obj)} is not JSON serializable")


def _encode_envelope(payload: dict[str, Any]) -> bytes:
    return json.dumps(payload, default=_json_default, separators=(",", ":")).encode(
        "utf-8"
    )


def enqueue_job(
    actor: str, *args: JSONSerializable, **kwargs: JSONSerializable
) -> None:
    """Enqueue a job by actor name onto the Vercel queue."""
    queue_name = ACTOR_QUEUES.get(actor) or TaskQueue.DEFAULT
    envelope: dict[str, Any] = {
        "actor": actor,
        "args": list(args),
        "kwargs": dict(kwargs),
    }
    body = _encode_envelope(envelope)
    # Use a non-default content-type so the queue client does not re-encode JSON.
    _queue_send(queue_name, body, content_type="application/json; charset=utf-8")


def enqueue_events(*event_ids: uuid.UUID) -> None:
    """Enqueue an event ingestion job."""
    enqueue_job("event.ingested", list(event_ids))


def actor[**P, R](
    actor_class: Callable[..., Awaitable[R]] | None = None,
    actor_name: str | None = None,
    queue_name: str | None = None,
    priority: TaskPriority = TaskPriority.LOW,
    cron_trigger: Any | None = None,
    max_retries: int | None = None,
    broker: Any | None = None,
    **options: Any,
) -> Callable[[Callable[P, Awaitable[R]]], Callable[P, Awaitable[R]]]:
    """
    Decorator used to register a worker task.

    The signature is kept compatible with the previous Dramatiq-based
    decorator so that existing task definitions don't need to change,
    but the implementation now only registers metadata for Vercel Workers.
    """
    if queue_name is None:
        queue_name = (
            TaskQueue.HIGH_PRIORITY
            if priority == TaskPriority.HIGH
            else TaskQueue.DEFAULT
        )

    def decorator(fn: Callable[P, Awaitable[R]]) -> Callable[P, Awaitable[R]]:
        name = actor_name or fn.__name__
        register_actor(
            name,
            queue_name or TaskQueue.DEFAULT,
            fn,
            cron_trigger=cron_trigger,
            max_retries=max_retries,
        )
        return fn

    return decorator


__all__ = [
    "actor",
    "AsyncSessionMaker",
    "RedisMiddleware",
    "enqueue_job",
    "enqueue_events",
    "get_retries",
    "can_retry",
    "TaskPriority",
    "TaskQueue",
    "Retry",
    "_set_retry_context_from_metadata",
]
