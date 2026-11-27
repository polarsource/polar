"""
Task drain utility for E2E tests.

Reads Dramatiq messages from Redis and executes the corresponding task
functions inline, allowing synchronous verification of async side effects.
"""

import json
from dataclasses import dataclass, field
from typing import Any, Protocol

import dramatiq
from dramatiq import Retry
from dramatiq.middleware.current_message import CurrentMessage

from polar.config import settings
from polar.event.service import event as event_service
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
        # Uploads invoice PDF to S3
        "order.invoice",
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
    "invoices_and_receipts",
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

        # Do what the staged events mover does in production
        jqm = JobQueueManager.set()
        while await event_service.move_staged_events(self._session, 1000):
            pass
        await jqm.flush(broker, self._redis)

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
            assert not isinstance(raw_message_id, list)

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
        """Execute a single task function with proper CurrentMessage context.

        Each task runs inside an outer SAVEPOINT so that if the task
        fails (and ``AsyncSessionMaker`` calls ``session.rollback()``),
        the rollback is contained and cannot corrupt the shared test
        session.  Successful tasks release the SAVEPOINT, making their
        changes visible in the connection's transaction for subsequent
        tasks and assertions.
        """
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
            nested = await self._session.begin_nested()
            try:
                await fn(*args, **kwargs)
            except Retry:
                # Retry is success from the drain's perspective.
                # The inner rollback already happened; just make sure
                # our SAVEPOINT is cleaned up.
                if nested.is_active:
                    await nested.rollback()
                return None
            except Exception as exc:
                if nested.is_active:
                    await nested.rollback()
                return exc
            else:
                # Task succeeded — release the SAVEPOINT so its changes
                # are visible in the outer transaction.
                if nested.is_active:
                    await nested.commit()
                return None
        finally:
            CurrentMessage._MESSAGE.set(None)
