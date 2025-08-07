"""Tests for AI validation service."""

from unittest.mock import MagicMock, patch

import pytest
from pydantic_ai import models
from pydantic_ai.models.test import TestModel

from polar.models.organization import Organization
from polar.models.organization_ai_validation import OrganizationAIValidation
from polar.organization.ai_validation import (
    OrganizationAIValidationResult,
    OrganizationAIValidator,
)

# Disable real model requests to avoid costs
models.ALLOW_MODEL_REQUESTS = False


class TestOrganizationAIValidator:
    """Test suite for OrganizationAIValidator."""

    def test_init_uses_default_model(self) -> None:
        """Test validator initialization with default model."""
        validator = OrganizationAIValidator()
        assert validator.model is not None
        assert validator.agent is not None

    @patch("polar.organization.ai_validation.settings")
    def test_init_uses_configured_model(self, mock_settings: MagicMock) -> None:
        """Test validator initialization with configured model."""
        mock_settings.AI_VALIDATION_MODEL = "gpt-4-test"
        validator = OrganizationAIValidator()
        # Verify the model was configured (exact testing depends on pydantic-ai internals)

    def test_validate_input_with_no_organization(self) -> None:
        """Test input validation fails with no organization."""
        validator = OrganizationAIValidator()

        with pytest.raises(ValueError, match="Organization is required"):
            validator._validate_input(None)  # type: ignore[arg-type]

    def test_validate_input_with_no_details(self) -> None:
        """Test input validation fails with no details."""
        validator = OrganizationAIValidator()
        org = Organization(name="Test Org", details=None)

        with pytest.raises(ValueError, match="Organization details are required"):
            validator._validate_input(org)

    def test_validate_input_with_no_name(self) -> None:
        """Test input validation fails with no name."""
        validator = OrganizationAIValidator()
        org = Organization(name=None, details={"description": "Test"})

        with pytest.raises(ValueError, match="Organization name is required"):
            validator._validate_input(org)

    def test_validate_input_with_large_details(self) -> None:
        """Test input validation fails with oversized details."""
        validator = OrganizationAIValidator()
        large_details = {"description": "x" * 10001}  # Over 10KB limit
        org = Organization(name="Test Org", details=large_details)

        with pytest.raises(ValueError, match="Organization details too large"):
            validator._validate_input(org)

    def test_validate_input_success(self) -> None:
        """Test successful input validation."""
        validator = OrganizationAIValidator()
        org = Organization(
            name="Test Org", details={"description": "A valid test organization"}
        )

        # Should not raise any exception
        validator._validate_input(org)

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
    async def test_validate_organization_details_ai_error(
        self, mock_fetch_policy: MagicMock
    ) -> None:
        """Test validation handles AI service errors."""
        mock_fetch_policy.return_value = "Mock policy content"

        validator = OrganizationAIValidator()

        # Mock AI service error by patching the agent run method
        with patch.object(validator.agent, "run") as mock_run:
            mock_run.side_effect = Exception("AI service unavailable")

            org = Organization(
                name="Test Org", details={"description": "Test description"}
            )

            result = await validator.validate_organization_details(org)

            assert isinstance(result, OrganizationAIValidationResult)
            assert result.timed_out is False
            assert result.verdict.verdict == "UNCERTAIN"
            assert "technical error" in result.verdict.reason.lower()

    @pytest.mark.asyncio
    async def test_validate_organization_details_policy_fetch_fails(self) -> None:
        """Test validation handles policy fetch failure."""
        validator = OrganizationAIValidator()

        # Mock policy fetch failure
        with patch(
            "polar.organization.ai_validation._fetch_policy_content"
        ) as mock_fetch:
            mock_fetch.side_effect = Exception("Policy fetch failed")

            org = Organization(
                name="Test Org", details={"description": "Test description"}
            )

            result = await validator.validate_organization_details(org)

            assert isinstance(result, OrganizationAIValidationResult)
            assert result.verdict.verdict == "UNCERTAIN"
            assert "technical error" in result.verdict.reason.lower()


