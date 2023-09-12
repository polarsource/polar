import contextlib
import uuid
from collections.abc import AsyncIterator
from unittest.mock import AsyncMock

import pytest_asyncio
import pytest
from pydantic import EmailStr
from pytest_mock import MockerFixture

from polar.models import MagicLink
from polar.postgres import AsyncSession
from polar.kit.crypto import generate_token
from polar.magic_link.tasks import magic_link_request, MagicLinkNotFoundError
from polar.magic_link.schemas import MagicLinkCreate
from polar.magic_link.service import magic_link as magic_link_service
from polar.config import settings
from polar.worker import JobContext, PolarWorkerContext


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


@pytest_asyncio.fixture
async def magic_link_token(
    session: AsyncSession,
) -> AsyncIterator[tuple[MagicLink, str]]:
    token, token_hash = generate_token(secret=settings.SECRET)
    magic_link_create = MagicLinkCreate(
        token_hash=token_hash,
        user_email=EmailStr("user@example.com"),
    )
    magic_link = await magic_link_service.create(session, magic_link_create)

    yield magic_link, token

    await magic_link.delete(session)


@pytest.mark.asyncio
async def test_request_not_existing_magic_link(
    job_context: JobContext, polar_worker_context: PolarWorkerContext
) -> None:
    with pytest.raises(MagicLinkNotFoundError):
        await magic_link_request(
            job_context, uuid.uuid4(), "TOKEN", polar_worker_context
        )


@pytest.mark.asyncio
async def test_request_existing_magic_link(
    job_context: JobContext,
    polar_worker_context: PolarWorkerContext,
    magic_link_token: tuple[MagicLink, str],
    mocker: MockerFixture,
) -> None:
    magic_link_service_send_mock = mocker.patch.object(
        magic_link_service, "send", new=AsyncMock()
    )

    magic_link, token = magic_link_token
    await magic_link_request(job_context, magic_link.id, token, polar_worker_context)

    magic_link_service_send_mock.assert_called_once_with(magic_link, token)
