from unittest.mock import AsyncMock, MagicMock
from urllib.parse import parse_qs, urlsplit

import pytest
from httpx import AsyncClient
from httpx_oauth.oauth2 import OAuth2Token
from pytest_mock import MockerFixture

from polar.app import app
from polar.integrations.github_repository_benefit.endpoints import (
    oauth2_authorize_callback,
)
from polar.kit import jwt
from polar.models import User
from polar.models.user import OAuthPlatform
from polar.postgres import AsyncSession
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
        save_fixture: SaveFixture,
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
