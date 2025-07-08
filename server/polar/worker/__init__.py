import contextlib
import functools
from collections.abc import Awaitable, Callable
from enum import IntEnum
from typing import Any, ParamSpec, TypeVar

import dramatiq
import logfire
import redis
from apscheduler.triggers.cron import CronTrigger
from dramatiq import actor as _actor
from dramatiq import middleware
from dramatiq.brokers.redis import RedisBroker

from polar.config import settings
from polar.logfire import instrument_httpx

from ._encoder import JSONEncoder
from ._enqueue import JobQueueManager, enqueue_events, enqueue_job
from ._health import HealthMiddleware
from ._redis import RedisMiddleware
from ._sqlalchemy import AsyncSessionMaker, SQLAlchemyMiddleware


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


broker = RedisBroker(
    connection_pool=redis.ConnectionPool.from_url(
        settings.redis_url,
        client_name=f"{settings.ENV.value}.worker.dramatiq",
        max_connections=settings.REDIS_BROKER_CONNECTIONS_LIMIT,
    ),
    # Override default middlewares
    middleware=[
        m()
        for m in (
            middleware.AgeLimit,
            middleware.TimeLimit,
            middleware.ShutdownNotifications,
        )
    ],
)

broker.add_middleware(
    middleware.Retries(
        max_retries=settings.WORKER_MAX_RETRIES,
        min_backoff=settings.WORKER_MIN_BACKOFF_MILLISECONDS,
    )
)
broker.add_middleware(HealthMiddleware())
broker.add_middleware(middleware.AsyncIO())
broker.add_middleware(middleware.CurrentMessage())
broker.add_middleware(MaxRetriesMiddleware())
broker.add_middleware(SQLAlchemyMiddleware())
broker.add_middleware(RedisMiddleware())
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
        @functools.wraps(fn)
        async def _wrapped_fn(*args: P.args, **kwargs: P.kwargs) -> R:
            async with JobQueueManager.open(
                dramatiq.get_broker(), RedisMiddleware.get()
            ):
                return await fn(*args, **kwargs)

        _actor(
            _wrapped_fn,  # type: ignore
            actor_class=actor_class,
            actor_name=actor_name,
            queue_name=queue_name,
            priority=priority,
            broker=broker,
            **options,
        )

        return _wrapped_fn

    return decorator


__all__ = [
    "actor",
    "CronTrigger",
    "AsyncSessionMaker",
    "RedisMiddleware",
    "JobQueueManager",
    "scheduler_middleware",
    "enqueue_job",
    "enqueue_events",
    "get_retries",
    "can_retry",
]
