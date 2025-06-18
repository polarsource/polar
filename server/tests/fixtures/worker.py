from collections.abc import Iterator
from typing import Any

import dramatiq
import pytest
from dramatiq.middleware.current_message import CurrentMessage
from pytest_mock import MockerFixture

from polar.config import settings
from polar.kit.db.postgres import AsyncSession
from polar.redis import Redis
from polar.worker import (
    JobQueueManager,
    RedisMiddleware,
    SQLAlchemyMiddleware,
    _job_queue_manager,
)


@pytest.fixture(autouse=True)
def set_job_queue_manager_context() -> None:
    _job_queue_manager.set(JobQueueManager())


@pytest.fixture(autouse=True)
def patch_middlewares(
    mocker: MockerFixture, session: AsyncSession, redis: Redis
) -> None:
    mocker.patch.object(SQLAlchemyMiddleware, "get_async_session", new=lambda: session)
    mocker.patch.object(RedisMiddleware, "get", new=lambda: redis)


@pytest.fixture(autouse=True)
def current_message() -> Iterator[dramatiq.Message[Any]]:
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
