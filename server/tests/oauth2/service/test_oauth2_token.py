import time
from unittest.mock import MagicMock

import pytest
from pytest_mock import MockerFixture

from polar.email.schemas import OAuth2LeakedTokenEmail
from polar.enums import TokenType
from polar.models import OAuth2Client, OAuth2Token, Organization, User, UserOrganization
from polar.oauth2.service.oauth2_token import oauth2_token as oauth2_token_service
from polar.postgres import AsyncSession
from tests.fixtures.database import SaveFixture

from ..conftest import create_oauth2_token


@pytest.fixture(autouse=True)
def enqueue_email_mock(mocker: MockerFixture) -> MagicMock:
    return mocker.patch(
        "polar.oauth2.service.oauth2_token.enqueue_email_template", autospec=True
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
        assert isinstance(enqueue_email_mock.call_args[0][0], OAuth2LeakedTokenEmail)

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
        assert isinstance(enqueue_email_mock.call_args[0][0], OAuth2LeakedTokenEmail)

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


@pytest.mark.asyncio
class TestGetByAccessToken:
    async def test_unknown_token(self, session: AsyncSession) -> None:
        result = await oauth2_token_service.get_by_access_token(
            session, "polar_at_u_unknown"
        )
        assert result is None

    async def test_valid_token(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        oauth2_client: OAuth2Client,
        user: User,
    ) -> None:
        await create_oauth2_token(
            save_fixture,
            client=oauth2_client,
            access_token="polar_at_u_123",
            refresh_token="polar_rt_u_123",
            scopes=["openid"],
            user=user,
            issued_at=int(time.time()),
            expires_in=3600,
        )

        result = await oauth2_token_service.get_by_access_token(
            session, "polar_at_u_123"
        )
        assert result is not None
        assert result.client_id == oauth2_client.client_id

    async def test_revoked_token(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        oauth2_client: OAuth2Client,
        user: User,
    ) -> None:
        await create_oauth2_token(
            save_fixture,
            client=oauth2_client,
            access_token="polar_at_u_123",
            refresh_token="polar_rt_u_123",
            scopes=["openid"],
            user=user,
            access_token_revoked_at=int(time.time()),
            refresh_token_revoked_at=int(time.time()),
            issued_at=int(time.time()),
            expires_in=3600,
        )

        result = await oauth2_token_service.get_by_access_token(
            session, "polar_at_u_123"
        )
        assert result is None

    async def test_expired_token(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        oauth2_client: OAuth2Client,
        user: User,
    ) -> None:
        await create_oauth2_token(
            save_fixture,
            client=oauth2_client,
            access_token="polar_at_u_123",
            refresh_token="polar_rt_u_123",
            scopes=["openid"],
            user=user,
            issued_at=int(time.time()) - 7200,
            expires_in=3600,
        )

        result = await oauth2_token_service.get_by_access_token(
            session, "polar_at_u_123"
        )
        assert result is None

    async def test_expired_token_app_client(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        oauth2_client: OAuth2Client,
        user: User,
        mocker: MockerFixture,
    ) -> None:
        mocker.patch(
            "polar.oauth2.service.oauth2_token.APP_CLIENT_ID",
            oauth2_client.client_id,
        )

        await create_oauth2_token(
            save_fixture,
            client=oauth2_client,
            access_token="polar_at_u_123",
            refresh_token="polar_rt_u_123",
            scopes=["openid"],
            user=user,
            issued_at=int(time.time()) - 7200,
            expires_in=3600,
        )

        log_mock = mocker.patch("polar.oauth2.service.oauth2_token.log")

        result = await oauth2_token_service.get_by_access_token(
            session, "polar_at_u_123"
        )
        assert result is not None
        assert result.client_id == oauth2_client.client_id
        log_mock.warning.assert_called_once()


@pytest.mark.asyncio
class TestDeleteExpired:
    async def test_deletes_expired_without_refresh_token(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        oauth2_client: OAuth2Client,
        user: User,
    ) -> None:
        expired = await create_oauth2_token(
            save_fixture,
            client=oauth2_client,
            access_token="polar_at_u_expired",
            refresh_token="polar_rt_u_expired",
            scopes=["openid"],
            user=user,
            issued_at=int(time.time()) - 7200,
            expires_in=3600,
        )
        # Simulate a token without a refresh token (e.g. MCP web grant).
        expired.refresh_token = None  # pyright: ignore
        await save_fixture(expired)

        await oauth2_token_service.delete_expired(session)

        deleted = await session.get(OAuth2Token, expired.id)
        assert deleted is None

    async def test_deletes_expired_with_revoked_refresh_token(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        oauth2_client: OAuth2Client,
        user: User,
    ) -> None:
        expired = await create_oauth2_token(
            save_fixture,
            client=oauth2_client,
            access_token="polar_at_u_revoked",
            refresh_token="polar_rt_u_revoked",
            scopes=["openid"],
            user=user,
            issued_at=int(time.time()) - 7200,
            expires_in=3600,
            refresh_token_revoked_at=int(time.time()) - 7200,
        )

        await oauth2_token_service.delete_expired(session)

        deleted = await session.get(OAuth2Token, expired.id)
        assert deleted is None

    async def test_preserves_active_refresh_token(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        oauth2_client: OAuth2Client,
        user: User,
    ) -> None:
        expired = await create_oauth2_token(
            save_fixture,
            client=oauth2_client,
            access_token="polar_at_u_refreshable",
            refresh_token="polar_rt_u_refreshable",
            scopes=["openid"],
            user=user,
            issued_at=int(time.time()) - 7200,
            expires_in=3600,
        )

        await oauth2_token_service.delete_expired(session)

        preserved = await session.get(OAuth2Token, expired.id)
        assert preserved is not None

    async def test_preserves_valid_token(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        oauth2_client: OAuth2Client,
        user: User,
    ) -> None:
        valid = await create_oauth2_token(
            save_fixture,
            client=oauth2_client,
            access_token="polar_at_u_valid",
            refresh_token="polar_rt_u_valid",
            scopes=["openid"],
            user=user,
            issued_at=int(time.time()),
            expires_in=3600,
        )
        valid.refresh_token = None  # pyright: ignore
        await save_fixture(valid)

        await oauth2_token_service.delete_expired(session)

        preserved = await session.get(OAuth2Token, valid.id)
        assert preserved is not None

    async def test_preserves_app_client_tokens(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        oauth2_client: OAuth2Client,
        user: User,
        mocker: MockerFixture,
    ) -> None:
        mocker.patch(
            "polar.oauth2.service.oauth2_token.APP_CLIENT_ID",
            oauth2_client.client_id,
        )

        expired = await create_oauth2_token(
            save_fixture,
            client=oauth2_client,
            access_token="polar_at_u_app",
            refresh_token="polar_rt_u_app",
            scopes=["openid"],
            user=user,
            issued_at=int(time.time()) - 7200,
            expires_in=3600,
        )
        expired.refresh_token = None  # pyright: ignore
        await save_fixture(expired)

        await oauth2_token_service.delete_expired(session)

        preserved = await session.get(OAuth2Token, expired.id)
        assert preserved is not None


@pytest.mark.asyncio
class TestRevokeForSSOEnforcement:
    async def test_revokes_token_scoped_to_org(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        oauth2_client: OAuth2Client,
        user: User,
        organization: Organization,
    ) -> None:
        token = await create_oauth2_token(
            save_fixture,
            client=oauth2_client,
            access_token="polar_at_u_sso1",
            refresh_token="polar_rt_u_sso1",
            scopes=["openid"],
            user=user,
            organizations=[organization],
        )

        await oauth2_token_service.revoke_for_sso_enforcement(session, organization.id)

        await session.refresh(token)
        assert token.access_token_revoked_at
        assert token.refresh_token_revoked_at

    async def test_revokes_token_scoped_to_multiple_orgs(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        oauth2_client: OAuth2Client,
        user: User,
        organization: Organization,
        organization_second: Organization,
    ) -> None:
        # Revoked even though it also covers a non-enforced org.
        token = await create_oauth2_token(
            save_fixture,
            client=oauth2_client,
            access_token="polar_at_u_sso2",
            refresh_token="polar_rt_u_sso2",
            scopes=["openid"],
            user=user,
            organizations=[organization, organization_second],
        )

        await oauth2_token_service.revoke_for_sso_enforcement(session, organization.id)

        await session.refresh(token)
        assert token.access_token_revoked_at

    async def test_ignores_token_scoped_to_other_org(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        oauth2_client: OAuth2Client,
        user: User,
        organization: Organization,
        organization_second: Organization,
    ) -> None:
        token = await create_oauth2_token(
            save_fixture,
            client=oauth2_client,
            access_token="polar_at_u_sso4",
            refresh_token="polar_rt_u_sso4",
            scopes=["openid"],
            user=user,
            organizations=[organization_second],
        )

        await oauth2_token_service.revoke_for_sso_enforcement(session, organization.id)

        await session.refresh(token)
        assert not token.access_token_revoked_at

    async def test_ignores_unrestricted_token(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        oauth2_client: OAuth2Client,
        user: User,
        organization: Organization,
    ) -> None:
        # No org rows == unrestricted; handled at request time, not revoked here.
        token = await create_oauth2_token(
            save_fixture,
            client=oauth2_client,
            access_token="polar_at_u_sso5",
            refresh_token="polar_rt_u_sso5",
            scopes=["openid"],
            user=user,
        )

        await oauth2_token_service.revoke_for_sso_enforcement(session, organization.id)

        await session.refresh(token)
        assert not token.access_token_revoked_at

    async def test_leaves_fully_revoked_token_untouched(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        oauth2_client: OAuth2Client,
        user: User,
        organization: Organization,
    ) -> None:
        token = await create_oauth2_token(
            save_fixture,
            client=oauth2_client,
            access_token="polar_at_u_sso6",
            refresh_token="polar_rt_u_sso6",
            scopes=["openid"],
            user=user,
            organizations=[organization],
            access_token_revoked_at=1,
            refresh_token_revoked_at=1,
        )

        await oauth2_token_service.revoke_for_sso_enforcement(session, organization.id)

        await session.refresh(token)
        assert token.access_token_revoked_at == 1
        assert token.refresh_token_revoked_at == 1
