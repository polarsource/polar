from collections.abc import AsyncIterator
from typing import Any

import dramatiq
import pytest
import pytest_asyncio
from dramatiq.middleware.current_message import CurrentMessage

from polar.config import settings
from polar.kit.db.postgres import AsyncSession
from polar.redis import Redis
from polar.worker import RedisMiddleware, SQLAlchemyMiddleware, set_job_queue_manager


@pytest.fixture(autouse=True)
def set_job_queue_manager_context() -> None:
    set_job_queue_manager()


@pytest_asyncio.fixture(autouse=True)
async def set_middleware_context(session: AsyncSession, redis: Redis) -> None:
    SQLAlchemyMiddleware._get_async_sessionmaker_context.set(
        lambda: session,  # type: ignore[arg-type]
    )
    RedisMiddleware._redis_context.set(redis)


@pytest_asyncio.fixture(autouse=True)
async def current_message() -> AsyncIterator[dramatiq.Message[Any]]:
    message = dramatiq.Message[Any](
        queue_name="default",
        actor_name="actor",
        args=(),
        kwargs={},
        options={"retries": 0, "max_retries": settings.WORKER_MAX_RETRIES},
    )
    CurrentMessage._MESSAGE.set(message)
    yield message
    CurrentMessage._MESSAGE.set(None)
