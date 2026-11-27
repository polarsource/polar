import contextlib
from collections.abc import AsyncIterator
from datetime import timedelta

import pytest
from pytest_mock import MockerFixture
from sqlalchemy import select

from polar.kit.utils import utc_now
from polar.models import OAuth2Client
from polar.oauth2.repository import OAuth2ClientRepository
from polar.oauth2.tasks import oauth2_client_delete_stale
from polar.postgres import AsyncSession
from tests.fixtures.database import SaveFixture, save_fixture_factory


@pytest.fixture
def save_fixture(session: AsyncSession) -> SaveFixture:
    return save_fixture_factory(session)


@pytest.fixture(autouse=True)
def task_session(mocker: MockerFixture, session: AsyncSession) -> None:
    @contextlib.asynccontextmanager
    async def session_maker() -> AsyncIterator[AsyncSession]:
        yield session

    mocker.patch("polar.oauth2.tasks.AsyncSessionMaker", side_effect=session_maker)


@pytest.mark.anyio
class TestOAuth2ClientDeleteStale:
    async def test_deletes_stale_clients(
        self, session: AsyncSession, save_fixture: SaveFixture
    ) -> None:
        stale = OAuth2Client(
            client_id="stale", created_at=utc_now() - timedelta(days=8)
        )
        recent = OAuth2Client(client_id="recent", created_at=utc_now())
        await save_fixture(stale)
        await save_fixture(recent)

        await oauth2_client_delete_stale()

        assert set(await session.scalars(select(OAuth2Client.id))) == {recent.id}

    async def test_keeps_batching_until_nothing_is_stale(
        self, mocker: MockerFixture
    ) -> None:
        delete_stale_mock = mocker.patch.object(
            OAuth2ClientRepository, "delete_stale", side_effect=[1000, 1000, 42, 0]
        )

        await oauth2_client_delete_stale()

        assert delete_stale_mock.await_count == 4
