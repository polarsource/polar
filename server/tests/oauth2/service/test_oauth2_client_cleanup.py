from datetime import timedelta

import pytest
from pytest_mock import MockerFixture
from sqlalchemy import select

from polar.config import settings
from polar.kit.db.postgres import AsyncSession
from polar.kit.utils import utc_now
from polar.models import Agent, OAuth2Client, User
from polar.oauth2.repository import OAuth2ClientRepository
from tests.fixtures.database import SaveFixture
from tests.oauth2.conftest import create_oauth2_token


@pytest.mark.anyio
class TestDeleteStale:
    async def test_deletes_only_old_unowned_clients_without_tokens(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        user: User,
        agent: Agent,
        mocker: MockerFixture,
    ) -> None:
        old = utc_now() - timedelta(days=8)
        stale = OAuth2Client(client_id="stale", created_at=old)
        recent = OAuth2Client(client_id="recent", created_at=utc_now())
        user_owned = OAuth2Client(client_id="user-owned", user=user, created_at=old)
        agent_owned = agent.oauth2_client
        agent_owned.created_at = old
        token_client = OAuth2Client(client_id="with-token", created_at=old)
        mcp_client = OAuth2Client(client_id="dashboard-mcp", created_at=old)
        mocker.patch.object(settings, "MCP_OAUTH2_CLIENT_ID", mcp_client.client_id)
        first_party = OAuth2Client(
            client_id="first-party", created_at=old, first_party=True
        )
        preserved = [
            recent,
            user_owned,
            agent_owned,
            token_client,
            mcp_client,
            first_party,
        ]
        for client in [stale, *preserved]:
            await save_fixture(client)
        await create_oauth2_token(
            save_fixture,
            client=token_client,
            access_token="polar_at_u_existing",
            refresh_token=None,
            scopes=["openid"],
            user=user,
        )

        repository = OAuth2ClientRepository.from_session(session)
        cutoff = utc_now()
        assert await repository.count_stale(cutoff) == 1
        assert await repository.delete_stale(cutoff) == 1
        assert await repository.delete_stale(cutoff) == 0

        assert set(await session.scalars(select(OAuth2Client.id))) == {
            client.id for client in preserved
        }
