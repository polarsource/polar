from collections.abc import AsyncIterator, Iterator
from typing import Any

import dramatiq
import httpx
import pytest
import pytest_asyncio
from dramatiq.middleware.current_message import CurrentMessage
from pytest_mock import MockerFixture

from polar.config import settings
from polar.kit.db.postgres import AsyncSession
from polar.redis import Redis
from polar.worker import JobQueueManager, RedisMiddleware
from polar.worker._enqueue import _job_queue_manager
from polar.worker._httpx import HTTPXMiddleware
from polar.worker._sqlalchemy import SQLAlchemyMiddleware


@pytest.fixture(autouse=True)
def set_job_queue_manager_context() -> None:
    _job_queue_manager.set(JobQueueManager())


@pytest_asyncio.fixture
async def httpx_client() -> AsyncIterator[httpx.AsyncClient]:
    client = httpx.AsyncClient()
    yield client
    await client.aclose()


@pytest.fixture(autouse=True)
def patch_middlewares(
    mocker: MockerFixture,
    session: AsyncSession,
    redis: Redis,
    httpx_client: httpx.AsyncClient,
) -> None:
    mocker.patch.object(SQLAlchemyMiddleware, "get_async_session", return_value=session)
    mocker.patch.object(RedisMiddleware, "get", return_value=redis)
    mocker.patch.object(HTTPXMiddleware, "get", return_value=httpx_client)


@pytest.fixture(autouse=True)
def current_message() -> Iterator[dramatiq.Message[Any]]:
    message: dramatiq.Message[Any] = dramatiq.Message(
        queue_name="default",
        actor_name="actor",
        args=(),
        kwargs={},
        options={"retries": 0, "max_retries": settings.WORKER_MAX_RETRIES},
    )
    CurrentMessage._MESSAGE.set(message)
    yield message
    CurrentMessage._MESSAGE.set(None)
