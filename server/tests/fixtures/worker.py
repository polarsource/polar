import contextlib
from collections.abc import AsyncIterator
from typing import cast
from unittest.mock import MagicMock

import pytest
import pytest_asyncio
from arq import ArqRedis

from polar.kit.db.postgres import AsyncSession, AsyncSessionMaker
from polar.kit.utils import utc_now
from polar.postgres import create_async_engine
from polar.redis import Redis
from polar.worker import JobContext, PolarWorkerContext


@pytest_asyncio.fixture
async def job_context(session: AsyncSession, redis: Redis) -> AsyncIterator[JobContext]:
    engine = create_async_engine("worker")

    @contextlib.asynccontextmanager
    async def sessionmaker() -> AsyncIterator[AsyncSession]:
        yield session

    yield {
        "redis": ArqRedis(redis.connection_pool),
        "async_engine": engine,
        "async_sessionmaker": cast(AsyncSessionMaker, sessionmaker),
        "job_id": "fake_job_id",
        "job_try": 1,
        "enqueue_time": utc_now(),
        "score": 0,
        "exit_stack": contextlib.ExitStack(),
        "logfire_span": MagicMock(),
    }

    await engine.dispose()


@pytest.fixture
def polar_worker_context() -> PolarWorkerContext:
    return PolarWorkerContext()
