"""Tests for organization service AI validation integration."""

from unittest.mock import MagicMock, patch

import pytest
from pydantic_ai import models
from pydantic_ai.models.test import TestModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from polar.models.organization import Organization
from polar.models.organization_ai_validation import OrganizationAIValidation
from polar.organization.ai_validation import (
    OrganizationAIValidationResult,
    OrganizationAIValidationVerdict,
    OrganizationAIValidator,
)
from polar.organization.service import OrganizationService

# Disable real model requests to avoid costs
models.ALLOW_MODEL_REQUESTS = False


class TestOrganizationServiceAIValidation:
    """Test AI validation integration in OrganizationService."""

    @pytest.mark.asyncio
    @patch("polar.organization.ai_validation._fetch_policy_content")
    async def test_validate_with_ai_success(
        self,
        mock_fetch_policy: MagicMock,
        session: AsyncSession,
        organization: Organization,
    ) -> None:
        """Test successful AI validation through service layer."""
        mock_fetch_policy.return_value = "Mock policy content"

        # Add details to the organization for validation
        organization.details = {"description": "A test software company"}  # type: ignore[assignment]
        session.add(organization)
        await session.commit()

        service = OrganizationService()

        # Override the validator with TestModel
        validator = OrganizationAIValidator()
        with validator.agent.override(model=TestModel()):
            with patch("polar.organization.service.organization_validator", validator):
                result = await service.validate_with_ai(session, organization)

                # Verify result structure (returns database model)
                assert isinstance(result, OrganizationAIValidation)
                assert result.verdict in ["PASS", "FAIL", "UNCERTAIN"]
                assert isinstance(result.risk_score, float)
                assert 0 <= result.risk_score <= 100
                assert result.timed_out is False
                assert isinstance(result.violated_sections, list)
                assert isinstance(result.reason, str)

                # Verify database record was created
                db_records = await session.execute(
                    select(OrganizationAIValidation).where(
                        OrganizationAIValidation.organization_id == organization.id
                    )
                )
                db_record = db_records.scalar_one_or_none()

                assert db_record is not None
                assert db_record.verdict == result.verdict
                assert db_record.risk_score == result.risk_score
                assert db_record.organization_id == organization.id
                assert db_record.organization_details_snapshot is not None

    @pytest.mark.asyncio
    @patch("polar.organization.ai_validation._fetch_policy_content")
    async def test_validate_with_ai_fail_verdict(
        self,
        mock_fetch_policy: MagicMock,
        session: AsyncSession,
        organization: Organization,
    ) -> None:
        """Test AI validation flow works with TestModel."""
        mock_fetch_policy.return_value = "Mock policy content"

        # Add details to the organization for validation
        organization.details = {"description": "A test software company"}  # type: ignore[assignment]
        session.add(organization)
        await session.commit()

        service = OrganizationService()

        # Override the validator with TestModel
        validator = OrganizationAIValidator()
        with validator.agent.override(model=TestModel()):
            with patch("polar.organization.service.organization_validator", validator):
                result = await service.validate_with_ai(session, organization)

                # TestModel provides structured responses, verify format
                assert isinstance(result, OrganizationAIValidation)
                assert result.verdict in ["PASS", "FAIL", "UNCERTAIN"]
                assert isinstance(result.risk_score, float)
                assert 0 <= result.risk_score <= 100
                assert isinstance(result.violated_sections, list)
                assert isinstance(result.reason, str)

                # Verify database storage
                db_records = await session.execute(
                    select(OrganizationAIValidation).where(
                        OrganizationAIValidation.organization_id == organization.id
                    )
                )
                db_record = db_records.scalar_one_or_none()

                assert db_record is not None
                assert db_record.verdict == result.verdict
                assert db_record.violated_sections == result.violated_sections

    @pytest.mark.asyncio
    @patch("polar.organization.ai_validation._fetch_policy_content")
    async def test_validate_with_ai_timeout(
        self,
        mock_fetch_policy: MagicMock,
        session: AsyncSession,
        organization: Organization,
    ) -> None:
        """Test AI validation timeout handling."""
        mock_fetch_policy.return_value = "Mock policy content"

        # Add details to the organization for validation
        organization.details = {"description": "A test software company"}  # type: ignore[assignment]
        session.add(organization)
        await session.commit()

        service = OrganizationService()

        # Create validator and simulate timeout with very short timeout
        validator = OrganizationAIValidator()
        with validator.agent.override(model=TestModel()):
            # Mock the validate_organization_details method to simulate timeout
            async def mock_validate(
                *args: object, **kwargs: object
            ) -> OrganizationAIValidationResult:
                timeout_result = OrganizationAIValidationResult(
                    verdict=OrganizationAIValidationVerdict(
                        verdict="UNCERTAIN",
                        risk_score=50.0,
                        violated_sections=[],
                        reason="Validation timed out. Manual review required.",
                    ),
                    timed_out=True,
                    model="test",
                )
                return timeout_result

            with patch.object(
                validator, "validate_organization_details", side_effect=mock_validate
            ):
                with patch(
                    "polar.organization.service.organization_validator", validator
                ):
                    result = await service.validate_with_ai(session, organization)

                    assert result.timed_out is True
                    assert result.verdict == "UNCERTAIN"
                    assert "timed out" in result.reason.lower()

                    # Verify timeout flag stored in database
                    db_records = await session.execute(
                        select(OrganizationAIValidation).where(
                            OrganizationAIValidation.organization_id == organization.id
                        )
                    )
                    db_record = db_records.scalar_one_or_none()

                    assert db_record is not None
                    assert db_record.timed_out is True

    @pytest.mark.asyncio
    async def test_validate_with_ai_validator_exception(
        self, session: AsyncSession, organization: Organization
    ) -> None:
        """Test AI validation handles validator exceptions."""
        # Add details to the organization for validation
        organization.details = {"description": "A test software company"}  # type: ignore[assignment]
        session.add(organization)
        await session.commit()

        service = OrganizationService()

        # Create validator and simulate an error
        validator = OrganizationAIValidator()
        with patch.object(validator, "validate_organization_details") as mock_validate:
            mock_validate.side_effect = Exception("AI service error")

            with patch("polar.organization.service.organization_validator", validator):
                # Should raise the exception (service doesn't handle validator errors)
                with pytest.raises(Exception, match="AI service error"):
                    await service.validate_with_ai(session, organization)

                # Verify no database record was created
                db_records = await session.execute(
                    select(OrganizationAIValidation).where(
                        OrganizationAIValidation.organization_id == organization.id
                    )
                )
                db_record = db_records.scalar_one_or_none()

                assert db_record is None

    @pytest.mark.asyncio
    @patch("polar.organization.ai_validation._fetch_policy_content")
    async def test_validate_with_ai_organization_snapshot(
        self, mock_fetch_policy: MagicMock, session: AsyncSession
    ) -> None:
        """Test organization details snapshot is stored correctly."""
        mock_fetch_policy.return_value = "Mock policy content"

        service = OrganizationService()

        # Create organization with detailed information
        org = Organization(
            name="Test Company",
            slug="test-company",
            website="https://test-company.com",
            customer_invoice_prefix="TEST",
            details={
                "description": "A comprehensive software development company",
                "industry": "Technology",
                "services": ["Web Development", "Mobile Apps", "Consulting"],
            },
        )
        session.add(org)
        await session.commit()

        # Override the validator with TestModel
        validator = OrganizationAIValidator()
        with validator.agent.override(model=TestModel()):
            with patch("polar.organization.service.organization_validator", validator):
                result = await service.validate_with_ai(session, org)

                # Verify snapshot contains expected data
                db_records = await session.execute(
                    select(OrganizationAIValidation).where(
                        OrganizationAIValidation.organization_id == org.id
                    )
                )
                db_record = db_records.scalar_one_or_none()

                assert db_record is not None
                snapshot = db_record.organization_details_snapshot
                assert snapshot["name"] == "Test Company"
                assert snapshot["website"] == "https://test-company.com"
                assert (
                    snapshot["details"]["description"]
                    == "A comprehensive software development company"
                )
                assert snapshot["details"]["industry"] == "Technology"
                assert "Web Development" in snapshot["details"]["services"]

    @pytest.mark.asyncio
    @patch("polar.organization.ai_validation._fetch_policy_content")
    async def test_validate_with_ai_multiple_validations(
        self,
        mock_fetch_policy: MagicMock,
        session: AsyncSession,
        organization: Organization,
    ) -> None:
        """Test multiple AI validations for the same organization."""
        mock_fetch_policy.return_value = "Mock policy content"

        # Add details to the organization for validation
        organization.details = {"description": "A test software company"}  # type: ignore[assignment]
        session.add(organization)
        await session.commit()

        service = OrganizationService()

        # Override the validator with TestModel
        validator = OrganizationAIValidator()
        with validator.agent.override(model=TestModel()):
            with patch("polar.organization.service.organization_validator", validator):
                # First validation
                result1 = await service.validate_with_ai(session, organization)
                assert isinstance(result1, OrganizationAIValidation)

                # Second validation should return the same cached result
                result2 = await service.validate_with_ai(session, organization)
                assert isinstance(result2, OrganizationAIValidation)
                assert result1.id == result2.id  # Should be same record

                # Verify only one record exists (cached behavior)
                db_records = await session.execute(
                    select(OrganizationAIValidation)
                    .where(OrganizationAIValidation.organization_id == organization.id)
                    .order_by(OrganizationAIValidation.created_at)
                )
                records = db_records.scalars().all()

                assert len(records) == 1
                # Record should have valid verdict
                assert records[0].verdict in ["PASS", "FAIL", "UNCERTAIN"]
