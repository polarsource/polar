"""
Task executor for billing E2E tests.

Provides utilities to execute tasks directly for E2E testing.

NOTE: Due to the complexity of running Dramatiq workers in tests
(separate thread, separate event loop, session sharing issues),
this executor takes a simpler approach: it directly invokes the
actor functions after flushing the job queue.
"""

import asyncio
import contextlib
import uuid
from collections.abc import AsyncIterator
from typing import Any

import dramatiq
import structlog
from dramatiq.brokers.stub import StubBroker

from polar.redis import Redis
from polar.worker import JobQueueManager
from polar.worker._enqueue import _job_queue_manager

log = structlog.get_logger()


class TestJobQueueManager(JobQueueManager):
    """
    Test-specific JobQueueManager that sends messages directly to StubBroker.

    Unlike the regular JobQueueManager which writes to Redis for the RedisBroker
    to pick up, this version sends messages directly to the StubBroker using
    broker.enqueue().
    """

    def __init__(self, broker: StubBroker) -> None:
        super().__init__()
        self._broker = broker

    async def flush(self, broker: dramatiq.Broker, redis: Redis) -> None:
        """
        Flush pending jobs directly to the StubBroker.

        This overrides the base class to send messages using broker.enqueue()
        instead of writing to Redis.
        """
        log.info(
            "TestJobQueueManager.flush called",
            num_jobs=len(self._enqueued_jobs),
            num_events=len(self._ingested_events),
        )

        if len(self._ingested_events) > 0:
            self.enqueue_job("event.ingested", self._ingested_events)

        if not self._enqueued_jobs:
            self.reset()
            return

        for actor_name, args, kwargs, delay in self._enqueued_jobs:
            try:
                actor = self._broker.get_actor(actor_name)
                # Create and send message directly to StubBroker
                message = actor.message(*args, **kwargs)
                self._broker.enqueue(message)
                log.info(
                    "TestJobQueueManager flushed job to broker",
                    actor_name=actor_name,
                    args=args,
                )
            except dramatiq.ActorNotFound:
                log.warning("Actor not found during flush", actor_name=actor_name)

        self.reset()

    @classmethod
    @contextlib.asynccontextmanager
    async def open_for_test(
        cls, broker: StubBroker, redis: Redis
    ) -> AsyncIterator["TestJobQueueManager"]:
        """Context manager for test job queue management."""
        manager = cls(broker)
        _job_queue_manager.set(manager)
        try:
            yield manager
            await manager.flush(broker, redis)
        finally:
            _job_queue_manager.set(None)


