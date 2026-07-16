from unittest.mock import AsyncMock

import pytest
from starlette.requests import Request

from polar.exceptions import PolarError
from polar.postgres import get_db_session
from polar.worker import JobQueueManager, enqueue_job


def build_request(session: AsyncMock) -> Request:
    return Request({"type": "http", "state": {"async_session": session}})


@pytest.mark.asyncio
class TestGetDBSession:
    async def test_commit_keeps_buffered_jobs(self) -> None:
        session = AsyncMock()
        generator = get_db_session(build_request(session))
        await anext(generator)
        enqueue_job("test.task")

        with pytest.raises(StopAsyncIteration):
            await anext(generator)

        session.commit.assert_awaited_once()
        assert len(JobQueueManager.get()._enqueued_jobs) == 1

    async def test_rollback_discards_buffered_jobs(self) -> None:
        session = AsyncMock()
        generator = get_db_session(build_request(session))
        await anext(generator)
        enqueue_job("test.task")

        with pytest.raises(PolarError):
            await generator.athrow(PolarError("error"))

        session.rollback.assert_awaited_once()
        assert JobQueueManager.get()._enqueued_jobs == []
