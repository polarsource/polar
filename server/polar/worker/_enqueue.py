import contextlib
import contextvars
import itertools
import uuid
from collections import defaultdict
from collections.abc import AsyncIterator, Iterable, Mapping
from typing import Any, Self, TypeAlias

import dramatiq
import structlog

from polar.logging import Logger
from polar.redis import Redis

log: Logger = structlog.get_logger()


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


_job_queue_manager: contextvars.ContextVar["JobQueueManager | None"] = (
    contextvars.ContextVar("polar.job_queue_manager")
)

FLUSH_BATCH_SIZE = 50


class JobQueueManager:
    __slots__ = ("_enqueued_jobs", "_ingested_events")

    def __init__(self) -> None:
        self._enqueued_jobs: list[
            tuple[str, tuple[JSONSerializable, ...], dict[str, JSONSerializable]]
        ] = []
        self._ingested_events: list[uuid.UUID] = []

    def enqueue_job(
        self, actor: str, *args: JSONSerializable, **kwargs: JSONSerializable
    ) -> None:
        self._enqueued_jobs.append((actor, args, kwargs))
        log.debug("polar.worker.job_enqueued", actor=actor)

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

        for actor_name, args, kwargs in self._enqueued_jobs:
            fn: dramatiq.Actor[Any, Any] = broker.get_actor(actor_name)
            redis_message_id = str(uuid.uuid4())
            message = fn.message_with_options(
                args=args, kwargs=kwargs, redis_message_id=redis_message_id
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
    actor: str, *args: JSONSerializable, **kwargs: JSONSerializable
) -> None:
    """Enqueue a job by actor name."""
    job_queue_manager = JobQueueManager.get()
    job_queue_manager.enqueue_job(actor, *args, **kwargs)


def enqueue_events(*event_ids: uuid.UUID) -> None:
    """Enqueue events to be ingested."""
    job_queue_manager = JobQueueManager.get()
    job_queue_manager.enqueue_events(*event_ids)
