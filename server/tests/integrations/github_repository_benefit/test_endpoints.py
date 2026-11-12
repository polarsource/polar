from datetime import timedelta
from unittest.mock import AsyncMock, MagicMock
from urllib.parse import parse_qs, urlsplit

import pytest
from httpx import AsyncClient
from httpx_oauth.oauth2 import OAuth2Token
from pytest_mock import MockerFixture

from polar.app import app
from polar.exceptions import Unauthorized
from polar.integrations.github_repository_benefit.endpoints import (
    get_decoded_token_state,
    oauth2_authorize_callback,
)
from polar.kit import jwt
from polar.kit.utils import utc_now
from polar.models import OAuthAccount, User
from polar.models.user import OAuthPlatform
from polar.postgres import AsyncSession
from polar.user.oauth_service import oauth_account_service
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import create_oauth_account


@pytest.mark.anyio
class TestUserCallback:
    @pytest.mark.auth
    async def test_reconnect_same_user_updates_oauth_account(
        self,
        client: AsyncClient,
        session: AsyncSession,
        save_fixture: SaveFixture,
        user: User,
        mocker: MockerFixture,
    ) -> None:
        existing = await create_oauth_account(
            save_fixture, user, OAuthPlatform.github_repository_benefit
        )

        mock_client = MagicMock()
        mock_user_response = MagicMock()
        mock_user_response.parsed_data.id = existing.account_id
        mock_user_response.parsed_data.login = "new-login"
        mock_client.rest.users.async_get_authenticated = AsyncMock(
            return_value=mock_user_response
        )
        mocker.patch(
            "polar.integrations.github.client.get_client",
            return_value=mock_client,
        )
        mocker.patch(
            "polar.integrations.github.client.ensure_expected_response",
        )
        mocker.patch(
            "polar.integrations.github.service.user.github_user.fetch_authenticated_user_primary_email",
            new=AsyncMock(return_value=("new@example.com", True)),
        )

        state = await jwt.encode(
            data={"return_to": "/dashboard/org/products/benefits?create_benefit=true"},
            type="github_repository_benefit_oauth",
        )
        token_data = OAuth2Token(
            {
                "access_token": "new_token",
                "expires_at": 1794409366,
                "refresh_token": "new_refresh",
            }
        )
        app.dependency_overrides[oauth2_authorize_callback] = lambda: (
            token_data,
            state,
        )
        try:
            response = await client.get(
                "/v1/integrations/github_repository_benefit/user/callback",
                follow_redirects=False,
            )
        finally:
            app.dependency_overrides.pop(oauth2_authorize_callback, None)

        assert response.status_code == 303
        location = urlsplit(response.headers["location"])
        assert location.path == "/dashboard/org/products/benefits"
        assert parse_qs(location.query) == {"create_benefit": ["true"]}

        await session.refresh(existing)
        assert existing.account_username == "new-login"
        assert existing.account_email == "new@example.com"
        assert await existing.get_access_token() == "new_token"

    @pytest.mark.auth
    async def test_already_connected_to_another_user_redirects_with_error(
        self,
        client: AsyncClient,
        session: AsyncSession,
        save_fixture: SaveFixture,
        user: User,
        user_second: User,
        mocker: MockerFixture,
    ) -> None:
        existing = await create_oauth_account(
            save_fixture, user_second, OAuthPlatform.github_repository_benefit
        )

        mock_client = MagicMock()
        mock_user_response = MagicMock()
        mock_user_response.parsed_data.id = existing.account_id
        mock_user_response.parsed_data.login = "other-login"
        mock_client.rest.users.async_get_authenticated = AsyncMock(
            return_value=mock_user_response
        )
        mocker.patch(
            "polar.integrations.github.client.get_client",
            return_value=mock_client,
        )
        mocker.patch(
            "polar.integrations.github.client.ensure_expected_response",
        )
        mocker.patch(
            "polar.integrations.github.service.user.github_user.fetch_authenticated_user_primary_email",
            new=AsyncMock(return_value=("other@example.com", True)),
        )

        state = await jwt.encode(
            data={"return_to": "/dashboard/org/products/benefits?create_benefit=true"},
            type="github_repository_benefit_oauth",
        )
        token_data = OAuth2Token(
            {
                "access_token": "new_token",
                "expires_at": 1794409366,
                "refresh_token": "new_refresh",
            }
        )
        app.dependency_overrides[oauth2_authorize_callback] = lambda: (
            token_data,
            state,
        )
        try:
            response = await client.get(
                "/v1/integrations/github_repository_benefit/user/callback",
                follow_redirects=False,
            )
        finally:
            app.dependency_overrides.pop(oauth2_authorize_callback, None)

        assert response.status_code == 303
        location = urlsplit(response.headers["location"])
        assert location.path == "/dashboard/org/products/benefits"
        query = parse_qs(location.query)
        assert query["create_benefit"] == ["true"]
        assert query["toast"] == ["true"]
        assert query["error"] == [
            "This GitHub account is already connected to another Polar user."
        ]

        persisted = await oauth_account_service.get_by_platform_and_account_id(
            session, OAuthPlatform.github_repository_benefit, existing.account_id
        )
        assert persisted is not None
        assert persisted.user_id == user_second.id
        assert user.get_oauth_account(OAuthPlatform.github_repository_benefit) is None

    @pytest.mark.auth
    async def test_reconnect_with_account_owned_by_another_user_preserves_existing_account(
        self,
        client: AsyncClient,
        session: AsyncSession,
        save_fixture: SaveFixture,
        user: User,
        user_second: User,
        mocker: MockerFixture,
    ) -> None:
        user_account = OAuthAccount(
            platform=OAuthPlatform.github_repository_benefit,
            account_id="111111",
            account_email="user@example.com",
            account_username="user-login",
            user=user,
        )
        await user_account.set_tokens(
            access_token="user_token", refresh_token="user_refresh"
        )
        await save_fixture(user_account)

        other_account = OAuthAccount(
            platform=OAuthPlatform.github_repository_benefit,
            account_id="222222",
            account_email="other@example.com",
            account_username="other-login",
            user=user_second,
        )
        await other_account.set_tokens(
            access_token="other_token", refresh_token="other_refresh"
        )
        await save_fixture(other_account)

        mock_client = MagicMock()
        mock_user_response = MagicMock()
        mock_user_response.parsed_data.id = 222222
        mock_user_response.parsed_data.login = "other-login"
        mock_client.rest.users.async_get_authenticated = AsyncMock(
            return_value=mock_user_response
        )
        mocker.patch(
            "polar.integrations.github.client.get_client",
            return_value=mock_client,
        )
        mocker.patch(
            "polar.integrations.github.client.ensure_expected_response",
        )
        mocker.patch(
            "polar.integrations.github.service.user.github_user.fetch_authenticated_user_primary_email",
            new=AsyncMock(return_value=("other@example.com", True)),
        )

        state = await jwt.encode(
            data={"return_to": "/dashboard/org/products/benefits?create_benefit=true"},
            type="github_repository_benefit_oauth",
        )
        token_data = OAuth2Token(
            {
                "access_token": "new_token",
                "expires_at": 1794409366,
                "refresh_token": "new_refresh",
            }
        )
        app.dependency_overrides[oauth2_authorize_callback] = lambda: (
            token_data,
            state,
        )
        try:
            response = await client.get(
                "/v1/integrations/github_repository_benefit/user/callback",
                follow_redirects=False,
            )
        finally:
            app.dependency_overrides.pop(oauth2_authorize_callback, None)

        assert response.status_code == 303
        location = urlsplit(response.headers["location"])
        assert location.path == "/dashboard/org/products/benefits"
        query = parse_qs(location.query)
        assert query["create_benefit"] == ["true"]
        assert query["toast"] == ["true"]
        assert query["error"] == [
            "This GitHub account is already connected to another Polar user."
        ]

        persisted_user_account = (
            await oauth_account_service.get_by_platform_and_account_id(
                session, OAuthPlatform.github_repository_benefit, "111111"
            )
        )
        assert persisted_user_account is not None
        assert persisted_user_account.user_id == user.id
        assert persisted_user_account.account_username == "user-login"
        assert await persisted_user_account.get_access_token() == "user_token"

        persisted_other_account = (
            await oauth_account_service.get_by_platform_and_account_id(
                session, OAuthPlatform.github_repository_benefit, "222222"
            )
        )
        assert persisted_other_account is not None
        assert persisted_other_account.user_id == user_second.id
        assert await persisted_other_account.get_access_token() == "other_token"


@pytest.mark.anyio
class TestGetDecodedTokenState:
    async def test_expired_state_raises_unauthorized(self) -> None:
        expired_state = await jwt.encode(
            data={"return_to": "/"},
            type="github_repository_benefit_oauth",
            expires_at=utc_now() - timedelta(minutes=1),
        )
        token_data = OAuth2Token({"access_token": "ghu_test"})

        with pytest.raises(Unauthorized):
            await get_decoded_token_state((token_data, expired_state))
