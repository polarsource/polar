import dramatiq
import structlog
from dramatiq.asyncio import get_event_loop_thread

from polar.logging import Logger
from polar.redis import Redis, create_redis

log: Logger = structlog.get_logger()


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
