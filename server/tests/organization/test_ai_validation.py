"""Tests for AI validation service."""

from unittest.mock import AsyncMock, MagicMock, patch

import httpx
import pytest
from pydantic_ai import models
from pydantic_ai.models.test import TestModel

from polar.models.organization import Organization
from polar.organization.ai_validation import (
    OrganizationAIValidationResult,
    OrganizationAIValidator,
    _fetch_website_content,
)

# Disable real model requests to avoid costs
models.ALLOW_MODEL_REQUESTS = False


class TestFetchWebsiteContent:
    """Test suite for _fetch_website_content function."""

    @pytest.mark.asyncio
    async def test_fetch_website_content_success(self) -> None:
        """Test successful website fetch and markdown conversion."""
        mock_html = """
        <html>
            <head><title>Test Site</title></head>
            <body>
                <h1>Welcome</h1>
                <p>This is a test website.</p>
            </body>
        </html>
        """

        with patch("httpx.AsyncClient") as mock_client_class:
            mock_client = AsyncMock()
            mock_response = MagicMock()
            mock_response.status_code = 200
            mock_response.text = mock_html
            mock_client.get.return_value = mock_response
            mock_client.__aenter__.return_value = mock_client
            mock_client.__aexit__.return_value = None
            mock_client_class.return_value = mock_client

            result = await _fetch_website_content("https://example.com")

            assert result is not None
            assert "Welcome" in result
            assert "test website" in result
            mock_client.get.assert_called_once()
            call_kwargs = mock_client.get.call_args[1]
            assert call_kwargs["timeout"] == 10.0
            assert "User-Agent" in call_kwargs["headers"]

    @pytest.mark.asyncio
    async def test_fetch_website_content_404(self) -> None:
        """Test handling of 404 error."""
        with patch("httpx.AsyncClient") as mock_client_class:
            mock_client = AsyncMock()
            mock_response = MagicMock()
            mock_response.status_code = 404
            mock_client.get.return_value = mock_response
            mock_client.__aenter__.return_value = mock_client
            mock_client.__aexit__.return_value = None
            mock_client_class.return_value = mock_client

            result = await _fetch_website_content("https://example.com")

            assert result is None

    @pytest.mark.asyncio
    async def test_fetch_website_content_timeout(self) -> None:
        """Test handling of timeout."""
        with patch("httpx.AsyncClient") as mock_client_class:
            mock_client = AsyncMock()
            mock_client.get.side_effect = TimeoutError()
            mock_client.__aenter__.return_value = mock_client
            mock_client.__aexit__.return_value = None
            mock_client_class.return_value = mock_client

            result = await _fetch_website_content("https://example.com")

            assert result is None

    @pytest.mark.asyncio
    async def test_fetch_website_content_size_limit(self) -> None:
        """Test size limit enforcement."""
        # Create content larger than 50KB
        large_html = "<html><body>" + ("x" * 60000) + "</body></html>"

        with patch("httpx.AsyncClient") as mock_client_class:
            mock_client = AsyncMock()
            mock_response = MagicMock()
            mock_response.status_code = 200
            mock_response.text = large_html
            mock_client.get.return_value = mock_response
            mock_client.__aenter__.return_value = mock_client
            mock_client.__aexit__.return_value = None
            mock_client_class.return_value = mock_client

            result = await _fetch_website_content("https://example.com")

            assert result is not None
            # Content should be truncated to 50KB before markdown conversion
            assert len(result) < 60000

    @pytest.mark.asyncio
    async def test_fetch_website_content_network_error(self) -> None:
        """Test handling of network errors."""
        with patch("httpx.AsyncClient") as mock_client_class:
            mock_client = AsyncMock()
            mock_client.get.side_effect = httpx.RequestError("Network error")
            mock_client.__aenter__.return_value = mock_client
            mock_client.__aexit__.return_value = None
            mock_client_class.return_value = mock_client

            result = await _fetch_website_content("https://example.com")

            assert result is None


