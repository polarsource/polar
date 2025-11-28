from unittest.mock import AsyncMock, MagicMock

import pytest
from githubkit.exception import RequestFailed
from pytest_mock import MockerFixture

from polar.integrations.github_repository_benefit.service import (
    github_repository_benefit_user_service,
)
from polar.integrations.github_repository_benefit.types import SimpleUser
from polar.models import OAuthAccount
from polar.models.user import OAuthPlatform


@pytest.mark.asyncio
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

        # Verify log.error was called with the right context
        assert mock_log.error.called
        call_kwargs = mock_log.error.call_args[1]
        assert call_kwargs["installation_id"] == 60276577
        assert call_kwargs["organization"] == "test-org"
        assert call_kwargs["error_type"] == "RequestFailed"
        assert call_kwargs["exc_info"] is True

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

        # Verify log.error was called with the right context
        assert mock_log.error.called
        call_kwargs = mock_log.error.call_args[1]
        assert call_kwargs["installation_id"] == 60276577
        assert call_kwargs["organization"] == "test-org"
        assert call_kwargs["error_type"] == "ValueError"
        assert call_kwargs["error_message"] == "Unexpected error"
        assert call_kwargs["exc_info"] is True
