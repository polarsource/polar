import time

import structlog
from sqlalchemy import text

from polar.config import settings
from polar.exceptions import PolarTaskError
from polar.logging import Logger
from polar.worker import AsyncSessionMaker, RedisMiddleware, TaskPriority, actor

log: Logger = structlog.get_logger()


class DummyTaskError(PolarTaskError): ...


@actor(actor_name="dummy", priority=TaskPriority.LOW)
async def dummy_task(*, redis_key: str = "dummy", failure: bool = False) -> None:
    if failure:
        raise RuntimeError("Dummy task failure requested.")

    async with AsyncSessionMaker() as session:
        await session.execute(text("SELECT 1"))

    await RedisMiddleware.get().incr(redis_key)


@actor(actor_name="dummy.blocking_io", priority=TaskPriority.LOW)
async def dummy_blocking_io(*, seconds: float = 30.0) -> None:
    """Reproduce the event loop stall caused by synchronous I/O in an async actor.

    Mirrors `order.confirmation_email`: hold a database session, make a blocking
    call on the event loop thread the way a sync boto3 call does, then persist
    the result. Every other job in the same worker process stops until the
    blocking call returns.

    The two log markers show what a time limit does to this shape. `work_done`
    is emitted synchronously, so it survives. `persisted` sits behind an await,
    which is where cancellation lands, so it does not. The retry then redoes the
    expensive work from scratch.
    """
    if not settings.is_development() and not settings.is_testing():
        raise DummyTaskError("dummy.blocking_io only runs in development.")

    async with AsyncSessionMaker() as session:
        await session.execute(text("SELECT 1"))
        log.info("dummy.blocking_io.start", seconds=seconds)
        time.sleep(seconds)
        log.info("dummy.blocking_io.work_done", seconds=seconds)
        await session.execute(text("SELECT 1"))
        log.info("dummy.blocking_io.persisted", seconds=seconds)
