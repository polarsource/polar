import contextlib
from collections.abc import AsyncIterator
from unittest.mock import AsyncMock

import pytest
from pytest_mock import MockerFixture

from polar.magic_link.service import magic_link as magic_link_service
from polar.magic_link.tasks import magic_link_delete_expired
from polar.postgres import AsyncSession
from polar.worker import JobContext


@pytest.fixture(autouse=True)
def mock_async_session_local(mocker: MockerFixture, session: AsyncSession) -> None:
    """
    Monkey-patch to force `AsyncSessionLocal` to return our test AsyncSession.

    A better way to handle this would be to dynamically inject the session maker
    to the task, probably using the `JobContext`.

    Tasks would need to be updated to use this function from the context
    instead of calling the global `AsyncSessionLocal`.
    """

    @contextlib.asynccontextmanager
    async def _mock_async_session_local() -> AsyncIterator[AsyncSession]:
        yield session

    mocker.patch(
        "polar.magic_link.tasks.AsyncSessionLocal", new=_mock_async_session_local
    )


@pytest.mark.asyncio
async def test_magic_link_delete_expired(
    job_context: JobContext, mocker: MockerFixture
) -> None:
    magic_link_service_send_mock = mocker.patch.object(
        magic_link_service, "delete_expired", new=AsyncMock()
    )

    await magic_link_delete_expired(job_context)

    magic_link_service_send_mock.assert_called_once()
