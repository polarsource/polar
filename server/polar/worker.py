import contextlib
import contextvars
import json
import threading
import uuid
from collections.abc import AsyncIterator, Awaitable, Callable, Mapping, Sequence
from enum import IntEnum
from typing import Any, ParamSpec, TypeAlias, TypeVar

import dramatiq
import logfire
import structlog
from apscheduler.triggers.cron import CronTrigger
from dramatiq import actor as _actor
from dramatiq import middleware
from dramatiq.asyncio import get_event_loop_thread
from dramatiq.brokers.redis import RedisBroker

from polar.config import settings
from polar.kit.db.postgres import AsyncSessionMaker as AsyncSessionMakerType
from polar.kit.db.postgres import create_async_sessionmaker
from polar.logfire import instrument_httpx, instrument_sqlalchemy
from polar.logging import Logger
from polar.postgres import AsyncSession, create_async_engine
from polar.redis import Redis, create_redis

log: Logger = structlog.get_logger()


class SQLAlchemyMiddleware(dramatiq.Middleware):
    """
    Middleware managing the lifecycle of the database engine and sessionmaker.
    """

    _get_async_sessionmaker_context: contextvars.ContextVar[AsyncSessionMakerType] = (
        contextvars.ContextVar("polar.get_async_sessionmaker")
    )

    def __init__(self) -> None:
        self.logger = dramatiq.get_logger(__name__, type(self))

    @classmethod
    def get_async_session(cls) -> contextlib.AbstractAsyncContextManager[AsyncSession]:
        _get_async_session_context = cls._get_async_sessionmaker_context.get()
        return _get_async_session_context()

    def before_worker_boot(
        self, broker: dramatiq.Broker, worker: dramatiq.Worker
    ) -> None:
        self.engine = create_async_engine("worker")
        self.async_sessionmaker = create_async_sessionmaker(self.engine)
        instrument_sqlalchemy(self.engine.sync_engine)
        self.logger.info("Created database engine")

    def after_worker_shutdown(
        self, broker: dramatiq.Broker, worker: dramatiq.Worker
    ) -> None:
        event_loop_thread = get_event_loop_thread()
        assert event_loop_thread is not None
        event_loop_thread.run_coroutine(self._dispose_engine())

    def after_worker_thread_boot(
        self, broker: dramatiq.Broker, thread: threading.Thread
    ) -> None:
        self._get_async_sessionmaker_context.set(self.async_sessionmaker)

    async def _dispose_engine(self) -> None:
        await self.engine.dispose()
        self.logger.info("Database engine disposed")


@contextlib.asynccontextmanager
async def AsyncSessionMaker() -> AsyncIterator[AsyncSession]:
    """
    Context manager to handle a database session taken from the middleware context.
    """
    async with SQLAlchemyMiddleware.get_async_session() as session:
        try:
            yield session
        except:
            await session.rollback()
            raise
        else:
            await session.commit()


class RedisMiddleware(dramatiq.Middleware):
    """
    Middleware managing the lifecycle of the Redis connection.
    """

    _redis_context: contextvars.ContextVar[Redis] = contextvars.ContextVar(
        "polar.redis"
    )

    def __init__(self) -> None:
        self.logger = dramatiq.get_logger(__name__, type(self))
        self._stack = contextlib.AsyncExitStack()

    @classmethod
    def get(cls) -> Redis:
        return cls._redis_context.get()

    def before_worker_boot(
        self, broker: dramatiq.Broker, worker: dramatiq.Worker
    ) -> None:
        event_loop_thread = get_event_loop_thread()
        assert event_loop_thread is not None
        event_loop_thread.run_coroutine(self._open())
        self.logger.info("Opened Redis connection")

    def after_worker_shutdown(
        self, broker: dramatiq.Broker, worker: dramatiq.Worker
    ) -> None:
        event_loop_thread = get_event_loop_thread()
        assert event_loop_thread is not None
        event_loop_thread.run_coroutine(self._close())
        self.logger.info("Closed Redis connection")

    def after_worker_thread_boot(
        self, broker: dramatiq.Broker, thread: threading.Thread
    ) -> None:
        self._redis_context.set(self.redis)

    async def _open(self) -> None:
        self.redis = await self._stack.enter_async_context(create_redis("worker"))

    async def _close(self) -> None:
        await self._stack.aclose()


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
JobToEnqueue: TypeAlias = tuple[
    str, tuple[JSONSerializable, ...], dict[str, JSONSerializable]
]