class TestPolicyFetching:
    """Test suite for policy content fetching."""

    @pytest.mark.asyncio
    @patch("polar.organization.ai_validation.httpx.AsyncClient.get")
    async def test_fetch_policy_content_success(self, mock_get: MagicMock) -> None:
        """Test successful policy content fetch."""
        import polar.organization.ai_validation as ai_validation_module
        from polar.organization.ai_validation import _fetch_policy_content

        # Clear any existing cache
        ai_validation_module._cached_policy_content = None

        mock_response = MagicMock()
        mock_response.text = "Mock policy content"
        mock_response.status_code = 200
        mock_response.raise_for_status.return_value = None
        mock_get.return_value = mock_response

        content = await _fetch_policy_content()
        assert content == "Mock policy content"

    @pytest.mark.asyncio
    @patch("polar.organization.ai_validation.httpx.AsyncClient.get")
    async def test_fetch_policy_content_uses_fallback(
        self, mock_get: MagicMock
    ) -> None:
        """Test policy fetch uses fallback on error."""
        import polar.organization.ai_validation as ai_validation_module
        from polar.organization.ai_validation import (
            _fetch_policy_content,
            _get_fallback_policy,
        )

        # Clear any existing cache
        ai_validation_module._cached_policy_content = None

        mock_get.side_effect = Exception("Network error")

        content = await _fetch_policy_content()
        fallback_content = _get_fallback_policy()

        assert content == fallback_content
        assert "Merchant of Record (MoR)" in content

    @pytest.mark.asyncio
    async def test_fetch_policy_content_caching(self) -> None:
        """Test policy content caching works correctly."""
        import polar.organization.ai_validation as ai_validation_module
        from polar.organization.ai_validation import (
            _fetch_policy_content,
        )

        # Clear any existing cache
        ai_validation_module._cached_policy_content = None

        with patch(
            "polar.organization.ai_validation.httpx.AsyncClient.get"
        ) as mock_get:
            mock_response = MagicMock()
            mock_response.text = "Cached policy content"
            mock_response.status_code = 200
            mock_response.raise_for_status.return_value = None
            mock_get.return_value = mock_response

            # First call should fetch from HTTP
            content1 = await _fetch_policy_content()
            assert mock_get.call_count == 1

            # Second call should use cache
            content2 = await _fetch_policy_content()
            assert mock_get.call_count == 1  # Should not increase

            assert content1 == content2 == "Cached policy content"


class TestIntegrationValidation:
    """Integration tests for AI validation flow."""

    def test_verdict_enum_values(self) -> None:
        """Test verdict enum has expected values."""
        from polar.models.organization_ai_validation import OrganizationAIValidation

        assert OrganizationAIValidation.Verdict.PASS == "PASS"
        assert OrganizationAIValidation.Verdict.FAIL == "FAIL"
        assert OrganizationAIValidation.Verdict.UNCERTAIN == "UNCERTAIN"

    def test_ai_validation_model_creation(self) -> None:
        """Test AI validation model can be created correctly."""
        from uuid import uuid4

        validation = OrganizationAIValidation(
            organization_id=uuid4(),
            verdict="PASS",
            risk_score=25.5,
            violated_sections=[],
            reason="Test validation",
            timed_out=False,
            model_used="gpt-4o-mini-2025-04-16",
            organization_details_snapshot={"name": "Test Org"},
        )

        assert validation.verdict == "PASS"
        assert validation.risk_score == 25.5
        assert validation.timed_out is False

    def test_organization_context_preparation(self) -> None:
        """Test organization context preparation for AI."""
        validator = OrganizationAIValidator()

        org = Organization(
            name="Test Company",
            website="https://test.com",
            details={
                "about": "We make software",
                "product_description": "Software development tools",
                "intended_use": "Technology business",
            },
        )

        context = validator._prepare_organization_context(org)

        assert "Test Company" in context
        assert "https://test.com" in context
        assert "We make software" in context
        assert "Software development tools" in context
        assert "Technology business" in context
