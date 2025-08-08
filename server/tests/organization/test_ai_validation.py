"""Tests for AI validation service."""

from unittest.mock import MagicMock, patch

import pytest
from pydantic_ai import models
from pydantic_ai.models.test import TestModel

from polar.models.organization import Organization
from polar.organization.ai_validation import (
    OrganizationAIValidationResult,
    OrganizationAIValidator,
)

# Disable real model requests to avoid costs
models.ALLOW_MODEL_REQUESTS = False


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