class EnqueuedJobsMiddleware(dramatiq.Middleware):
    """
    Middleware to enqueue jobs in the current thread,
    and flushing them to Redis when the message is processed.
    """

    _enqueued_jobs = contextvars.ContextVar[list[JobToEnqueue]]("polar.enqueued_jobs")
    _ingested_events = contextvars.ContextVar[list[uuid.UUID]]("polar.ingested_events")

    @classmethod
    def get_enqueued_jobs_context(
        cls,
    ) -> contextvars.ContextVar[list[JobToEnqueue]]:
        return cls._enqueued_jobs

    @classmethod
    def get_ingested_events_context(
        cls,
    ) -> contextvars.ContextVar[list[uuid.UUID]]:
        return cls._ingested_events

    def after_worker_thread_boot(
        self, broker: dramatiq.Broker, thread: threading.Thread
    ) -> None:
        self._enqueued_jobs.set([])
        self._ingested_events.set([])

    def before_process_message(
        self, broker: dramatiq.Broker, message: dramatiq.Message[Any]
    ) -> None:
        enqueued_jobs = self._enqueued_jobs.get([])
        assert enqueued_jobs == [], (
            "Enqueued jobs should be empty before processing a message"
        )
        ingested_events = self._ingested_events.get([])
        assert ingested_events == [], (
            "Ingested events should be empty before processing a message"
        )

    def after_process_message(
        self,
        broker: dramatiq.Broker,
        message: dramatiq.Message[Any],
        *,
        result: Any | None = None,
        exception: Exception | None = None,
    ) -> None:
        current_thread = threading.current_thread()
        if not settings.is_testing() and exception is None:
            redis = RedisMiddleware.get()
            event_loop_thread = get_event_loop_thread()
            assert event_loop_thread is not None
            event_loop_thread.run_coroutine(flush_ingested_events())
            event_loop_thread.run_coroutine(flush_enqueued_jobs(broker, redis))
        self._enqueued_jobs.set([])
        self._ingested_events.set([])


def enqueue_job(
    actor: str, *args: JSONSerializable, **kwargs: JSONSerializable
) -> None:
    """Enqueue a job by actor name."""
    enqueued_jobs_context = EnqueuedJobsMiddleware.get_enqueued_jobs_context()
    enqueued_jobs_list = enqueued_jobs_context.get([])
    enqueued_jobs_list.append((actor, args, kwargs))
    enqueued_jobs_context.set(enqueued_jobs_list)
    log.debug("polar.worker.job_enqueued", actor=actor, args=args, kwargs=kwargs)


async def flush_enqueued_jobs(broker: dramatiq.Broker, redis: Redis) -> None:
    """Flush enqueued jobs to Redis."""
    enqueued_jobs_context = EnqueuedJobsMiddleware.get_enqueued_jobs_context()

    for actor_name, args, kwargs in enqueued_jobs_context.get([]):
        fn: dramatiq.Actor[Any, Any] = broker.get_actor(actor_name)
        message = fn.message_with_options(args=args, kwargs=kwargs)
        redis_message_id = str(uuid.uuid4())
        message = message.copy(options={"redis_message_id": redis_message_id})
        await redis.hset(
            f"dramatiq:{message.queue_name}.msgs", redis_message_id, message.encode()
        )
        await redis.rpush(f"dramatiq:{message.queue_name}", redis_message_id)
        log.debug(
            "polar.worker.job_flushed", actor=fn.actor_name, args=args, kwargs=kwargs
        )

    enqueued_jobs_context.set([])


def enqueue_events(*event_ids: uuid.UUID) -> None:
    """Enqueue events to be ingested."""
    ingested_events_context = EnqueuedJobsMiddleware.get_ingested_events_context()
    ingested_events_list = ingested_events_context.get([])
    ingested_events_list.extend(event_ids)
    ingested_events_context.set(ingested_events_list)


async def flush_ingested_events() -> None:
    """Trigger the `event.ingested` job for all ingested events."""
    ingested_events_context = EnqueuedJobsMiddleware.get_ingested_events_context()
    ingested_events = ingested_events_context.get([])
    if len(ingested_events) > 0:
        enqueue_job("event.ingested", ingested_events)
    ingested_events_context.set([])


class MaxRetriesMiddleware(dramatiq.Middleware):
    """Middleware to set the max_retries option for a message."""

    def before_process_message(
        self, broker: dramatiq.Broker, message: dramatiq.Message[Any]
    ) -> None:
        actor = broker.get_actor(message.actor_name)
        max_retries = message.options.get(
            "max_retries", actor.options.get("max_retries", settings.WORKER_MAX_RETRIES)
        )
        message.options["max_retries"] = max_retries


def get_retries() -> int:
    message = middleware.CurrentMessage.get_current_message()
    assert message is not None
    return message.options.get("retries", 0)


