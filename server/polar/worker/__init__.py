import functools
from collections.abc import Awaitable, Callable
from typing import Any, ParamSpec

import dramatiq
from apscheduler.triggers.cron import CronTrigger
from dramatiq import actor as _actor
from dramatiq import middleware

from polar.config import settings

# Import metrics FIRST to set PROMETHEUS_MULTIPROC_DIR before prometheus_client is imported
from polar.observability import metrics as _prometheus_metrics
from polar.worker._rabbitmq import RabbitMQMiddleware

from ._broker import BrokerType, get_broker
from ._encoder import JSONEncoder
from ._enqueue import (
    BulkJobDelayCalculator,
    JobQueueManager,
    enqueue_events,
    enqueue_job,
    make_bulk_job_delay_calculator,
)
from ._httpx import HTTPXMiddleware
from ._queues import TaskPriority, TaskQueue
from ._redis import RedisMiddleware
from ._sqlalchemy import AsyncSessionMaker

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


broker = get_broker(BrokerType.from_env())
dramatiq.set_broker(broker)
dramatiq.set_encoder(JSONEncoder(broker))


P = ParamSpec("P")


def actor[**P, R](
    actor_class: Callable[..., dramatiq.Actor[Any, Any]] = dramatiq.Actor,
    actor_name: str | None = None,
    queue_name: TaskQueue | None = None,
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
                dramatiq.get_broker(), RedisMiddleware.get(), RabbitMQMiddleware.get()
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
    "BrokerType",
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
]
