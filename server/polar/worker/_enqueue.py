import contextlib
import contextvars
import itertools
import time
import uuid
from collections import defaultdict
from collections.abc import AsyncIterator, Iterable, Mapping
from typing import Any, Self

import dramatiq
import structlog
from dramatiq.common import dq_name

from polar.config import settings
from polar.logging import Logger
from polar.redis import Redis

log: Logger = structlog.get_logger()


type JSONSerializable = (
    Mapping[str, "JSONSerializable"]
    | Iterable["JSONSerializable"]
    | str
    | int
    | float
    | bool
    | uuid.UUID
    | None
)


_job_queue_manager: contextvars.ContextVar["JobQueueManager | None"] = (
    contextvars.ContextVar("polar.job_queue_manager")
)

FLUSH_BATCH_SIZE = 50


class JobQueueManager:
    __slots__ = ("_enqueued_jobs", "_ingested_events")

    def __init__(self) -> None:
        self._enqueued_jobs: list[
            tuple[
                str,
                tuple[JSONSerializable, ...],
                dict[str, JSONSerializable],
                int | None,
            ]
        ] = []
        self._ingested_events: list[uuid.UUID] = []

    def enqueue_job(
        self,
        actor: str,
        *args: JSONSerializable,
        delay: int | None = None,
        **kwargs: JSONSerializable,
    ) -> None:
        self._enqueued_jobs.append((actor, args, kwargs, delay))
        log.debug("polar.worker.job_enqueued", actor=actor, delay=delay)

    def enqueue_events(self, *event_ids: uuid.UUID) -> None:
        self._ingested_events.extend(event_ids)

    async def flush(self, broker: dramatiq.Broker, redis: Redis) -> None:
        if len(self._ingested_events) > 0:
            self.enqueue_job("event.ingested", self._ingested_events)

        if not self._enqueued_jobs:
            self.reset()
            return

        queue_messages = defaultdict[str, list[tuple[str, Any]]](list)
        all_messages: list[tuple[str, Any]] = []

        for actor_name, args, kwargs, delay in self._enqueued_jobs:
            fn: dramatiq.Actor[Any, Any] = broker.get_actor(actor_name)
            redis_message_id = str(uuid.uuid4())

            # Build base message without delay
            message = fn.message_with_options(
                args=args,
                kwargs=kwargs,
                redis_message_id=redis_message_id,
            )

            # Handle delay: convert to eta and use delayed queue
            # See https://github.com/Bogdanp/dramatiq/blob/aa91cdfcfa6d8ad957ca0afe900266617f2661f8/dramatiq/brokers/stub.py#L107-L116
            if delay is not None and delay > 0:
                current_millis = int(time.time() * 1000)
                eta = current_millis + delay
                message = message.copy(
                    queue_name=dq_name(message.queue_name),
                    options={**message.options, "eta": eta},
                )

            encoded_message = message.encode()
            queue_messages[message.queue_name].append(
                (redis_message_id, encoded_message)
            )
            all_messages.append((fn.actor_name, message.encode()))

        for queue_name, messages in queue_messages.items():
            for batch in itertools.batched(messages, FLUSH_BATCH_SIZE):
                await self._batch_hset_messages(redis, queue_name, batch)
                await self._batch_rpush_queue(
                    redis, queue_name, (message_id for message_id, _ in batch)
                )

        for actor_name, encoded_message in all_messages:
            log.debug(
                "polar.worker.job_flushed", actor=actor_name, message=encoded_message
            )

        self.reset()

    async def _batch_hset_messages(
        self,
        redis: Redis,
        queue_name: str,
        message_batch: Iterable[tuple[str, Any]],
    ) -> None:
        """Batch hset operations for message storage."""
        hash_key = f"dramatiq:{queue_name}.msgs"
        await redis.hset(
            hash_key,
            mapping={
                message_id: encoded_message
                for message_id, encoded_message in message_batch
            },
        )

    async def _batch_rpush_queue(
        self, redis: Redis, queue_name: str, message_ids: Iterable[str]
    ) -> None:
        """Batch rpush operations for queue entries."""
        queue_key = f"dramatiq:{queue_name}"
        await redis.rpush(queue_key, *message_ids)

    def reset(self) -> None:
        self._enqueued_jobs = []
        self._ingested_events = []

    @classmethod
    def set(cls) -> "Self":
        job_queue_manager = cls()
        _job_queue_manager.set(job_queue_manager)
        return job_queue_manager

    @classmethod
    def close(cls) -> None:
        job_queue_manager = cls.get()
        job_queue_manager.reset()
        _job_queue_manager.set(None)

    @classmethod
    @contextlib.asynccontextmanager
    async def open(cls, broker: dramatiq.Broker, redis: Redis) -> AsyncIterator["Self"]:
        job_queue_manager = cls.set()
        try:
            yield job_queue_manager
            await job_queue_manager.flush(broker, redis)
        finally:
            cls.close()

    @classmethod
    def get(cls) -> "JobQueueManager":
        job_queue_manager = _job_queue_manager.get()
        if job_queue_manager is None:
            raise RuntimeError("JobQueueManager not initialized")
        return job_queue_manager


def enqueue_job(
    actor: str,
    *args: JSONSerializable,
    delay: int | None = None,
    **kwargs: JSONSerializable,
) -> None:
    """Enqueue a job by actor name.

    Args:
        actor: The name of the actor to enqueue.
        *args: Positional arguments to pass to the actor.
        delay: Optional delay in milliseconds before the job is processed.
        **kwargs: Keyword arguments to pass to the actor.
    """
    job_queue_manager = JobQueueManager.get()
    job_queue_manager.enqueue_job(actor, *args, delay=delay, **kwargs)


def enqueue_events(*event_ids: uuid.UUID) -> None:
    """Enqueue events to be ingested."""
    job_queue_manager = JobQueueManager.get()
    job_queue_manager.enqueue_events(*event_ids)


def calculate_bulk_job_delay(index: int, total_count: int) -> int | None:
    """Calculate delay in milliseconds for bulk job spreading.

    When enqueueing many jobs at once (e.g., granting benefits to all customers
    of a product), this function calculates the appropriate delay for each job
    to spread them out over time and prevent queue saturation.

    The delay logic:
    1. If count <= threshold: no delay
    2. If count * target_delay <= max_spread: use target_delay (200ms)
    3. If calculated delay >= min_delay: compress to fit in max_spread
    4. If calculated delay < min_delay: use min_delay (50ms floor)

    For very large batches (>6000 items), we accept exceeding max_spread
    rather than using sub-50ms delays which would be meaningless.

    Args:
        index: The 0-based index of the current item in the batch.
        total_count: The total number of items in the batch.

    Returns:
        The delay in milliseconds, or None if no delay is needed
        (below threshold or first item).
    """
    if total_count <= settings.BULK_JOBS_SPREAD_THRESHOLD:
        return None
    if index == 0:
        return None

    target_delay_ms = settings.BULK_JOBS_SPREAD_TARGET_DELAY_MS
    min_delay_ms = settings.BULK_JOBS_SPREAD_MIN_DELAY_MS
    max_spread_ms = settings.BULK_JOBS_SPREAD_MAX_MS

    if total_count * target_delay_ms <= max_spread_ms:
        # Use target delay - we fit within max spread
        delay_per_item = target_delay_ms
    else:
        # Compress to fit, but enforce minimum floor
        delay_per_item = max(min_delay_ms, int(max_spread_ms / total_count))

    return int(index * delay_per_item)
