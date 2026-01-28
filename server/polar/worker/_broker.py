import contextlib
import contextvars
import gc
import os
from collections.abc import Callable
from enum import StrEnum
from typing import Any, ClassVar, Literal

import dramatiq
import logfire
import pika.credentials
import redis
import structlog
from apscheduler.triggers.cron import CronTrigger
from dramatiq import middleware
from dramatiq.brokers.rabbitmq import RabbitmqBroker
from dramatiq.brokers.redis import RedisBroker

from polar.config import settings
from polar.logfire import instrument_httpx
from polar.logging import Logger

from ._debounce import DebounceMiddleware
from ._health import HealthMiddleware
from ._httpx import HTTPXMiddleware
from ._metrics import PrometheusMiddleware
from ._rabbitmq import RabbitMQMiddleware
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

    gc_span: ClassVar[contextvars.ContextVar[contextlib.ExitStack | None]] = (
        contextvars.ContextVar("gc_span", default=None)
    )

    @property
    def ephemeral_options(self) -> set[str]:
        return {"logfire_stack"}

    def before_worker_boot(
        self, broker: dramatiq.Broker, worker: dramatiq.Worker
    ) -> None:
        instrument_httpx()

        def _gc_callback(phase: Literal["start", "stop"], info: dict[str, Any]) -> None:
            logfire_stack: contextlib.ExitStack | None = None
            if phase == "start":
                logfire_stack = contextlib.ExitStack()
                logfire_stack.enter_context(logfire.span("Garbage collection", **info))
                LogfireMiddleware.gc_span.set(logfire_stack)
            elif phase == "stop":
                logfire_stack = LogfireMiddleware.gc_span.get()
                if logfire_stack is not None:
                    logfire_stack.close()
                    LogfireMiddleware.gc_span.set(None)

        gc.callbacks.append(_gc_callback)

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


class BrokerType(StrEnum):
    REDIS = "redis"
    RABBITMQ = "rabbitmq"

    @classmethod
    def from_env(cls) -> "BrokerType":
        return cls(os.environ.get("POLAR_DRAMATIQ_BROKER", "redis"))


def get_broker(type: BrokerType) -> dramatiq.Broker:
    redis_pool = redis.ConnectionPool.from_url(
        settings.redis_url,
        client_name=f"{settings.ENV.value}.worker.dramatiq",
    )

    middleware_list = [
        # Infrastructure & async support
        middleware.ShutdownNotifications(),
        middleware.AsyncIO(),
        # Resource lifecycle (worker boot/shutdown)
        SQLAlchemyMiddleware(),
        RedisMiddleware(),
        RabbitMQMiddleware(),
        HTTPXMiddleware(),
        HealthMiddleware(),
        scheduler_middleware,
        # Observability (outer layer for message processing)
        LogContextMiddleware(),
        LogfireMiddleware(),
        PrometheusMiddleware(),
        # Message flow control
        DebounceMiddleware(redis_pool),
        # Retry & execution control (MaxRetries must precede Retries)
        MaxRetriesMiddleware(),
        middleware.Retries(
            max_retries=settings.WORKER_MAX_RETRIES,
            min_backoff=settings.WORKER_MIN_BACKOFF_MILLISECONDS,
        ),
        middleware.AgeLimit(),
        middleware.TimeLimit(),
        middleware.CurrentMessage(),
    ]

    match type:
        case BrokerType.REDIS:
            return RedisBroker(
                connection_pool=redis_pool,
                middleware=middleware_list,
                dead_message_ttl=3600 * 1000,  # 1 hour in milliseconds
            )
        case BrokerType.RABBITMQ:
            return RabbitmqBroker(
                host=settings.RABBITMQ_HOST,
                port=settings.RABBITMQ_PORT,
                credentials=pika.credentials.PlainCredentials(
                    username=settings.RABBITMQ_USER, password=settings.RABBITMQ_PWD
                ),
                middleware=middleware_list,
            )


__all__ = [
    "BrokerType",
    "get_broker",
    "scheduler_middleware",
]
