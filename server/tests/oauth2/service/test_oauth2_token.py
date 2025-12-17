from unittest.mock import MagicMock

import pytest
from pytest_mock import MockerFixture

from polar.enums import TokenType
from polar.models import OAuth2Client, Organization, User, UserOrganization
from polar.oauth2.service.oauth2_token import oauth2_token as oauth2_token_service
from polar.postgres import AsyncSession
from tests.fixtures.database import SaveFixture

from ..conftest import create_oauth2_token


@pytest.fixture(autouse=True)
def enqueue_email_mock(mocker: MockerFixture) -> MagicMock:
    return mocker.patch(
        "polar.oauth2.service.oauth2_token.enqueue_email", autospec=True
    )


@pytest.mark.asyncio
class TestRevokeLeaked:
    @pytest.mark.parametrize(
        ("token", "token_type"),
        [
            ("polar_at_u_123", TokenType.access_token),
            ("polar_rt_u_123", TokenType.refresh_token),
            ("polar_at_o_123", TokenType.access_token),
            ("polar_rt_o_123", TokenType.refresh_token),
        ],
    )
    async def test_false_positive(
        self,
        token: str,
        token_type: TokenType,
        session: AsyncSession,
        enqueue_email_mock: MagicMock,
    ) -> None:
        result = await oauth2_token_service.revoke_leaked(
            session, token, token_type, notifier="github", url="https://github.com"
        )
        assert result is False

        enqueue_email_mock.assert_not_called()

    @pytest.mark.parametrize(
        ("token", "token_type"),
        [
            ("polar_at_u_123", TokenType.access_token),
            ("polar_rt_u_123", TokenType.refresh_token),
        ],
    )
    async def test_true_positive_user(
        self,
        token: str,
        token_type: TokenType,
        save_fixture: SaveFixture,
        session: AsyncSession,
        oauth2_client: OAuth2Client,
        user: User,
        enqueue_email_mock: MagicMock,
    ) -> None:
        oauth2_token = await create_oauth2_token(
            save_fixture,
            client=oauth2_client,
            access_token="polar_at_u_123",
            refresh_token="polar_rt_u_123",
            scopes=["openid"],
            user=user,
        )

        result = await oauth2_token_service.revoke_leaked(
            session, token, token_type, notifier="github", url="https://github.com"
        )
        assert result is True

        assert oauth2_token.access_token_revoked_at is not None
        assert oauth2_token.refresh_token_revoked_at is not None

        enqueue_email_mock.assert_called_once()

    @pytest.mark.parametrize(
        ("token", "token_type"),
        [
            ("polar_at_o_123", TokenType.access_token),
            ("polar_rt_o_123", TokenType.refresh_token),
        ],
    )
    async def test_true_positive_organization(
        self,
        token: str,
        token_type: TokenType,
        save_fixture: SaveFixture,
        session: AsyncSession,
        oauth2_client: OAuth2Client,
        organization: Organization,
        user_organization: UserOrganization,
        enqueue_email_mock: MagicMock,
    ) -> None:
        oauth2_token = await create_oauth2_token(
            save_fixture,
            client=oauth2_client,
            access_token="polar_at_o_123",
            refresh_token="polar_rt_o_123",
            scopes=["openid"],
            organization=organization,
        )

        result = await oauth2_token_service.revoke_leaked(
            session, token, token_type, notifier="github", url="https://github.com"
        )
        assert result is True

        assert oauth2_token.access_token_revoked_at is not None
        assert oauth2_token.refresh_token_revoked_at is not None

        enqueue_email_mock.assert_called_once()

    async def test_already_revoked(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        oauth2_client: OAuth2Client,
        user: User,
        enqueue_email_mock: MagicMock,
    ) -> None:
        await create_oauth2_token(
            save_fixture,
            client=oauth2_client,
            access_token="polar_at_u_123",
            refresh_token="polar_rt_u_123",
            scopes=["openid"],
            user=user,
            access_token_revoked_at=1,
            refresh_token_revoked_at=1,
        )

        result = await oauth2_token_service.revoke_leaked(
            session, "polar_at_u_123", TokenType.access_token, notifier="github"
        )
        assert result is True

        enqueue_email_mock.assert_not_called()
