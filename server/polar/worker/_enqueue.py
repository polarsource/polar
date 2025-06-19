import contextlib
import contextvars
import uuid
from collections.abc import AsyncIterator, Mapping, Sequence
from typing import Any, TypeAlias

import dramatiq
import structlog

from polar.logging import Logger
from polar.redis import Redis

log: Logger = structlog.get_logger()


JSONSerializable: TypeAlias = (
    Mapping[str, "JSONSerializable"]
    | Sequence["JSONSerializable"]
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

        for actor_name, args, kwargs in self._enqueued_jobs:
            fn: dramatiq.Actor[Any, Any] = broker.get_actor(actor_name)
            redis_message_id = str(uuid.uuid4())
            message = fn.message_with_options(
                args=args, kwargs=kwargs, redis_message_id=redis_message_id
            )
            await redis.hset(
                f"dramatiq:{message.queue_name}.msgs",
                redis_message_id,
                message.encode(),
            )
            await redis.rpush(f"dramatiq:{message.queue_name}", redis_message_id)
            log.debug(
                "polar.worker.job_flushed",
                actor=fn.actor_name,
                message=message.encode(),
            )

        self.reset()

    def reset(self) -> None:
        self._enqueued_jobs = []
        self._ingested_events = []

    @classmethod
    @contextlib.asynccontextmanager
    async def open(
        cls, broker: dramatiq.Broker, redis: Redis
    ) -> AsyncIterator["JobQueueManager"]:
        job_queue_manager = JobQueueManager()
        _job_queue_manager.set(job_queue_manager)
        try:
            yield job_queue_manager
            await job_queue_manager.flush(broker, redis)
        finally:
            job_queue_manager.reset()
            _job_queue_manager.set(None)

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
