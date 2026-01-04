import contextlib
import functools
from collections.abc import Awaitable, Callable
from enum import IntEnum
from typing import Any, ParamSpec

import dramatiq
import logfire
import redis
import structlog
from apscheduler.triggers.cron import CronTrigger
from dramatiq import actor as _actor
from dramatiq import middleware
from dramatiq.brokers.redis import RedisBroker

from polar.config import settings
from polar.logfire import instrument_httpx

# Import metrics FIRST to set PROMETHEUS_MULTIPROC_DIR before prometheus_client is imported
from polar.observability import metrics as _prometheus_metrics

from ._encoder import JSONEncoder
from ._enqueue import (
    BulkJobDelayCalculator,
    JobQueueManager,
    enqueue_events,
    enqueue_job,
    make_bulk_job_delay_calculator,
)
from ._health import HealthMiddleware
from ._httpx import HTTPXMiddleware
from ._memory import MemoryMonitorMiddleware
from ._metrics import PrometheusMiddleware
from ._redis import RedisMiddleware
from ._sqlalchemy import AsyncSessionMaker, SQLAlchemyMiddleware

_ = _prometheus_metrics  # for mypy and ruff: ensure import is used


class MaxRetriesMiddleware(dramatiq.Middleware):
    """Middleware to set the max_retries option for a message."""

    def before_process_message(
        self, broker: dramatiq.Broker, message: dramatiq.MessageProxy
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


class LogContextMiddleware(dramatiq.Middleware):
    """Middleware to manage log context for each message."""

    def before_process_message(
        self, broker: dramatiq.Broker, message: dramatiq.MessageProxy
    ) -> None:
        structlog.contextvars.bind_contextvars(
            actor_name=message.actor_name, message_id=message.message_id
        )

    def after_process_message(
        self,
        broker: dramatiq.Broker,
        message: dramatiq.MessageProxy,
        *,
        result: Any | None = None,
        exception: BaseException | None = None,
    ) -> None:
        structlog.contextvars.unbind_contextvars("actor_name", "message_id")

    def after_skip_message(
        self, broker: dramatiq.Broker, message: dramatiq.MessageProxy
    ) -> None:
        return self.after_process_message(broker, message)


class LogfireMiddleware(dramatiq.Middleware):
    """Middleware to manage a Logfire span when handling a message."""

    def before_worker_boot(
        self, broker: dramatiq.Broker, worker: dramatiq.Worker
    ) -> None:
        instrument_httpx()

    def before_process_message(
        self, broker: dramatiq.Broker, message: dramatiq.MessageProxy
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
        message: dramatiq.MessageProxy,
        *,
        result: Any | None = None,
        exception: BaseException | None = None,
    ) -> None:
        logfire_stack: contextlib.ExitStack | None = message.options.pop(
            "logfire_stack", None
        )
        if logfire_stack is not None:
            logfire_stack.close()

    def after_skip_message(
        self, broker: dramatiq.Broker, message: dramatiq.MessageProxy
    ) -> None:
        return self.after_process_message(broker, message)


broker = RedisBroker(
    connection_pool=redis.ConnectionPool.from_url(
        settings.redis_url,
        client_name=f"{settings.ENV.value}.worker.dramatiq",
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
    dead_message_ttl=3600 * 1000,  # 1 hour in milliseconds
)

broker.add_middleware(
    middleware.Retries(
        max_retries=settings.WORKER_MAX_RETRIES,
        min_backoff=settings.WORKER_MIN_BACKOFF_MILLISECONDS,
    )
)
broker.add_middleware(MemoryMonitorMiddleware())
broker.add_middleware(HealthMiddleware())
broker.add_middleware(middleware.AsyncIO())
broker.add_middleware(middleware.CurrentMessage())
broker.add_middleware(MaxRetriesMiddleware())
broker.add_middleware(SQLAlchemyMiddleware())
broker.add_middleware(RedisMiddleware())
broker.add_middleware(HTTPXMiddleware())
broker.add_middleware(scheduler_middleware)
broker.add_middleware(LogfireMiddleware())
broker.add_middleware(LogContextMiddleware())
broker.add_middleware(PrometheusMiddleware())
dramatiq.set_broker(broker)
dramatiq.set_encoder(JSONEncoder())


class TaskPriority(IntEnum):
    HIGH = 0
    MEDIUM = 50
    LOW = 100


class TaskQueue:
    HIGH_PRIORITY = "high_priority"
    MEDIUM_PRIORITY = "medium_priority"
    LOW_PRIORITY = "low_priority"


P = ParamSpec("P")


def actor[**P, R](
    actor_class: Callable[..., dramatiq.Actor[Any, Any]] = dramatiq.Actor,
    actor_name: str | None = None,
    queue_name: str | None = None,
    priority: TaskPriority = TaskPriority.LOW,
    broker: dramatiq.Broker | None = None,
    **options: Any,
) -> Callable[[Callable[P, Awaitable[R]]], Callable[P, Awaitable[R]]]:
    if queue_name is None:
        match priority:
            case TaskPriority.LOW:
                queue_name = TaskQueue.LOW_PRIORITY
            case TaskPriority.MEDIUM:
                queue_name = TaskQueue.MEDIUM_PRIORITY
            case TaskPriority.HIGH:
                queue_name = TaskQueue.HIGH_PRIORITY

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
    "AsyncSessionMaker",
    "BulkJobDelayCalculator",
    "CronTrigger",
    "HTTPXMiddleware",
    "JobQueueManager",
    "RedisMiddleware",
    "TaskPriority",
    "TaskQueue",
    "actor",
    "can_retry",
    "enqueue_events",
    "enqueue_job",
    "get_retries",
    "make_bulk_job_delay_calculator",
    "scheduler_middleware",
]