def can_retry() -> bool:
    message = middleware.CurrentMessage.get_current_message()
    assert message is not None
    return get_retries() < message.options["max_retries"]


class SchedulerMiddleware(dramatiq.Middleware):
    """Middleware to manage scheduled jobs using APScheduler."""

    def __init__(self) -> None:
        self.cron_triggers: list[tuple[Callable[..., Any], CronTrigger]] = []

    @property
    def actor_options(self) -> set[str]:
        return {"cron_trigger"}

    def after_declare_actor(
        self, broker: dramatiq.Broker, actor: dramatiq.Actor[Any, Any]
    ) -> None:
        if cron_trigger := actor.options.get("cron_trigger"):
            self.cron_triggers.append((actor.send, cron_trigger))


scheduler_middleware = SchedulerMiddleware()


class LogfireMiddleware(dramatiq.Middleware):
    """Middleware to manage a Logfire span when handling a message."""

    _logfire_span_stack: contextvars.ContextVar[contextlib.ExitStack] = (
        contextvars.ContextVar(
            "polar.logfire_span_stack", default=contextlib.ExitStack()
        )
    )

    def before_worker_boot(
        self, broker: dramatiq.Broker, worker: dramatiq.Worker
    ) -> None:
        instrument_httpx()

    def before_process_message(
        self, broker: dramatiq.Broker, message: dramatiq.Message[Any]
    ) -> None:
        logfire_span_stack = self._logfire_span_stack.get()
        logfire_span = logfire_span_stack.enter_context(
            logfire.span(
                "TASK {actor}", actor=message.actor_name, message=message.asdict()
            )
        )

    def after_process_message(
        self,
        broker: dramatiq.Broker,
        message: dramatiq.Message[Any],
        *,
        result: Any | None = None,
        exception: Exception | None = None,
    ) -> None:
        logfire_span_stack = self._logfire_span_stack.get()
        logfire_span_stack.close()
        self._logfire_span_stack.set(contextlib.ExitStack())


class JSONEncoder(dramatiq.JSONEncoder):
    def encode(self, data: dict[str, Any]) -> bytes:
        def default(obj: Any) -> Any:
            if isinstance(obj, uuid.UUID):
                return str(obj)
            raise TypeError(f"Object of type {type(obj)} is not JSON serializable")

        return json.dumps(data, separators=(",", ":"), default=default).encode("utf-8")


broker = RedisBroker(
    url=settings.redis_url,
    # Override default middlewares
    middleware=[
        m()
        for m in (
            middleware.Prometheus,
            middleware.AgeLimit,
            middleware.TimeLimit,
            middleware.ShutdownNotifications,
            middleware.Callbacks,
            middleware.Pipelines,
        )
    ],
)

broker.add_middleware(
    middleware.Retries(
        max_retries=settings.WORKER_MAX_RETRIES,
        min_backoff=settings.WORKER_MIN_BACKOFF_MILLISECONDS,
    )
)
broker.add_middleware(middleware.AsyncIO())
broker.add_middleware(middleware.CurrentMessage())
broker.add_middleware(MaxRetriesMiddleware())
broker.add_middleware(SQLAlchemyMiddleware())
broker.add_middleware(RedisMiddleware())
broker.add_middleware(EnqueuedJobsMiddleware())
broker.add_middleware(scheduler_middleware)
broker.add_middleware(LogfireMiddleware())
dramatiq.set_broker(broker)
dramatiq.set_encoder(JSONEncoder())


class TaskPriority(IntEnum):
    HIGH = 0
    MEDIUM = 50
    LOW = 100


P = ParamSpec("P")
R = TypeVar("R")


def actor(
    actor_class: Callable[..., dramatiq.Actor[Any, Any]] = dramatiq.Actor,
    actor_name: str | None = None,
    queue_name: str = "default",
    priority: TaskPriority = TaskPriority.LOW,
    broker: dramatiq.Broker | None = None,
    **options: Any,
) -> Callable[[Callable[P, Awaitable[R]]], Callable[P, Awaitable[R]]]:
    def decorator(
        fn: Callable[P, Awaitable[R]],
    ) -> Callable[P, Awaitable[R]]:
        _actor(
            fn,  # type: ignore
            actor_class=actor_class,
            actor_name=actor_name,
            queue_name=queue_name,
            priority=priority,
            broker=broker,
            **options,
        )

        return fn

    return decorator


__all__ = [
    "actor",
    "CronTrigger",
    "AsyncSessionMaker",
    "RedisMiddleware",
    "scheduler_middleware",
    "enqueue_job",
    "flush_enqueued_jobs",
    "get_retries",
    "can_retry",
]