class TestOrganizationAIValidator:
    """Test suite for OrganizationAIValidator."""

    @pytest.mark.asyncio
    @patch("polar.organization.ai_validation._fetch_policy_content")
    async def test_validate_organization_details_timeout(
        self, mock_fetch_policy: MagicMock
    ) -> None:
        """Test validation handles timeout correctly."""
        mock_fetch_policy.return_value = "Mock policy content"

        validator = OrganizationAIValidator()

        # Mock the agent to actually timeout
        with patch.object(validator.agent, "run") as mock_run:
            mock_run.side_effect = TimeoutError()

            org = Organization(
                name="Test Org", details={"description": "Test description"}
            )

            result = await validator.validate_organization_details(
                org, timeout_seconds=1
            )

            assert isinstance(result, OrganizationAIValidationResult)
            assert result.timed_out is True
            assert result.verdict.verdict == "UNCERTAIN"
            assert "timed out" in result.verdict.reason.lower()

    @pytest.mark.asyncio
    @patch("polar.organization.ai_validation._fetch_policy_content")
    async def test_validate_organization_details_success(
        self, mock_fetch_policy: MagicMock
    ) -> None:
        """Test successful validation."""
        mock_fetch_policy.return_value = "Mock policy content"

        validator = OrganizationAIValidator()

        # Override with TestModel - it will return default structured response
        with validator.agent.override(model=TestModel()):
            org = Organization(
                name="Test Org",
                details={"description": "A legitimate software company"},
            )

            result = await validator.validate_organization_details(org)

            assert isinstance(result, OrganizationAIValidationResult)
            assert result.timed_out is False
            assert result.verdict.verdict in ["PASS", "FAIL", "UNCERTAIN"]
            assert isinstance(result.verdict.risk_score, float)
            assert 0 <= result.verdict.risk_score <= 100
            assert isinstance(result.verdict.violated_sections, list)
            assert isinstance(result.verdict.reason, str)

    @pytest.mark.asyncio
    @patch("polar.organization.ai_validation._fetch_policy_content")
    @patch("polar.organization.ai_validation._fetch_website_content")
    async def test_validate_organization_with_website_content(
        self, mock_fetch_website: AsyncMock, mock_fetch_policy: MagicMock
    ) -> None:
        """Test validation includes website content when available."""
        mock_fetch_policy.return_value = "Mock policy content"
        mock_fetch_website.return_value = "# Website Title\n\nWebsite content here"

        validator = OrganizationAIValidator()

        with validator.agent.override(model=TestModel()):
            org = Organization(
                name="Test Org",
                website="https://example.com",
                details={"description": "A software company"},
            )

            result = await validator.validate_organization_details(org)

            # Verify website content fetching was called
            mock_fetch_website.assert_called_once_with("https://example.com")

            assert isinstance(result, OrganizationAIValidationResult)
            assert result.verdict.verdict in ["PASS", "FAIL", "UNCERTAIN"]

    @pytest.mark.asyncio
    @patch("polar.organization.ai_validation._fetch_policy_content")
    @patch("polar.organization.ai_validation._fetch_website_content")
    async def test_validate_organization_website_fetch_fails(
        self, mock_fetch_website: AsyncMock, mock_fetch_policy: MagicMock
    ) -> None:
        """Test validation continues gracefully when website fetch fails."""
        mock_fetch_policy.return_value = "Mock policy content"
        mock_fetch_website.return_value = None  # Simulate fetch failure

        validator = OrganizationAIValidator()

        with validator.agent.override(model=TestModel()):
            org = Organization(
                name="Test Org",
                website="https://example.com",
                details={"description": "A software company"},
            )

            # Should not raise an exception
            result = await validator.validate_organization_details(org)

            assert isinstance(result, OrganizationAIValidationResult)
            assert result.verdict.verdict in ["PASS", "FAIL", "UNCERTAIN"]