class TaskExecutor:
    """
    Helper to execute pending tasks directly.

    This executor takes a simpler approach than running a full Dramatiq
    worker: it processes the job queue directly by calling actor functions.
    This avoids threading/event loop issues while still testing the
    full task chain execution.

    Usage:
        executor = TaskExecutor(broker, redis)

        # Enqueue jobs as normal
        enqueue_job("subscription.cycle", subscription_id)

        # Process all pending tasks
        await executor.run_pending()
    """

    def __init__(self, broker: StubBroker, redis: Redis) -> None:
        self._broker = broker
        self._redis = redis
        self._max_iterations = 100  # Prevent infinite loops

    async def run_pending(self, timeout: float = 5.0) -> None:
        """
        Process all pending tasks until queues are empty.

        This method:
        1. Flushes the JobQueueManager by sending messages directly to StubBroker
        2. Processes messages by calling actor functions directly
        3. Repeats until no more messages are pending

        Args:
            timeout: Maximum time in seconds to wait for tasks to complete
        """
        iteration = 0
        while iteration < self._max_iterations:
            iteration += 1

            # Flush any pending jobs by sending to StubBroker directly
            # (JobQueueManager.flush() writes to Redis which StubBroker doesn't read)
            await self._flush_jobs_to_broker()

            # Process all messages in all queues
            processed = await self._process_all_queues()
            if not processed:
                # No more messages to process
                break

        if iteration >= self._max_iterations:
            log.warning(
                "TaskExecutor reached max iterations",
                max_iterations=self._max_iterations,
            )

    async def _flush_jobs_to_broker(self) -> None:
        """
        Flush pending jobs from JobQueueManager directly to the StubBroker.

        This bypasses Redis and sends messages directly to the broker's queues.
        """
        try:
            job_queue_manager = JobQueueManager.get()
        except RuntimeError:
            return

        # Get the pending jobs and clear them
        pending_jobs = list(job_queue_manager._enqueued_jobs)
        job_queue_manager._enqueued_jobs = []

        for actor_name, args, kwargs, delay in pending_jobs:
            try:
                actor = self._broker.get_actor(actor_name)
                # Create and send message directly to StubBroker
                message = actor.message(*args, **kwargs)
                self._broker.enqueue(message)
                log.debug(
                    "Flushed job to broker",
                    actor_name=actor_name,
                    args=args,
                )
            except dramatiq.ActorNotFound:
                log.warning("Actor not found during flush", actor_name=actor_name)

    async def _process_all_queues(self) -> bool:
        """
        Process one message from each queue.

        Returns True if any message was processed.
        """
        processed_any = False
        queues = list(self._broker.get_declared_queues())

        for queue_name in queues:
            # Skip delay queues
            if queue_name.endswith(".DQ"):
                continue

            # Try to consume a message from this queue
            try:
                consumer = self._broker.consume(queue_name)
                message = next(consumer, None)
                if message is not None:
                    await self._process_message(message)
                    processed_any = True
            except Exception as e:
                log.warning("Error consuming from queue", queue=queue_name, error=str(e))

        return processed_any

    async def _process_message(self, message: dramatiq.Message[Any]) -> None:
        """
        Process a single message by calling the original async function directly.

        The Dramatiq @actor decorator wraps async functions in a sync wrapper
        that uses get_event_loop_thread(). We bypass this by calling the
        original async function directly via __wrapped__.
        """
        actor_name = message.actor_name
        args = message.args
        kwargs = message.kwargs

        log.debug(
            "Processing message",
            actor_name=actor_name,
            args=args,
            kwargs=kwargs,
        )

        # Get the actor from the broker
        try:
            actor = self._broker.get_actor(actor_name)
        except dramatiq.ActorNotFound:
            log.warning("Actor not found", actor_name=actor_name)
            return

        # Get the original async function, unwrapping multiple layers:
        # 1. Dramatiq's async wrapper (stores original in __wrapped__)
        # 2. Polar's @actor decorator wrapper (_wrapped_fn with JobQueueManager.open)
        #
        # We need to call the innermost function to avoid double-wrapping with
        # JobQueueManager, since we use TestJobQueueManager.open_for_test() already.
        fn = actor.fn

        # First unwrap: Dramatiq's async wrapper -> Polar's _wrapped_fn
        wrapped_fn = getattr(fn, "__wrapped__", fn)

        # Second unwrap: Polar's _wrapped_fn -> original async function
        # The @actor decorator uses @functools.wraps which sets __wrapped__
        original_fn = getattr(wrapped_fn, "__wrapped__", wrapped_fn)

        # Convert UUID strings back to UUID objects for common task patterns
        processed_args = []
        for arg in args:
            if isinstance(arg, str):
                try:
                    processed_args.append(uuid.UUID(arg))
                except ValueError:
                    processed_args.append(arg)
            else:
                processed_args.append(arg)

        try:
            # Call the original async function directly, wrapped in TestJobQueueManager
            # This mimics the behavior of the @actor decorator which wraps tasks
            # with JobQueueManager.open() to flush enqueued jobs after completion.
            # We use TestJobQueueManager which sends directly to StubBroker.
            import inspect

            async with TestJobQueueManager.open_for_test(self._broker, self._redis):
                if inspect.iscoroutinefunction(original_fn):
                    await original_fn(*processed_args, **kwargs)
                elif asyncio.iscoroutinefunction(original_fn):
                    await original_fn(*processed_args, **kwargs)
                else:
                    # Sync function (shouldn't happen for our tasks but handle it)
                    original_fn(*processed_args, **kwargs)
        except Exception as e:
            log.error(
                "Task execution failed",
                actor_name=actor_name,
                error=str(e),
                exc_info=True,
            )
