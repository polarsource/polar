import contextlib
from collections.abc import Callable
from typing import Any

import dramatiq
import logfire
import redis
import structlog
from apscheduler.triggers.cron import CronTrigger
from dramatiq import middleware
from dramatiq.brokers.redis import RedisBroker

from polar.config import settings
from polar.logfire import instrument_httpx
from polar.logging import Logger

from ._debounce import DebounceMiddleware
from ._health import HealthMiddleware
from ._httpx import HTTPXMiddleware
from ._memory import MemoryMonitorMiddleware
from ._metrics import PrometheusMiddleware
from ._redis import RedisMiddleware
from ._sqlalchemy import SQLAlchemyMiddleware

log: Logger = structlog.get_logger()


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

    @property
    def ephemeral_options(self) -> set[str]:
        return {"logfire_stack"}

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


def get_broker() -> dramatiq.Broker:
    redis_pool = redis.ConnectionPool.from_url(
        settings.redis_url,
        client_name=f"{settings.ENV.value}.worker.dramatiq",
    )
    broker = RedisBroker(
        connection_pool=redis_pool,
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
    broker.add_middleware(DebounceMiddleware(redis_pool))
    broker.add_middleware(PrometheusMiddleware())

    return broker


__all__ = [
    "get_broker",
    "scheduler_middleware",
]
