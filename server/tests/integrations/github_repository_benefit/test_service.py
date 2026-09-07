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

    async def test_user_branch_github_exception_logged_with_context(
        self, mocker: MockerFixture
    ) -> None:
        """Transient GitHubException on /user degrades to plan_name='' (not 500)"""
        oauth = OAuthAccount(
            platform=OAuthPlatform.github_repository_benefit,
            access_token="test_token",
            account_id="12345",
        )

        installation = MagicMock()
        installation.id = 60276577
        installation.target_type = "User"
        mock_account = MagicMock(spec=SimpleUser)
        mock_account.login = "test-user"
        mock_account.id = 123
        installation.account = mock_account

        redis = MagicMock()

        mocker.patch.object(oauth, "get_access_token", return_value="test_token")

        mock_client = MagicMock()
        mock_client.rest.users.async_get_authenticated = AsyncMock(
            side_effect=RequestFailed(
                MagicMock(status_code=503, json=lambda: {"message": "Unavailable"})
            )
        )
        mocker.patch(
            "polar.integrations.github.client.get_client",
            return_value=mock_client,
        )

        mock_log = mocker.patch(
            "polar.integrations.github_repository_benefit.service.log"
        )

        result = await github_repository_benefit_user_service.get_billing_plan(
            redis, oauth, installation
        )

        assert result is not None
        assert result.name == "test-user"
        assert result.is_personal is True
        assert result.plan_name == ""
        assert result.is_free is False

        assert mock_log.exception.called
        call_kwargs = mock_log.exception.call_args[1]
        assert call_kwargs["installation_id"] == 60276577
        assert call_kwargs["user"] == "test-user"
        assert call_kwargs["error_type"] == "RequestFailed"
        assert "error_message" in call_kwargs

    async def test_user_branch_unexpected_exception_logged_with_context(
        self, mocker: MockerFixture
    ) -> None:
        """Unexpected non-GitHubException on /user degrades to plan_name='' (not 500)"""
        oauth = OAuthAccount(
            platform=OAuthPlatform.github_repository_benefit,
            access_token="test_token",
            account_id="12345",
        )

        installation = MagicMock()
        installation.id = 60276577
        installation.target_type = "User"
        mock_account = MagicMock(spec=SimpleUser)
        mock_account.login = "test-user"
        mock_account.id = 123
        installation.account = mock_account

        redis = MagicMock()

        mocker.patch.object(oauth, "get_access_token", return_value="test_token")

        mock_client = MagicMock()
        mock_client.rest.users.async_get_authenticated = AsyncMock(
            side_effect=ValueError("Unexpected error")
        )
        mocker.patch(
            "polar.integrations.github.client.get_client",
            return_value=mock_client,
        )

        mock_log = mocker.patch(
            "polar.integrations.github_repository_benefit.service.log"
        )

        result = await github_repository_benefit_user_service.get_billing_plan(
            redis, oauth, installation
        )

        assert result is not None
        assert result.name == "test-user"
        assert result.is_personal is True
        assert result.plan_name == ""
        assert result.is_free is False

        assert mock_log.exception.called
        call_kwargs = mock_log.exception.call_args[1]
        assert call_kwargs["installation_id"] == 60276577
        assert call_kwargs["user"] == "test-user"
        assert call_kwargs["error_type"] == "ValueError"
        assert call_kwargs["error_message"] == "Unexpected error"

    async def test_user_branch_happy_path(self, mocker: MockerFixture) -> None:
        """A successful /user fetch surfaces the plan and does not log."""
        oauth = OAuthAccount(
            platform=OAuthPlatform.github_repository_benefit,
            access_token="test_token",
            account_id="12345",
        )

        installation = MagicMock()
        installation.id = 60276577
        installation.target_type = "User"
        mock_account = MagicMock(spec=SimpleUser)
        mock_account.login = "test-user"
        mock_account.id = 123
        installation.account = mock_account

        redis = MagicMock()

        mocker.patch.object(oauth, "get_access_token", return_value="test_token")

        mock_plan = MagicMock()
        mock_plan.name = "free"
        mock_parsed_data = MagicMock()
        mock_parsed_data.plan = mock_plan
        mock_response = MagicMock()
        mock_response.parsed_data = mock_parsed_data

        mock_client = MagicMock()
        mock_client.rest.users.async_get_authenticated = AsyncMock(
            return_value=mock_response
        )
        mocker.patch(
            "polar.integrations.github.client.get_client",
            return_value=mock_client,
        )

        mock_log = mocker.patch(
            "polar.integrations.github_repository_benefit.service.log"
        )

        result = await github_repository_benefit_user_service.get_billing_plan(
            redis, oauth, installation
        )

        assert result is not None
        assert result.name == "test-user"
        assert result.is_personal is True
        assert result.plan_name == "free"
        assert result.is_free is True

        assert not mock_log.exception.called

    async def test_list_orgs_with_billing_plans_degrades_user_branch_failure(
        self, mocker: MockerFixture
    ) -> None:
        """A transient /user failure on one personal install must not blank the list."""
        oauth = OAuthAccount(
            platform=OAuthPlatform.github_repository_benefit,
            access_token="test_token",
            account_id="12345",
        )
        redis = MagicMock()

        # Personal-account (User) installation whose /user fetch fails transiently.
        user_installation = MagicMock()
        user_installation.id = 60276577
        user_installation.target_type = "User"
        user_account = MagicMock(spec=SimpleUser)
        user_account.login = "test-user"
        user_account.id = 123
        user_installation.account = user_account

        # Organization installation on the happy path.
        org_installation = MagicMock()
        org_installation.id = 60276578
        org_installation.target_type = "Organization"
        org_account = MagicMock(spec=SimpleUser)
        org_account.login = "test-org"
        org_account.id = 456
        org_installation.account = org_account

        mocker.patch.object(oauth, "get_access_token", return_value="test_token")

        # User client: /user raises transiently.
        user_client = MagicMock()
        user_client.rest.users.async_get_authenticated = AsyncMock(
            side_effect=RequestFailed(
                MagicMock(status_code=503, json=lambda: {"message": "Unavailable"})
            )
        )

        # Org client: returns a plan
        org_plan = MagicMock()
        org_plan.name = "team"
        org_parsed_data = MagicMock()
        org_parsed_data.plan = org_plan
        org_response = MagicMock()
        org_response.parsed_data = org_parsed_data

        org_client = MagicMock()
        org_client.rest.orgs.async_get = AsyncMock(return_value=org_response)

        def get_client_side_effect(access_token: str) -> MagicMock:
            return user_client

        mocker.patch(
            "polar.integrations.github.client.get_client",
            side_effect=get_client_side_effect,
        )
        mocker.patch(
            "polar.integrations.github.client.get_app_installation_client",
            return_value=org_client,
        )

        result = (
            await github_repository_benefit_user_service.list_orgs_with_billing_plans(
                redis, oauth, [user_installation, org_installation]
            )
        )

        # Both installations are returned; the User one degraded to plan_name="".
        assert len(result) == 2
        user_result = result[0]
        assert user_result.name == "test-user"
        assert user_result.is_personal is True
        assert user_result.plan_name == ""

        org_result = result[1]
        assert org_result.name == "test-org"
        assert org_result.is_personal is False
        assert org_result.plan_name == "team"
