import contextlib
import contextvars
import json
import uuid
from collections.abc import AsyncIterator, Awaitable, Callable, Mapping, Sequence
from enum import IntEnum
from typing import Any, ParamSpec, TypeAlias, TypeVar

import dramatiq
import logfire
import redis
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
from polar.postgres import AsyncEngine, AsyncSession, create_async_engine
from polar.redis import Redis, create_redis

log: Logger = structlog.get_logger()

_sqlalchemy_engine: AsyncEngine | None = None
_sqlalchemy_async_sessionmaker: AsyncSessionMakerType | None = None


async def dispose_sqlalchemy_engine() -> None:
    global _sqlalchemy_engine
    if _sqlalchemy_engine is not None:
        await _sqlalchemy_engine.dispose()
        log.info("Disposed SQLAlchemy engine")
        _sqlalchemy_engine = None


class SQLAlchemyMiddleware(dramatiq.Middleware):
    """
    Middleware managing the lifecycle of the database engine and sessionmaker.
    """

    @classmethod
    def get_async_session(cls) -> contextlib.AbstractAsyncContextManager[AsyncSession]:
        global _sqlalchemy_async_sessionmaker
        if _sqlalchemy_async_sessionmaker is None:
            raise RuntimeError("SQLAlchemy not initialized")
        return _sqlalchemy_async_sessionmaker()

    def before_worker_boot(
        self, broker: dramatiq.Broker, worker: dramatiq.Worker
    ) -> None:
        global _sqlalchemy_engine, _sqlalchemy_async_sessionmaker
        _sqlalchemy_engine = create_async_engine("worker")
        _sqlalchemy_async_sessionmaker = create_async_sessionmaker(_sqlalchemy_engine)
        instrument_sqlalchemy(_sqlalchemy_engine.sync_engine)
        log.info("Created database engine")

    def after_worker_shutdown(
        self, broker: dramatiq.Broker, worker: dramatiq.Worker
    ) -> None:
        event_loop_thread = get_event_loop_thread()
        assert event_loop_thread is not None
        event_loop_thread.run_coroutine(dispose_sqlalchemy_engine())


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


_redis: Redis | None = None


async def _close_redis() -> None:
    global _redis
    if _redis is not None:
        await _redis.close(True)
        log.info("Closed Redis client")
        _redis = None


class RedisMiddleware(dramatiq.Middleware):
    """
    Middleware managing the lifecycle of the Redis connection.
    """

    @classmethod
    def get(cls) -> Redis:
        global _redis
        if _redis is None:
            raise RuntimeError("Redis not initialized")
        return _redis

    def before_worker_boot(
        self, broker: dramatiq.Broker, worker: dramatiq.Worker
    ) -> None:
        global _redis
        _redis = create_redis("worker")
        log.info("Created Redis client")

    def after_worker_shutdown(
        self, broker: dramatiq.Broker, worker: dramatiq.Worker
    ) -> None:
        event_loop_thread = get_event_loop_thread()
        assert event_loop_thread is not None
        event_loop_thread.run_coroutine(_close_redis())


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


_job_queue_manager: contextvars.ContextVar[JobQueueManager] = contextvars.ContextVar(
    "polar.job_queue_manager"
)


def set_job_queue_manager() -> None:
    _job_queue_manager.set(JobQueueManager())


def get_job_queue_manager() -> JobQueueManager:
    return _job_queue_manager.get()


def enqueue_job(
    actor: str, *args: JSONSerializable, **kwargs: JSONSerializable
) -> None:
    """Enqueue a job by actor name."""
    job_queue_manager = get_job_queue_manager()
    job_queue_manager.enqueue_job(actor, *args, **kwargs)


def enqueue_events(*event_ids: uuid.UUID) -> None:
    """Enqueue events to be ingested."""
    job_queue_manager = get_job_queue_manager()
    job_queue_manager.enqueue_events(*event_ids)


async def flush_enqueued_jobs(broker: dramatiq.Broker, redis: Redis) -> None:
    """Flush enqueued jobs to Redis."""
    job_queue_manager = get_job_queue_manager()
    await job_queue_manager.flush(broker, redis)


class JobQueueMiddleware(dramatiq.Middleware):
    def before_process_message(
        self, broker: dramatiq.Broker, message: dramatiq.Message[Any]
    ) -> None:
        set_job_queue_manager()

    def after_process_message(
        self,
        broker: dramatiq.Broker,
        message: dramatiq.Message[Any],
        *,
        result: Any | None = None,
        exception: Exception | None = None,
    ) -> None:
        job_queue_manager = get_job_queue_manager()
        if not settings.is_testing() and exception is None:
            redis = RedisMiddleware.get()
            event_loop_thread = get_event_loop_thread()
            assert event_loop_thread is not None
            event_loop_thread.run_coroutine(job_queue_manager.flush(broker, redis))
        job_queue_manager.reset()

    def after_skip_message(
        self, broker: dramatiq.Broker, message: dramatiq.Message[Any]
    ) -> None:
        job_queue_manager = get_job_queue_manager()
        job_queue_manager.reset()


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

    def before_worker_boot(
        self, broker: dramatiq.Broker, worker: dramatiq.Worker
    ) -> None:
        instrument_httpx()

    def before_process_message(
        self, broker: dramatiq.Broker, message: dramatiq.Message[Any]
    ) -> None:
        logfire_stack = contextlib.ExitStack()
        actor_name = message.actor_name
        if actor_name in settings.LOGFIRE_IGNORED_ACTORS:
            logfire_span = logfire_stack.enter_context(
                logfire.suppress_instrumentation()
            )
        else:
            logfire_span = logfire_stack.enter_context(
                logfire.span("TASK {actor}", actor=actor_name, message=message.asdict())
            )
        message.options["logfire_stack"] = logfire_stack

    def after_process_message(
        self,
        broker: dramatiq.Broker,
        message: dramatiq.Message[Any],
        *,
        result: Any | None = None,
        exception: Exception | None = None,
    ) -> None:
        logfire_stack: contextlib.ExitStack | None = message.options.pop(
            "logfire_stack", None
        )
        if logfire_stack is not None:
            logfire_stack.close()

    def after_skip_message(
        self, broker: dramatiq.Broker, message: dramatiq.Message[Any]
    ) -> None:
        return self.after_process_message(broker, message)


def _json_obj_serializer(obj: Any) -> Any:
    if isinstance(obj, uuid.UUID):
        return str(obj)
    raise TypeError(f"Object of type {type(obj)} is not JSON serializable")


class JSONEncoder(dramatiq.JSONEncoder):
    def encode(self, data: dict[str, Any]) -> bytes:
        return json.dumps(
            data, separators=(",", ":"), default=_json_obj_serializer
        ).encode("utf-8")


broker = RedisBroker(
    connection_pool=redis.ConnectionPool.from_url(
        settings.redis_url,
        client_name=f"{settings.ENV.value}.worker.dramatiq",
    ),
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
broker.add_middleware(JobQueueMiddleware())
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
