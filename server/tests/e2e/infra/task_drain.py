"""
Task drain utility for E2E tests.

Reads Dramatiq messages from Redis and executes the corresponding task
functions inline, allowing synchronous verification of async side effects.
"""

import asyncio
import importlib
import json
from collections.abc import Awaitable, Callable, Coroutine
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

import dramatiq
from dramatiq.middleware.current_message import CurrentMessage

from polar.config import settings
from polar.kit.db.postgres import AsyncSession
from polar.redis import Redis
from polar.worker import JobQueueManager
from polar.worker._enqueue import _job_queue_manager

# Canary: fail at import time if Dramatiq changes the CurrentMessage API
assert hasattr(CurrentMessage, "_MESSAGE"), (
    "Dramatiq CurrentMessage._MESSAGE no longer exists — "
    "task_drain.py needs updating to match the new API"
)

# Actors that are safe to skip by default because they call external services
# or aren't meaningful for E2E purchase flow verification.
DEFAULT_IGNORED_ACTORS: frozenset[str] = frozenset(
    {
        # Requires Stripe API call to look up charge details for balance transactions
        "order.balance",
        # Uploads invoice PDF to S3/MinIO
        "order.invoice",
        # Loops.so CRM integration
        "loops.update_last_order_at",
        "loops.update_contact",
        "loops.send_event",
        # Tinybird analytics ingestion
        "tinybird.ingest",
    }
)

QUEUE_NAMES = (
    "high_priority",
    "medium_priority",
    "low_priority",
    "webhooks",
    "tinybird",
)
MAX_DRAIN_ITERATIONS = 200


@dataclass
class DrainResult:
    """Result of a task drain operation."""

    executed: list[str] = field(default_factory=list)
    failures: list[tuple[str, Exception]] = field(default_factory=list)

    def __contains__(self, actor_name: str) -> bool:
        """Allow ``assert "order.created" in result``."""
        return actor_name in self.executed


# Type alias for the drain callable returned by the fixture
DrainFn = Callable[..., Awaitable[DrainResult]]


class TaskDrainError(Exception):
    """Raised when one or more background tasks fail during drain."""

    def __init__(self, failures: list[tuple[str, Exception]]) -> None:
        self.failures = failures
        names = ", ".join(name for name, _ in failures)
        super().__init__(
            f"{len(failures)} background task(s) failed: {names}\n"
            + "\n".join(f"  {name}: {exc}" for name, exc in failures)
        )


def _discover_task_modules() -> None:
    """Import all ``tasks.py`` modules under ``polar/`` so actors register with the broker."""
    polar_root = Path(__file__).resolve().parents[2] / "polar"
    for tasks_file in sorted(polar_root.rglob("tasks.py")):
        module_path = (
            str(tasks_file.relative_to(polar_root.parent))
            .replace("/", ".")
            .removesuffix(".py")
        )
        importlib.import_module(module_path)


def build_actor_registry() -> dict[str, Callable[..., Coroutine[Any, Any, Any]]]:
    """
    Build a mapping from actor_name to the original async function.

    The Dramatiq broker wraps async functions with async_to_sync, making them
    sync. We unwrap exactly one level (past async_to_sync) to get our
    _wrapped_fn which is async and handles JobQueueManager for sub-task flushing.
    """
    _discover_task_modules()

    registry: dict[str, Any] = {}
    broker = dramatiq.get_broker()
    for actor_name in broker.get_declared_actors():
        actor_obj = broker.get_actor(actor_name)
        fn = actor_obj.fn
        # Unwrap exactly once: async_to_sync wrapper -> our _wrapped_fn
        if hasattr(fn, "__wrapped__"):
            fn = fn.__wrapped__
        if not asyncio.iscoroutinefunction(fn):
            raise TypeError(
                f"Actor {actor_name!r}: expected coroutine function after unwrapping, "
                f"got {type(fn).__name__}. Dramatiq wrapping may have changed."
            )
        registry[actor_name] = fn
    return registry


class TaskDrain:
    """
    Drains Dramatiq task queues by executing tasks inline.

    After each HTTP request, call ``drain()`` to flush the JobQueueManager
    to Redis and then execute all enqueued tasks synchronously. Sub-tasks
    enqueued during execution are automatically picked up.
    """

    def __init__(
        self,
        session: AsyncSession,
        redis: Redis,
        registry: dict[str, Callable[..., Coroutine[Any, Any, Any]]],
    ) -> None:
        self._session = session
        self._redis = redis
        self._registry = registry

    async def drain(
        self,
        *,
        ignored_actors: set[str] | None = None,
        raise_on_failure: bool = True,
    ) -> DrainResult:
        """
        Flush enqueued jobs to Redis, then execute all tasks until queues are empty.

        Args:
            ignored_actors: Additional actor names to skip (merged with defaults).
            raise_on_failure: If True, raise TaskDrainError when tasks fail.

        Returns:
            DrainResult with executed actor names and any failures.
        """
        await self._session.flush()

        broker = dramatiq.get_broker()
        ignored = DEFAULT_IGNORED_ACTORS | (ignored_actors or set())
        result = DrainResult()

        # Flush the HTTP request's JQM to Redis
        try:
            jqm = JobQueueManager.get()
            await jqm.flush(broker, self._redis)
        except RuntimeError:
            pass  # No JQM in context

        for _ in range(MAX_DRAIN_ITERATIONS):
            message = await self._pop_next_message()
            if message is None:
                break

            actor_name = message["actor_name"]
            if actor_name in ignored:
                continue

            fn = self._registry.get(actor_name)
            if fn is None:
                continue

            error = await self._execute_task(fn, message)
            if error is not None:
                result.failures.append((actor_name, error))
            else:
                result.executed.append(actor_name)

        # Reset JQM context for the next HTTP request
        _job_queue_manager.set(JobQueueManager())

        if raise_on_failure and result.failures:
            raise TaskDrainError(result.failures) from result.failures[0][1]

        return result

    async def _pop_next_message(self) -> dict[str, Any] | None:
        """Pop the next message from any Redis queue. Returns None if all empty."""
        for queue_name in QUEUE_NAMES:
            redis_key = f"dramatiq:{queue_name}"
            raw_message_id = await self._redis.lpop(redis_key)
            if raw_message_id is None:
                continue

            message_id = (
                raw_message_id.decode()
                if isinstance(raw_message_id, bytes)
                else raw_message_id
            )
            msgs_key = f"dramatiq:{queue_name}.msgs"
            encoded = await self._redis.hget(msgs_key, message_id)
            if encoded is None:
                continue

            await self._redis.hdel(msgs_key, message_id)

            message_data = json.loads(encoded)
            message_data["_queue_name"] = queue_name
            return message_data

        return None

    async def _execute_task(
        self,
        fn: Callable[..., Coroutine[Any, Any, Any]],
        message: dict[str, Any],
    ) -> Exception | None:
        """Execute a single task function with proper CurrentMessage context."""
        args = message.get("args", ())
        kwargs = message.get("kwargs", {})
        options = message.get("options", {})

        # Mirrors CurrentMessage.before_process_message behavior
        msg = dramatiq.Message(
            queue_name=message.get("_queue_name", "default"),
            actor_name=message["actor_name"],
            args=args,
            kwargs=kwargs,
            options={
                "retries": 0,
                "max_retries": settings.WORKER_MAX_RETRIES,
                **options,
            },
        )
        CurrentMessage._MESSAGE.set(msg)
        try:
            await fn(*args, **kwargs)
            return None
        except Exception as exc:
            return exc
        finally:
            CurrentMessage._MESSAGE.set(None)
