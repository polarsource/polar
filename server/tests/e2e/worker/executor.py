"""
Task executor for E2E tests.

Executes tasks using real Redis as message transport, matching production
behavior for message serialization, JobQueueManager lifecycle, and queue routing.

The only difference from production is that tasks are executed in-process
(not via a separate Dramatiq Worker thread) to avoid async/threading issues.
"""

import inspect

import dramatiq
import structlog
from dramatiq.middleware.current_message import CurrentMessage

from polar.redis import Redis
from polar.worker import JobQueueManager
from polar.worker._queues import TaskQueue

log = structlog.get_logger()

# All queue names used by Polar, including Dramatiq's default
QUEUE_NAMES = [
    "default",
    TaskQueue.HIGH_PRIORITY,
    TaskQueue.MEDIUM_PRIORITY,
    TaskQueue.LOW_PRIORITY,
    TaskQueue.WEBHOOKS,
]


class TaskExecutor:
    """
    Executes pending tasks using real Redis as message transport.

    This executor reads messages from Redis (where JobQueueManager.flush()
    writes them), deserializes them, and calls actor functions directly.

    Each task runs through Polar's @actor wrapper (_wrapped_fn), which
    handles JobQueueManager lifecycle — creating a new JQM, executing the
    task, and flushing any child jobs back to Redis on exit.

    Usage:
        executor = TaskExecutor(redis)

        # API request enqueues jobs as normal via enqueue_job()
        # Then process all pending tasks:
        await executor.run_pending()
    """

    def __init__(self, redis: Redis) -> None:
        self._redis = redis
        self._max_iterations = 100
        self._broker = dramatiq.get_broker()

    async def run_pending(self, timeout: float = 10.0) -> None:
        """
        Process all pending tasks until queues are empty.

        1. Flushes the current JobQueueManager to Redis
        2. Reads messages from Redis queues
        3. Deserializes and executes each message
        4. Repeats until no more messages (tasks can enqueue child tasks)
        """
        # Flush initial jobs (from the API request) to Redis
        await self._flush_initial_jqm()

        iteration = 0
        while iteration < self._max_iterations:
            iteration += 1

            processed = await self._process_all_queues()
            if not processed:
                break

        if iteration >= self._max_iterations:
            log.warning(
                "TaskExecutor reached max iterations",
                max_iterations=self._max_iterations,
            )

    async def _flush_initial_jqm(self) -> None:
        """Flush the initial JobQueueManager (from the API request) to Redis."""
        try:
            jqm = JobQueueManager.get()
        except RuntimeError:
            return

        await jqm.flush(self._broker, self._redis)

    async def _process_all_queues(self) -> bool:
        """
        Process one message from each queue (including delayed queues).

        Returns True if any message was processed.
        """
        processed_any = False

        for queue_name in QUEUE_NAMES:
            # Check main queue
            message = await self._pop_message(queue_name)
            if message is not None:
                await self._process_message(message)
                processed_any = True

            # Check delayed queue (process immediately in tests)
            dq_name = f"{queue_name}.DQ"
            message = await self._pop_message(dq_name)
            if message is not None:
                await self._process_message(message)
                processed_any = True

        return processed_any

    async def _pop_message(self, queue_name: str) -> dramatiq.Message | None:
        """
        Pop a message from a Redis queue using Dramatiq's key patterns.

        Dramatiq stores messages in Redis as:
        - dramatiq:{queue} — list of message IDs (RPUSH on enqueue, LPOP on consume)
        - dramatiq:{queue}.msgs — hash of message_id -> encoded_message
        """
        queue_key = f"dramatiq:{queue_name}"
        message_id = await self._redis.lpop(queue_key)
        if message_id is None:
            return None

        msgs_key = f"dramatiq:{queue_name}.msgs"
        encoded = await self._redis.hget(msgs_key, message_id)
        if encoded is None:
            log.warning(
                "Message ID found in queue but not in msgs hash",
                queue=queue_name,
                message_id=message_id,
            )
            return None

        # Clean up the message from the hash
        await self._redis.hdel(msgs_key, message_id)

        # Deserialize using Dramatiq's encoder (real deserialization round-trip)
        encoder = dramatiq.get_encoder()
        raw = encoded.encode("utf-8") if isinstance(encoded, str) else encoded
        data = encoder.decode(raw)
        return dramatiq.Message(**data)

    async def _process_message(self, message: dramatiq.Message) -> None:
        """
        Process a single message by calling the actor function.

        Calls through Polar's _wrapped_fn (one level of __wrapped__ unwrap
        to skip Dramatiq's sync/thread wrapper, but keep Polar's JQM wrapper).
        This means:
        - JobQueueManager.open() lifecycle is real
        - Child tasks get flushed to Redis naturally
        - Message serialization round-trips are validated
        """
        actor_name = message.actor_name
        args = message.args
        kwargs = message.kwargs

        log.debug(
            "Processing task",
            actor_name=actor_name,
            args=args,
            kwargs=kwargs,
        )

        try:
            actor = self._broker.get_actor(actor_name)
        except dramatiq.ActorNotFound:
            log.warning("Actor not found", actor_name=actor_name)
            return

        # Set CurrentMessage context (normally done by Dramatiq's CurrentMessage
        # middleware). Tasks can access this via CurrentMessage.get_current_message().
        CurrentMessage._MESSAGE.set(message)

        try:
            # actor.fn is Dramatiq's sync wrapper around _wrapped_fn.
            # Unwrap one level to get Polar's _wrapped_fn:
            #
            #   async def _wrapped_fn(*args, **kwargs):
            #       async with JobQueueManager.open(broker, redis):
            #           return await original_fn(*args, **kwargs)
            #
            # This runs the real JQM lifecycle: child jobs get flushed to Redis.
            fn = actor.fn
            wrapped_fn = getattr(fn, "__wrapped__", fn)

            if inspect.iscoroutinefunction(wrapped_fn):
                await wrapped_fn(*args, **kwargs)
            else:
                wrapped_fn(*args, **kwargs)
        except Exception:
            log.exception("Task execution failed", actor_name=actor_name)
            raise
        finally:
            CurrentMessage._MESSAGE.set(None)
