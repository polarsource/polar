"""
Task drain utility for E2E tests.

Reads Dramatiq messages from Redis and executes the corresponding task
functions inline, allowing synchronous verification of async side effects.
"""

import asyncio
import importlib
import json
import logging
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Protocol

import dramatiq
from dramatiq import Retry
from dramatiq.middleware.current_message import CurrentMessage

from polar.config import settings
from polar.kit.db.postgres import AsyncSession
from polar.redis import Redis
from polar.worker import JobQueueManager
from polar.worker._enqueue import _job_queue_manager

logger = logging.getLogger(__name__)

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
        # Uses Retry for concurrency — AsyncSessionMaker rollback corrupts the
        # test session.  Safe to skip: in tests there are no concurrent payments.
        "order.void_pending_orders_for_subscription",
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
MAX_UNWRAP_DEPTH = 10


@dataclass
class DrainResult:
    """Result of a task drain operation."""

    executed: list[str] = field(default_factory=list)
    failures: list[tuple[str, Exception]] = field(default_factory=list)

    def __contains__(self, actor_name: str) -> bool:
        """Allow ``assert "order.created" in result``."""
        return actor_name in self.executed


class DrainFn(Protocol):
    """Type for the drain callable returned by the fixture."""

    async def __call__(
        self,
        *,
        ignored_actors: set[str] | None = None,
        raise_on_failure: bool = True,
    ) -> DrainResult: ...


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
    for tasks_file in polar_root.rglob("tasks.py"):
        # Skip test files, __pycache__, and hidden directories
        if any(
            part.startswith((".", "__")) or part == "tests" for part in tasks_file.parts
        ):
            continue
        module_path = (
            str(tasks_file.relative_to(polar_root.parent))
            .replace("/", ".")
            .removesuffix(".py")
        )
        try:
            importlib.import_module(module_path)
        except Exception:
            logger.warning(
                "Failed to import task module %s", module_path, exc_info=True
            )


def _unwrap_to_coroutine(fn: Any, actor_name: str) -> Any:
    """Unwrap decorator layers until we reach the async function.

    Dramatiq's async_to_sync and our worker.actor() decorator both use
    functools.wraps, which sets __wrapped__. We need to get past
    async_to_sync to reach our _wrapped_fn (which is async and handles
    JobQueueManager for sub-task flushing).
    """
    for _ in range(MAX_UNWRAP_DEPTH):
        if asyncio.iscoroutinefunction(fn):
            return fn
        if hasattr(fn, "__wrapped__"):
            fn = fn.__wrapped__
        else:
            break
    raise TypeError(
        f"Actor {actor_name!r}: could not unwrap to a coroutine function "
        f"after {MAX_UNWRAP_DEPTH} levels. Got {type(fn).__name__}."
    )


def build_actor_registry() -> dict[str, Any]:
    """
    Build a mapping from actor_name to the original async function.

    Auto-discovers all task modules under polar/, then unwraps each
    registered actor to get the async function callable from tests.
    """
    _discover_task_modules()

    registry: dict[str, Any] = {}
    broker = dramatiq.get_broker()
    for actor_name in broker.get_declared_actors():
        actor_obj = broker.get_actor(actor_name)
        fn = _unwrap_to_coroutine(actor_obj.fn, actor_name)
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
        registry: dict[str, Any],
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
        except RuntimeError as exc:
            # Only suppress "not initialized" — let other RuntimeErrors propagate
            if "not initialized" not in str(exc).lower():
                raise

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

            # Some tasks use dramatiq group/pipeline which enqueue via
            # broker.enqueue() directly to the broker's Redis, bypassing
            # the drain's FakeRedis. Siphon those messages over.
            await self._siphon_broker_messages()

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

    async def _siphon_broker_messages(self) -> None:
        """Transfer messages from the broker's Redis to the drain's FakeRedis.

        Tasks that use ``dramatiq.group().run()`` or ``dramatiq.pipeline``
        call ``broker.enqueue()`` which writes to the broker's own (real)
        Redis connection, not the drain's FakeRedis.  This method moves
        those messages so the drain loop can pick them up.
        """
        broker = dramatiq.get_broker()
        broker_redis = getattr(broker, "client", None)
        if broker_redis is None or broker_redis is self._redis:
            return

        for queue_name in QUEUE_NAMES:
            redis_key = f"dramatiq:{queue_name}"
            msgs_key = f"dramatiq:{queue_name}.msgs"
            while True:
                raw_id = broker_redis.lpop(redis_key)
                if raw_id is None:
                    break
                message_id = raw_id.decode() if isinstance(raw_id, bytes) else raw_id
                encoded = broker_redis.hget(msgs_key, message_id)
                if encoded is None:
                    continue
                broker_redis.hdel(msgs_key, message_id)
                await self._redis.hset(msgs_key, message_id, encoded)
                await self._redis.rpush(redis_key, message_id)

    async def _execute_task(
        self,
        fn: Any,
        message: dict[str, Any],
    ) -> Exception | None:
        """Execute a single task function with proper CurrentMessage context."""
        args = message.get("args", ())
        kwargs = message.get("kwargs", {})
        options = message.get("options", {})

        # Mirrors CurrentMessage.before_process_message behavior
        msg: dramatiq.Message[Any] = dramatiq.Message(
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
        except Retry:
            return None
        except Exception as exc:
            return exc
        finally:
            CurrentMessage._MESSAGE.set(None)
