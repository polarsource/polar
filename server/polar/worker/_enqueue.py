import contextlib
import contextvars
import itertools
import time
import uuid
from collections import defaultdict
from collections.abc import AsyncIterator, Callable, Iterable, Mapping
from typing import Any, Self

import dramatiq
import structlog
from dramatiq.common import dq_name

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


type BulkJobDelayCalculator = Callable[[int], int | None]


def make_bulk_job_delay_calculator(
    total_count: int,
    *,
    target_delay_ms: int = 200,
    min_delay_ms: int = 50,
    max_spread_ms: int = 300_000,
    allow_spill: bool = True,
) -> BulkJobDelayCalculator:
    """Create a delay calculator for bulk job spreading.

    When enqueueing many jobs at once (e.g., granting benefits to all customers
    of a product), this function returns a calculator that computes the appropriate
    delay for each job to spread them out over time and prevent queue saturation.

    The delay logic:
    1. If count * target_delay <= max_spread: use target_delay (200ms)
    2. If calculated delay >= min_delay: compress to fit in max_spread
    3. If calculated delay < min_delay:
       - allow_spill=True: use min_delay, accepting that total time exceeds max_spread
       - allow_spill=False: batch items together to stay within max_spread

    Args:
        total_count: The total number of items in the batch.
        target_delay_ms: Target delay between jobs in milliseconds (default: 200).
        min_delay_ms: Minimum delay floor in milliseconds (default: 50).
        max_spread_ms: Maximum total spread time in milliseconds (default: 300,000 = 5 minutes).
        allow_spill: If True, respects min_delay even if total time exceeds max_spread.
            If False, batches items together to stay within max_spread (default: True).

    Returns:
        A function that takes an index and returns the delay in milliseconds,
        or None if no delay is needed (first item).
    """

    def linear_calculator(delay_per_item: int) -> BulkJobDelayCalculator:
        def calculate_delay(index: int) -> int | None:
            delay = index * delay_per_item
            return delay or None

        return calculate_delay

    if total_count * target_delay_ms <= max_spread_ms:
        return linear_calculator(target_delay_ms)

    compressed_delay = max_spread_ms // total_count

    if compressed_delay >= min_delay_ms:
        return linear_calculator(compressed_delay)

    if allow_spill:
        return linear_calculator(min_delay_ms)

    # Batch items to stay within max_spread, using all available slots
    # Extra items go to earlier batches: 17 items / 5 slots = 4-4-3-3-3
    num_slots = (max_spread_ms // min_delay_ms) + 1  # +1 for the zero-delay slot
    base_slot_size = total_count // num_slots
    spill_slot_size = base_slot_size + 1

    num_spill_slots = total_count % num_slots
    spill_slot_switch_index = num_spill_slots * spill_slot_size

    def calculate_delay_batched(index: int) -> int | None:
        if index < spill_slot_switch_index:
            slot = index // spill_slot_size
        else:
            slot = num_spill_slots + (index - spill_slot_switch_index) // base_slot_size
        delay = slot * min_delay_ms
        return delay or None

    return calculate_delay_batched
