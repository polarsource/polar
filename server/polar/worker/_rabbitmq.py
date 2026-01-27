import contextlib

import dramatiq
import structlog
from dramatiq.asyncio import get_event_loop_thread

from polar.kit.rabbitmq import RabbitMQConnection, get_rabbitmq
from polar.logging import Logger

log: Logger = structlog.get_logger()


_rabbitmq: RabbitMQConnection | None = None


async def _start() -> tuple[RabbitMQConnection, contextlib.AsyncExitStack]:
    stack = contextlib.AsyncExitStack()
    rabbitmq = await stack.enter_async_context(get_rabbitmq("worker"))
    return rabbitmq, stack


class RabbitMQMiddleware(dramatiq.Middleware):
    """
    Middleware managing the lifecycle of the RabbitMQ connection.
    """

    @property
    def actor_options(self) -> set[str]:
        return {"broker_type"}

    @classmethod
    def get(cls) -> RabbitMQConnection:
        global _rabbitmq
        if _rabbitmq is None:
            raise RuntimeError("RabbitMQ not initialized")
        return _rabbitmq

    def before_worker_boot(
        self, broker: dramatiq.Broker, worker: dramatiq.Worker
    ) -> None:
        global _rabbitmq
        event_loop_thread = get_event_loop_thread()
        assert event_loop_thread is not None
        rabbitmq, stack = event_loop_thread.run_coroutine(_start())
        _rabbitmq = rabbitmq
        self.stack = stack
        log.info("Created RabbitMQ client")

    def after_worker_shutdown(
        self, broker: dramatiq.Broker, worker: dramatiq.Worker
    ) -> None:
        event_loop_thread = get_event_loop_thread()
        assert event_loop_thread is not None
        event_loop_thread.run_coroutine(self.stack.aclose())
        log.info("Closed RabbitMQ client")
