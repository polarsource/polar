from unittest.mock import AsyncMock, MagicMock

import pytest
from githubkit.exception import RequestFailed
from httpx_oauth.oauth2 import OAuth2Token
from pytest_mock import MockerFixture

from polar.exceptions import ResourceAlreadyExists
from polar.integrations.github_repository_benefit.service import (
    github_repository_benefit_user_service,
)
from polar.integrations.github_repository_benefit.types import SimpleUser
from polar.models import OAuthAccount, User
from polar.models.user import OAuthPlatform
from polar.postgres import AsyncSession
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import create_oauth_account


@pytest.mark.anyio
class TestGetBillingPlan:
    async def test_github_exception_logged_with_context(
        self, mocker: MockerFixture
    ) -> None:
        """Test that GitHubException is properly logged with context"""
        # Create mock OAuth account
        oauth = OAuthAccount(
            platform=OAuthPlatform.github_repository_benefit,
            access_token="test_token",
            account_id="12345",
        )

        # Create mock installation
        installation = MagicMock()
        installation.id = 60276577
        installation.target_type = "Organization"
        # Mock the account as a SimpleUser-like object
        mock_account = MagicMock(spec=SimpleUser)
        mock_account.login = "test-org"
        mock_account.id = 123
        installation.account = mock_account

        # Mock redis
        redis = MagicMock()

        # Mock the GitHub client to raise an exception
        mock_client = MagicMock()
        mock_response = AsyncMock()
        mock_response.side_effect = RequestFailed(
            MagicMock(status_code=403, json=lambda: {"message": "Forbidden"})
        )
        mock_client.rest.orgs.async_get = mock_response

        mocker.patch(
            "polar.integrations.github.client.get_app_installation_client",
            return_value=mock_client,
        )

        # Mock the logger to verify it's called with proper context
        mock_log = mocker.patch(
            "polar.integrations.github_repository_benefit.service.log"
        )

        # Call the method
        result = await github_repository_benefit_user_service.get_billing_plan(
            redis, oauth, installation
        )

        # Verify the result still returns an organization object with empty plan
        assert result is not None
        assert result.name == "test-org"
        assert result.is_personal is False
        assert result.plan_name == ""
        assert result.is_free is False

        # Verify log.exception was called with the right context
        assert mock_log.exception.called
        call_kwargs = mock_log.exception.call_args[1]
        assert call_kwargs["installation_id"] == 60276577
        assert call_kwargs["organization"] == "test-org"
        assert call_kwargs["error_type"] == "RequestFailed"

    async def test_unexpected_exception_logged_with_context(
        self, mocker: MockerFixture
    ) -> None:
        """Test that unexpected exceptions are properly logged with context"""
        # Create mock OAuth account
        oauth = OAuthAccount(
            platform=OAuthPlatform.github_repository_benefit,
            access_token="test_token",
            account_id="12345",
        )

        # Create mock installation
        installation = MagicMock()
        installation.id = 60276577
        installation.target_type = "Organization"
        # Mock the account as a SimpleUser-like object
        mock_account = MagicMock(spec=SimpleUser)
        mock_account.login = "test-org"
        mock_account.id = 123
        installation.account = mock_account

        # Mock redis
        redis = MagicMock()

        # Mock the GitHub client to raise an unexpected exception
        mock_client = MagicMock()
        mock_response = AsyncMock()
        mock_response.side_effect = ValueError("Unexpected error")
        mock_client.rest.orgs.async_get = mock_response

        mocker.patch(
            "polar.integrations.github.client.get_app_installation_client",
            return_value=mock_client,
        )

        # Mock the logger to verify it's called with proper context
        mock_log = mocker.patch(
            "polar.integrations.github_repository_benefit.service.log"
        )

        # Call the method
        result = await github_repository_benefit_user_service.get_billing_plan(
            redis, oauth, installation
        )

        # Verify the result still returns an organization object with empty plan
        assert result is not None
        assert result.name == "test-org"
        assert result.is_personal is False
        assert result.plan_name == ""
        assert result.is_free is False

        # Verify log.exception was called with the right context
        assert mock_log.exception.called
        call_kwargs = mock_log.exception.call_args[1]
        assert call_kwargs["installation_id"] == 60276577
        assert call_kwargs["organization"] == "test-org"
        assert call_kwargs["error_type"] == "ValueError"
        assert call_kwargs["error_message"] == "Unexpected error"


@pytest.mark.anyio
class TestCreateOAuthAccount:
    async def test_duplicate_account_raises_resource_already_exists_and_rolls_back(
        self,
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
        mock_user_response.parsed_data.login = "existing-user"
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
            new=AsyncMock(return_value=("existing@example.com", True)),
        )

        token_data = OAuth2Token(
            {
                "access_token": "new_token",
                "expires_at": 1794409366,
                "refresh_token": "new_refresh_token",
            }
        )

        with pytest.raises(ResourceAlreadyExists):
            await github_repository_benefit_user_service.create_oauth_account(
                session, user, token_data
            )

        await session.flush()
        assert user.get_oauth_account(OAuthPlatform.github_repository_benefit) is None
