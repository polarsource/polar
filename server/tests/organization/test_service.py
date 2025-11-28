from datetime import UTC, datetime
from unittest.mock import MagicMock, patch

import pytest
from pydantic import ValidationError
from pydantic_ai import models
from pydantic_ai.models.test import TestModel
from pytest_mock import MockerFixture
from sqlalchemy import select

from polar.auth.models import AuthSubject
from polar.config import Environment, settings
from polar.enums import AccountType, InvoiceNumbering
from polar.exceptions import PolarRequestValidationError
from polar.models import Customer, Organization, Product, User
from polar.models.account import Account
from polar.models.organization import (
    OrganizationNotificationSettings,
    OrganizationStatus,
)
from polar.models.organization_review import OrganizationReview
from polar.models.user import IdentityVerificationStatus
from polar.organization.ai_validation import (
    OrganizationAIValidationResult,
    OrganizationAIValidationVerdict,
    OrganizationAIValidator,
)
from polar.organization.schemas import OrganizationCreate, OrganizationFeatureSettings
from polar.organization.service import AccountAlreadySet
from polar.organization.service import organization as organization_service
from polar.postgres import AsyncSession
from polar.user_organization.service import (
    user_organization as user_organization_service,
)
from tests.fixtures.database import SaveFixture

# Disable real model requests to avoid costs
models.ALLOW_MODEL_REQUESTS = False


@pytest.mark.asyncio
class TestCreate:
    @pytest.mark.auth
    @pytest.mark.parametrize(
        "slug",
        [
            "",
            "a",
            "ab",
            "Polar Software Inc 🌀",
            "slug/with/slashes",
            *settings.ORGANIZATION_SLUG_RESERVED_KEYWORDS,
        ],
    )
    async def test_slug_validation(
        self, slug: str, auth_subject: AuthSubject[User], session: AsyncSession
    ) -> None:
        with pytest.raises(ValidationError):
            await organization_service.create(
                session,
                OrganizationCreate(name="My New Organization", slug=slug),
                auth_subject,
            )

    @pytest.mark.auth
    async def test_existing_slug(
        self,
        auth_subject: AuthSubject[User],
        session: AsyncSession,
        organization: Organization,
    ) -> None:
        with pytest.raises(PolarRequestValidationError):
            await organization_service.create(
                session,
                OrganizationCreate(name=organization.name, slug=organization.slug),
                auth_subject,
            )

    @pytest.mark.auth
    @pytest.mark.parametrize("slug", ["polar-software-inc", "slug-with-dashes"])
    async def test_valid(
        self,
        slug: str,
        mocker: MockerFixture,
        auth_subject: AuthSubject[User],
        session: AsyncSession,
    ) -> None:
        enqueue_job_mock = mocker.patch("polar.organization.service.enqueue_job")

        organization = await organization_service.create(
            session,
            OrganizationCreate(name="My New Organization", slug=slug),
            auth_subject,
        )

        assert organization.name == "My New Organization"
        assert organization.slug == slug
        assert organization.feature_settings == {}

        user_organization = await user_organization_service.get_by_user_and_org(
            session, auth_subject.subject.id, organization.id
        )
        assert user_organization is not None

        enqueue_job_mock.assert_called_once_with(
            "organization.created", organization_id=organization.id
        )

    @pytest.mark.auth
    async def test_valid_with_feature_settings(
        self, auth_subject: AuthSubject[User], session: AsyncSession
    ) -> None:
        organization = await organization_service.create(
            session,
            OrganizationCreate(
                name="My New Organization",
                slug="my-new-organization",
                feature_settings=OrganizationFeatureSettings(
                    issue_funding_enabled=False
                ),
            ),
            auth_subject,
        )

        assert organization.name == "My New Organization"

        assert organization.feature_settings == {"issue_funding_enabled": False}

    @pytest.mark.auth
    async def test_valid_with_notification_settings(
        self, auth_subject: AuthSubject[User], session: AsyncSession
    ) -> None:
        organization = await organization_service.create(
            session,
            OrganizationCreate(
                name="My New Organization",
                slug="my-new-organization",
                notification_settings=OrganizationNotificationSettings(
                    new_order=False,
                    new_subscription=False,
                ),
            ),
            auth_subject,
        )

        assert organization.notification_settings == {
            "new_order": False,
            "new_subscription": False,
        }

    @pytest.mark.auth
    async def test_valid_with_none_subscription_settings(
        self, auth_subject: AuthSubject[User], session: AsyncSession
    ) -> None:
        organization = await organization_service.create(
            session,
            OrganizationCreate(
                name="My New Organization",
                slug="my-new-organization",
                subscription_settings=None,
            ),
            auth_subject,
        )

        assert organization.subscription_settings is not None


@pytest.mark.asyncio
async def test_get_next_invoice_number_organization(
    session: AsyncSession,
    organization: Organization,
    customer: Customer,
) -> None:
    organization.order_settings = {
        **organization.order_settings,
        "invoice_numbering": InvoiceNumbering.organization,
    }
    assert organization.customer_invoice_next_number == 1

    next_invoice_number = await organization_service.get_next_invoice_number(
        session, organization, customer
    )

    assert next_invoice_number == f"{organization.customer_invoice_prefix}-0001"
    assert organization.customer_invoice_next_number == 2

    await session.refresh(customer)
    assert customer.invoice_next_number == 1


@pytest.mark.asyncio
async def test_get_next_invoice_number_customer(
    session: AsyncSession,
    save_fixture: SaveFixture,
    organization: Organization,
    customer: Customer,
) -> None:
    organization.order_settings = {
        **organization.order_settings,
        "invoice_numbering": InvoiceNumbering.customer,
    }
    await save_fixture(organization)

    initial_org_counter = organization.customer_invoice_next_number
    assert customer.invoice_next_number == 1

    next_invoice_number = await organization_service.get_next_invoice_number(
        session, organization, customer
    )

    assert (
        next_invoice_number
        == f"{organization.customer_invoice_prefix}-{customer.short_id_str}-0001"
    )
    await session.flush()
    await session.refresh(customer)
    assert customer.invoice_next_number == 2

    await session.refresh(organization)
    assert organization.customer_invoice_next_number == initial_org_counter

    await session.refresh(customer)

    next_invoice_number = await organization_service.get_next_invoice_number(
        session, organization, customer
    )

    assert (
        next_invoice_number
        == f"{organization.customer_invoice_prefix}-{customer.short_id_str}-0002"
    )
    await session.flush()
    await session.refresh(customer)
    assert customer.invoice_next_number == 3


@pytest.mark.asyncio
async def test_get_next_invoice_number_multiple_customers(
    session: AsyncSession,
    save_fixture: SaveFixture,
    organization: Organization,
    customer: Customer,
) -> None:
    organization.order_settings = {
        **organization.order_settings,
        "invoice_numbering": InvoiceNumbering.customer,
    }
    await save_fixture(organization)

    customer2 = Customer(
        email="customer2@example.com",
        organization=organization,
        short_id=1,
    )
    session.add(customer2)

    invoice1 = await organization_service.get_next_invoice_number(
        session, organization, customer
    )
    assert (
        invoice1
        == f"{organization.customer_invoice_prefix}-{customer.short_id_str}-0001"
    )
    await session.flush()
    assert (
        invoice1
        == f"{organization.customer_invoice_prefix}-{customer.short_id_str}-0001"
    )

    invoice2 = await organization_service.get_next_invoice_number(
        session, organization, customer2
    )
    assert (
        invoice2
        == f"{organization.customer_invoice_prefix}-{customer2.short_id_str}-0001"
    )
    await session.flush()
    assert (
        invoice2
        == f"{organization.customer_invoice_prefix}-{customer2.short_id_str}-0001"
    )

    invoice3 = await organization_service.get_next_invoice_number(
        session, organization, customer
    )
    assert (
        invoice3
        == f"{organization.customer_invoice_prefix}-{customer.short_id_str}-0002"
    )
    await session.flush()
    assert (
        invoice3
        == f"{organization.customer_invoice_prefix}-{customer.short_id_str}-0002"
    )

    await session.refresh(customer)
    await session.refresh(customer2)
    assert customer.invoice_next_number == 3
    assert customer2.invoice_next_number == 2


@pytest.mark.asyncio
class TestCheckReviewThreshold:
    async def test_already_under_review(
        self,
        session: AsyncSession,
        organization: Organization,
    ) -> None:
        # Given organization already under review
        organization.status = OrganizationStatus.INITIAL_REVIEW
        organization.next_review_threshold = 1000

        # When
        result = await organization_service.check_review_threshold(
            session, organization
        )

        # Then
        assert result.status == OrganizationStatus.INITIAL_REVIEW

    async def test_below_review_threshold(
        self,
        mocker: MockerFixture,
        session: AsyncSession,
        organization: Organization,
    ) -> None:
        # Given organization below review threshold
        organization.status = OrganizationStatus.ACTIVE
        organization.next_review_threshold = 10000

        transaction_sum_mock = mocker.patch(
            "polar.organization.service.transaction_service.get_transactions_sum",
            return_value=5000,
        )

        # When
        result = await organization_service.check_review_threshold(
            session, organization
        )

        # Then
        assert result.status == OrganizationStatus.ACTIVE
        transaction_sum_mock.assert_called_once()

    async def test_initial_review(
        self,
        mocker: MockerFixture,
        session: AsyncSession,
        organization: Organization,
    ) -> None:
        # Given organization with review threshold set to 0
        organization.status = OrganizationStatus.ACTIVE
        organization.initially_reviewed_at = None
        organization.next_review_threshold = 0

        transaction_sum_mock = mocker.patch(
            "polar.organization.service.transaction_service.get_transactions_sum",
            return_value=5000,
        )

        # When
        result = await organization_service.check_review_threshold(
            session, organization
        )

        # Then
        assert result.status == OrganizationStatus.INITIAL_REVIEW
        transaction_sum_mock.assert_called_once()

    async def test_ongoing_review(
        self,
        mocker: MockerFixture,
        session: AsyncSession,
        organization: Organization,
    ) -> None:
        # Given organization above review threshold
        organization.status = OrganizationStatus.ACTIVE
        organization.initially_reviewed_at = datetime(2025, 1, 1, 12, 0, tzinfo=UTC)
        organization.next_review_threshold = 1000

        transaction_sum_mock = mocker.patch(
            "polar.organization.service.transaction_service.get_transactions_sum",
            return_value=5000,
        )
        enqueue_job_mock = mocker.patch("polar.organization.service.enqueue_job")

        # When
        result = await organization_service.check_review_threshold(
            session, organization
        )

        # Then
        assert result.status == OrganizationStatus.ONGOING_REVIEW
        transaction_sum_mock.assert_called_once()
        enqueue_job_mock.assert_called_once_with(
            "organization.under_review", organization_id=organization.id
        )


@pytest.mark.asyncio
class TestConfirmOrganizationReviewed:
    async def test_initial_review(
        self,
        mocker: MockerFixture,
        session: AsyncSession,
        organization: Organization,
    ) -> None:
        # Given organization under review
        organization.status = OrganizationStatus.INITIAL_REVIEW

        enqueue_job_mock = mocker.patch("polar.organization.service.enqueue_job")

        # When
        result = await organization_service.confirm_organization_reviewed(
            session, organization, 15000
        )

        # Then
        assert result.status == OrganizationStatus.ACTIVE
        assert result.initially_reviewed_at is not None
        assert result.next_review_threshold == 15000
        enqueue_job_mock.assert_called_once_with(
            "organization.reviewed",
            organization_id=organization.id,
            initial_review=True,
        )

    async def test_ongoing_review(
        self,
        mocker: MockerFixture,
        session: AsyncSession,
        organization: Organization,
    ) -> None:
        # Given organization under review
        organization.status = OrganizationStatus.ONGOING_REVIEW
        initially_reviewed_at = datetime(2025, 1, 1, 12, 0, tzinfo=UTC)
        organization.initially_reviewed_at = initially_reviewed_at

        enqueue_job_mock = mocker.patch("polar.organization.service.enqueue_job")

        # When
        result = await organization_service.confirm_organization_reviewed(
            session, organization, 15000
        )

        # Then
        assert result.status == OrganizationStatus.ACTIVE
        assert result.initially_reviewed_at == initially_reviewed_at
        assert result.next_review_threshold == 15000
        enqueue_job_mock.assert_called_once_with(
            "organization.reviewed",
            organization_id=organization.id,
            initial_review=False,
        )


@pytest.mark.asyncio
class TestDenyOrganization:
    async def test_deny_organization(
        self,
        session: AsyncSession,
        organization: Organization,
    ) -> None:
        # Given organization active
        organization.status = OrganizationStatus.ACTIVE

        # When
        result = await organization_service.deny_organization(session, organization)

        # Then
        assert result.status == OrganizationStatus.DENIED


@pytest.mark.asyncio
class TestSetOrganizationUnderReview:
    async def test_set_organization_under_review(
        self,
        mocker: MockerFixture,
        session: AsyncSession,
        organization: Organization,
    ) -> None:
        # Given organization active
        organization.status = OrganizationStatus.ACTIVE

        enqueue_job_mock = mocker.patch("polar.organization.service.enqueue_job")

        # When
        result = await organization_service.set_organization_under_review(
            session, organization
        )

        # Then
        assert result.status == OrganizationStatus.ONGOING_REVIEW
        enqueue_job_mock.assert_called_once_with(
            "organization.under_review", organization_id=organization.id
        )


@pytest.mark.asyncio
class TestGetPaymentStatus:
    async def test_all_steps_incomplete(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
    ) -> None:
        # Make this a new organization (not grandfathered)
        organization.created_at = datetime(2025, 8, 4, 12, 0, tzinfo=UTC)
        await save_fixture(organization)

        # Organization with no products, no API keys, and no account setup
        payment_status = await organization_service.get_payment_status(
            session, organization
        )

        assert payment_status.payment_ready is False
        assert len(payment_status.steps) == 3

        # Check each step
        create_product_step = next(
            s for s in payment_status.steps if s.id == "create_product"
        )
        assert create_product_step.completed is False

        integrate_checkout_step = next(
            s for s in payment_status.steps if s.id == "integrate_checkout"
        )
        assert integrate_checkout_step.completed is False

        setup_account_step = next(
            s for s in payment_status.steps if s.id == "setup_account"
        )
        assert setup_account_step.completed is False

    async def test_with_product_created(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
        product: Product,
    ) -> None:
        # Make this a new organization (not grandfathered)
        organization.created_at = datetime(2025, 8, 4, 12, 0, tzinfo=UTC)
        await save_fixture(organization)

        # Organization with a product but no API keys or account setup
        payment_status = await organization_service.get_payment_status(
            session, organization
        )

        assert payment_status.payment_ready is False

        create_product_step = next(
            s for s in payment_status.steps if s.id == "create_product"
        )
        assert create_product_step.completed is True

        integrate_checkout_step = next(
            s for s in payment_status.steps if s.id == "integrate_checkout"
        )
        assert integrate_checkout_step.completed is False

    async def test_with_api_key_created(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
        mocker: MockerFixture,
    ) -> None:
        # Make this a new organization (not grandfathered)
        organization.created_at = datetime(2025, 8, 4, 12, 0, tzinfo=UTC)
        await save_fixture(organization)

        # Mock the API key count
        mocker.patch(
            "polar.organization_access_token.repository.OrganizationAccessTokenRepository.count_by_organization_id",
            return_value=1,  # Has 1 API key
        )

        # Organization with an API key but no products or account setup
        payment_status = await organization_service.get_payment_status(
            session, organization
        )

        assert payment_status.payment_ready is False

        create_product_step = next(
            s for s in payment_status.steps if s.id == "create_product"
        )
        assert create_product_step.completed is False

        integrate_checkout_step = next(
            s for s in payment_status.steps if s.id == "integrate_checkout"
        )
        assert integrate_checkout_step.completed is True

    async def test_with_account_setup_complete(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
        user: User,
    ) -> None:
        # Make this a new organization (not grandfathered)
        organization.created_at = datetime(2025, 8, 4, 12, 0, tzinfo=UTC)

        user.identity_verification_status = IdentityVerificationStatus.verified
        await save_fixture(user)

        account = Account(
            account_type=AccountType.stripe,
            admin_id=user.id,
            country="US",
            currency="USD",
            is_details_submitted=True,
            is_charges_enabled=True,
            is_payouts_enabled=True,
            stripe_id="STRIPE_ACCOUNT_ID",
        )
        await save_fixture(account)

        organization.account = account
        organization.account_id = account.id
        organization.details_submitted_at = datetime.now(UTC)
        organization.details = {"about": "Test"}  # type: ignore
        await save_fixture(organization)

        # Ensure relationships are loaded
        await session.refresh(organization, attribute_names=["account"])
        await session.refresh(organization.account, attribute_names=["admin"])

        payment_status = await organization_service.get_payment_status(
            session, organization
        )

        # Still not payment ready without products and API key
        assert payment_status.payment_ready is False

        setup_account_step = next(
            s for s in payment_status.steps if s.id == "setup_account"
        )
        assert setup_account_step.completed is True

    async def test_all_steps_complete_grandfathered(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
        product: Product,
        mocker: MockerFixture,
        user: User,
    ) -> None:
        # Grandfathered organization (created before cutoff)
        organization.created_at = datetime(2025, 8, 4, 8, 0, tzinfo=UTC)
        await save_fixture(organization)

        # Mock the API key count
        mocker.patch(
            "polar.organization_access_token.repository.OrganizationAccessTokenRepository.count_by_organization_id",
            return_value=1,  # Has 1 API key
        )

        payment_status = await organization_service.get_payment_status(
            session, organization
        )

        # Should be payment ready because it's grandfathered
        assert payment_status.payment_ready is True

    async def test_all_steps_complete_new_org(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
        product: Product,
        mocker: MockerFixture,
        user: User,
    ) -> None:
        # Set up as new organization
        organization.created_at = datetime(2025, 8, 4, 12, 0, tzinfo=UTC)
        organization.status = OrganizationStatus.ACTIVE
        organization.details_submitted_at = datetime.now(UTC)
        organization.details = {"about": "Test"}  # type: ignore

        # Set up user verification
        user.identity_verification_status = IdentityVerificationStatus.verified
        await save_fixture(user)

        # Set up account
        account = Account(
            account_type=AccountType.stripe,
            admin_id=user.id,
            country="US",
            currency="USD",
            is_details_submitted=True,
            is_charges_enabled=True,
            is_payouts_enabled=True,
            stripe_id="STRIPE_ACCOUNT_ID",
        )
        await save_fixture(account)

        organization.account = account
        organization.account_id = account.id
        await save_fixture(organization)

        # Ensure relationships are loaded
        await session.refresh(organization, attribute_names=["account"])
        await session.refresh(organization.account, attribute_names=["admin"])

        # Mock the API key count
        mocker.patch(
            "polar.organization_access_token.repository.OrganizationAccessTokenRepository.count_by_organization_id",
            return_value=1,  # Has 1 API key
        )

        payment_status = await organization_service.get_payment_status(
            session, organization
        )

        # Should be payment ready with all steps complete
        assert payment_status.payment_ready is True
        assert all(step.completed for step in payment_status.steps)

    async def test_sandbox_environment_allows_payments(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
        mocker: MockerFixture,
    ) -> None:
        # Make organization not payment ready (new org without account setup)
        organization.created_at = datetime(2025, 8, 4, 12, 0, tzinfo=UTC)
        organization.status = OrganizationStatus.CREATED
        organization.account_id = None
        await save_fixture(organization)

        # Mock environment to be sandbox
        mocker.patch("polar.organization.service.settings.ENV", Environment.sandbox)

        payment_status = await organization_service.get_payment_status(
            session, organization
        )

        # Should be payment ready in sandbox even if account setup is incomplete
        assert payment_status.payment_ready is True


@pytest.mark.asyncio
class TestValidateWithAI:
    """Test AI validation integration in OrganizationService."""

    @patch("polar.organization.ai_validation._fetch_policy_content")
    async def test_validate_with_ai_success(
        self,
        mock_fetch_policy: MagicMock,
        session: AsyncSession,
        organization: Organization,
    ) -> None:
        """Test successful AI validation through service layer."""
        # Given
        mock_fetch_policy.return_value = "Mock policy content"
        organization.details = {"description": "A test software company"}  # type: ignore[assignment]
        session.add(organization)
        await session.flush()

        # When
        validator = OrganizationAIValidator()
        with validator.agent.override(model=TestModel()):
            with patch("polar.organization.service.organization_validator", validator):
                result = await organization_service.validate_with_ai(
                    session, organization
                )

        # Then
        assert isinstance(result, OrganizationReview)
        assert result.verdict in ["PASS", "FAIL", "UNCERTAIN"]
        assert isinstance(result.risk_score, float)
        assert 0 <= result.risk_score <= 100
        assert result.timed_out is False
        assert isinstance(result.violated_sections, list)
        assert isinstance(result.reason, str)

        # Verify database record was created
        db_records = await session.execute(
            select(OrganizationReview).where(
                OrganizationReview.organization_id == organization.id
            )
        )
        db_record = db_records.scalar_one_or_none()

        assert db_record is not None
        assert db_record.verdict == result.verdict
        assert db_record.risk_score == result.risk_score
        assert db_record.organization_id == organization.id
        assert db_record.organization_details_snapshot is not None

    @patch("polar.organization.ai_validation._fetch_policy_content")
    async def test_validate_with_ai_fail_verdict(
        self,
        mock_fetch_policy: MagicMock,
        session: AsyncSession,
        organization: Organization,
    ) -> None:
        """Test AI validation flow works with TestModel."""
        # Given
        mock_fetch_policy.return_value = "Mock policy content"
        organization.details = {"description": "A test software company"}  # type: ignore[assignment]
        session.add(organization)
        await session.flush()

        # When
        validator = OrganizationAIValidator()
        with validator.agent.override(model=TestModel()):
            with patch("polar.organization.service.organization_validator", validator):
                result = await organization_service.validate_with_ai(
                    session, organization
                )

        # Then - TestModel provides structured responses, verify format
        assert isinstance(result, OrganizationReview)
        assert result.verdict in ["PASS", "FAIL", "UNCERTAIN"]
        assert isinstance(result.risk_score, float)
        assert 0 <= result.risk_score <= 100
        assert isinstance(result.violated_sections, list)
        assert isinstance(result.reason, str)

        # Verify database storage
        db_records = await session.execute(
            select(OrganizationReview).where(
                OrganizationReview.organization_id == organization.id
            )
        )
        db_record = db_records.scalar_one_or_none()

        assert db_record is not None
        assert db_record.verdict == result.verdict
        assert db_record.violated_sections == result.violated_sections

    @patch("polar.organization.ai_validation._fetch_policy_content")
    async def test_validate_with_ai_timeout(
        self,
        mock_fetch_policy: MagicMock,
        session: AsyncSession,
        organization: Organization,
    ) -> None:
        """Test AI validation timeout handling."""
        # Given
        mock_fetch_policy.return_value = "Mock policy content"
        organization.details = {"description": "A test software company"}  # type: ignore[assignment]
        session.add(organization)
        await session.flush()

        # When - simulate timeout with very short timeout
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
                    result = await organization_service.validate_with_ai(
                        session, organization
                    )

        # Then
        assert result.timed_out is True
        assert result.verdict == "UNCERTAIN"
        assert "timed out" in result.reason.lower()

        # Verify timeout flag stored in database
        db_records = await session.execute(
            select(OrganizationReview).where(
                OrganizationReview.organization_id == organization.id
            )
        )
        db_record = db_records.scalar_one_or_none()

        assert db_record is not None
        assert db_record.timed_out is True

    async def test_validate_with_ai_validator_exception(
        self, session: AsyncSession, organization: Organization
    ) -> None:
        """Test AI validation handles validator exceptions."""
        # Given
        organization.details = {"description": "A test software company"}  # type: ignore[assignment]
        session.add(organization)
        await session.flush()

        # When - simulate an error
        validator = OrganizationAIValidator()
        with patch.object(validator, "validate_organization_details") as mock_validate:
            mock_validate.side_effect = Exception("AI service error")

            with patch("polar.organization.service.organization_validator", validator):
                # Should raise the exception (service doesn't handle validator errors)
                with pytest.raises(Exception, match="AI service error"):
                    await organization_service.validate_with_ai(session, organization)

        # Then - verify no database record was created
        db_records = await session.execute(
            select(OrganizationReview).where(
                OrganizationReview.organization_id == organization.id
            )
        )
        db_record = db_records.scalar_one_or_none()

        assert db_record is None

    @patch("polar.organization.ai_validation._fetch_policy_content")
    async def test_validate_with_ai_organization_snapshot(
        self, mock_fetch_policy: MagicMock, session: AsyncSession
    ) -> None:
        """Test organization details snapshot is stored correctly."""
        # Given
        mock_fetch_policy.return_value = "Mock policy content"

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
        await session.flush()

        # When
        validator = OrganizationAIValidator()
        with validator.agent.override(model=TestModel()):
            with patch("polar.organization.service.organization_validator", validator):
                result = await organization_service.validate_with_ai(session, org)

        # Then - verify snapshot contains expected data
        db_records = await session.execute(
            select(OrganizationReview).where(
                OrganizationReview.organization_id == org.id
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

    @patch("polar.organization.ai_validation._fetch_policy_content")
    async def test_validate_with_ai_multiple_validations(
        self,
        mock_fetch_policy: MagicMock,
        session: AsyncSession,
        organization: Organization,
    ) -> None:
        """Test multiple AI validations for the same organization."""
        # Given
        mock_fetch_policy.return_value = "Mock policy content"
        organization.details = {"description": "A test software company"}  # type: ignore[assignment]
        session.add(organization)
        await session.flush()

        # When
        validator = OrganizationAIValidator()
        with validator.agent.override(model=TestModel()):
            with patch("polar.organization.service.organization_validator", validator):
                # First validation
                result1 = await organization_service.validate_with_ai(
                    session, organization
                )
                assert isinstance(result1, OrganizationReview)

                # Second validation should return the same cached result
                result2 = await organization_service.validate_with_ai(
                    session, organization
                )
                assert isinstance(result2, OrganizationReview)
                assert result1.id == result2.id  # Should be same record

        # Then - verify only one record exists (cached behavior)
        db_records = await session.execute(
            select(OrganizationReview)
            .where(OrganizationReview.organization_id == organization.id)
            .order_by(OrganizationReview.created_at)
        )
        records = db_records.scalars().all()

        assert len(records) == 1
        # Record should have valid verdict
        assert records[0].verdict in ["PASS", "FAIL", "UNCERTAIN"]


@pytest.mark.asyncio
class TestSetAccount:
    @pytest.mark.auth
    async def test_first_account_setup_by_any_member(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
        user: User,
        auth_subject: AuthSubject[User],
    ) -> None:
        """Test that any member can set up the first account."""
        # Ensure organization has no account initially
        organization.account_id = None
        await save_fixture(organization)

        # Create an account
        account = Account(
            account_type=AccountType.stripe,
            admin_id=user.id,
            country="US",
            currency="USD",
            is_details_submitted=True,
            is_charges_enabled=True,
            is_payouts_enabled=True,
            stripe_id="STRIPE_ACCOUNT_ID",
        )
        await save_fixture(account)

        # First account setup should succeed
        updated_organization = await organization_service.set_account(
            session, auth_subject, organization, account.id
        )

        assert updated_organization.account_id == account.id

    @pytest.mark.auth
    async def test_account_change_fails(
        self,
        session: AsyncSession,
        auth_subject: AuthSubject[User],
        save_fixture: SaveFixture,
        organization: Organization,
        user: User,
    ) -> None:
        initial_account = Account(
            account_type=AccountType.stripe,
            admin_id=user.id,
            country="US",
            currency="USD",
            is_details_submitted=True,
            is_charges_enabled=True,
            is_payouts_enabled=True,
            stripe_id="INITIAL_ACCOUNT_ID",
        )
        await save_fixture(initial_account)

        organization.account_id = initial_account.id
        await save_fixture(organization)

        # Create a new account
        new_account = Account(
            account_type=AccountType.stripe,
            admin_id=user.id,
            country="US",
            currency="USD",
            is_details_submitted=True,
            is_charges_enabled=True,
            is_payouts_enabled=True,
            stripe_id="NEW_ACCOUNT_ID",
        )
        await save_fixture(new_account)

        with pytest.raises(AccountAlreadySet) as exc_info:
            await organization_service.set_account(
                session, auth_subject, organization, new_account.id
            )

        assert "already been set up" in str(exc_info.value)


@pytest.mark.asyncio
class TestSubmitAppeal:
    async def test_submit_appeal_success(
        self,
        mocker: MockerFixture,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
    ) -> None:
        review = OrganizationReview(
            organization_id=organization.id,
            verdict=OrganizationReview.Verdict.FAIL,
            risk_score=85.0,
            violated_sections=["human_resources"],
            reason="Policy violation detected",
            model_used="test-model",
            organization_details_snapshot={"name": organization.name},
        )
        await save_fixture(review)

        mock_plain_service = mocker.patch(
            "polar.organization.service.plain_service.create_appeal_review_thread"
        )

        appeal_reason = "We selling templates and not consultancy services"
        result = await organization_service.submit_appeal(
            session, organization, appeal_reason
        )

        assert result.appeal_submitted_at is not None
        assert result.appeal_reason == appeal_reason
        mock_plain_service.assert_called_once_with(session, organization, result)

    async def test_submit_appeal_no_review_exists(
        self, session: AsyncSession, organization: Organization
    ) -> None:
        with pytest.raises(ValueError, match="Organization must have a review"):
            await organization_service.submit_appeal(
                session, organization, "Appeal reason"
            )

    async def test_submit_appeal_passed_review(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
    ) -> None:
        review = OrganizationReview(
            organization_id=organization.id,
            verdict=OrganizationReview.Verdict.PASS,
            risk_score=25.0,
            violated_sections=[],
            reason="No issues found",
            model_used="test-model",
            organization_details_snapshot={"name": organization.name},
        )
        await save_fixture(review)

        with pytest.raises(
            ValueError, match="Cannot submit appeal for a passed review"
        ):
            await organization_service.submit_appeal(
                session, organization, "Appeal reason"
            )

    async def test_submit_appeal_already_submitted(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
    ) -> None:
        review = OrganizationReview(
            organization_id=organization.id,
            verdict=OrganizationReview.Verdict.FAIL,
            risk_score=85.0,
            violated_sections=["terms_of_service"],
            reason="Policy violation detected",
            model_used="test-model",
            organization_details_snapshot={"name": organization.name},
            appeal_submitted_at=datetime.now(UTC),
            appeal_reason="Previous appeal",
        )
        await save_fixture(review)

        with pytest.raises(
            ValueError, match="Appeal has already been submitted for this organization"
        ):
            await organization_service.submit_appeal(
                session, organization, "New appeal reason"
            )

    async def test_submit_appeal_plain_service_called(
        self,
        mocker: MockerFixture,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
    ) -> None:
        review = OrganizationReview(
            organization_id=organization.id,
            verdict=OrganizationReview.Verdict.UNCERTAIN,
            risk_score=50.0,
            violated_sections=[],
            reason="Manual review required",
            model_used="test-model",
            organization_details_snapshot={"name": organization.name},
        )
        await save_fixture(review)

        mock_plain_service = mocker.patch(
            "polar.organization.service.plain_service.create_appeal_review_thread"
        )

        result = await organization_service.submit_appeal(
            session, organization, "Please review again"
        )

        mock_plain_service.assert_called_once_with(session, organization, result)


@pytest.mark.asyncio
class TestApproveAppeal:
    async def test_approve_appeal_success(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
    ) -> None:
        organization.status = OrganizationStatus.INITIAL_REVIEW
        review = OrganizationReview(
            organization_id=organization.id,
            verdict=OrganizationReview.Verdict.FAIL,
            risk_score=85.0,
            violated_sections=["terms_of_service"],
            reason="Policy violation detected",
            model_used="test-model",
            organization_details_snapshot={"name": organization.name},
            appeal_submitted_at=datetime.now(UTC),
            appeal_reason="We have fixed the issues",
        )
        await save_fixture(review)

        result = await organization_service.approve_appeal(session, organization)

        assert organization.status == OrganizationStatus.ACTIVE
        assert result.appeal_decision == OrganizationReview.AppealDecision.APPROVED
        assert result.appeal_reviewed_at is not None

    async def test_approve_appeal_no_review_exists(
        self, session: AsyncSession, organization: Organization
    ) -> None:
        with pytest.raises(ValueError, match="Organization must have a review"):
            await organization_service.approve_appeal(session, organization)

    async def test_approve_appeal_no_appeal_submitted(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
    ) -> None:
        review = OrganizationReview(
            organization_id=organization.id,
            verdict=OrganizationReview.Verdict.FAIL,
            risk_score=85.0,
            violated_sections=["terms_of_service"],
            reason="Policy violation detected",
            model_used="test-model",
            organization_details_snapshot={"name": organization.name},
        )
        await save_fixture(review)

        with pytest.raises(
            ValueError, match="No appeal has been submitted for this organization"
        ):
            await organization_service.approve_appeal(session, organization)

    async def test_approve_appeal_already_reviewed(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
    ) -> None:
        review = OrganizationReview(
            organization_id=organization.id,
            verdict=OrganizationReview.Verdict.FAIL,
            risk_score=85.0,
            violated_sections=["terms_of_service"],
            reason="Policy violation detected",
            model_used="test-model",
            organization_details_snapshot={"name": organization.name},
            appeal_submitted_at=datetime.now(UTC),
            appeal_reason="We have fixed the issues",
            appeal_decision=OrganizationReview.AppealDecision.REJECTED,
            appeal_reviewed_at=datetime.now(UTC),
        )
        await save_fixture(review)

        with pytest.raises(ValueError, match="Appeal has already been reviewed"):
            await organization_service.approve_appeal(session, organization)


@pytest.mark.asyncio
class TestDenyAppeal:
    async def test_deny_appeal_success(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
    ) -> None:
        review = OrganizationReview(
            organization_id=organization.id,
            verdict=OrganizationReview.Verdict.FAIL,
            risk_score=85.0,
            violated_sections=["terms_of_service"],
            reason="Policy violation detected",
            model_used="test-model",
            organization_details_snapshot={"name": organization.name},
            appeal_submitted_at=datetime.now(UTC),
            appeal_reason="We have fixed the issues",
        )
        await save_fixture(review)

        result = await organization_service.deny_appeal(session, organization)

        assert result.appeal_decision == OrganizationReview.AppealDecision.REJECTED
        assert result.appeal_reviewed_at is not None

    async def test_deny_appeal_no_review_exists(
        self, session: AsyncSession, organization: Organization
    ) -> None:
        with pytest.raises(ValueError, match="Organization must have a review"):
            await organization_service.deny_appeal(session, organization)

    async def test_deny_appeal_no_appeal_submitted(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
    ) -> None:
        review = OrganizationReview(
            organization_id=organization.id,
            verdict=OrganizationReview.Verdict.FAIL,
            risk_score=85.0,
            violated_sections=["terms_of_service"],
            reason="Policy violation detected",
            model_used="test-model",
            organization_details_snapshot={"name": organization.name},
        )
        await save_fixture(review)

        with pytest.raises(
            ValueError, match="No appeal has been submitted for this organization"
        ):
            await organization_service.deny_appeal(session, organization)

    async def test_deny_appeal_already_reviewed(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
    ) -> None:
        review = OrganizationReview(
            organization_id=organization.id,
            verdict=OrganizationReview.Verdict.FAIL,
            risk_score=85.0,
            violated_sections=["terms_of_service"],
            reason="Policy violation detected",
            model_used="test-model",
            organization_details_snapshot={"name": organization.name},
            appeal_submitted_at=datetime.now(UTC),
            appeal_reason="We have fixed the issues",
            appeal_decision=OrganizationReview.AppealDecision.APPROVED,
            appeal_reviewed_at=datetime.now(UTC),
        )
        await save_fixture(review)

        with pytest.raises(ValueError, match="Appeal has already been reviewed"):
            await organization_service.deny_appeal(session, organization)


@pytest.mark.asyncio
class TestCheckCanDelete:
    async def test_can_delete_no_activity(
        self,
        session: AsyncSession,
        organization: Organization,
    ) -> None:
        """Organization with no orders and no subscriptions can be deleted."""
        result = await organization_service.check_can_delete(session, organization)

        assert result.can_delete_immediately is True
        assert result.blocked_reasons == []

    async def test_blocked_with_orders(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
        customer: Customer,
    ) -> None:
        """Organization with orders cannot be immediately deleted."""
        from tests.fixtures.random_objects import create_order

        await create_order(save_fixture, customer=customer)

        result = await organization_service.check_can_delete(session, organization)

        assert result.can_delete_immediately is False
        assert "has_orders" in [r.value for r in result.blocked_reasons]

    async def test_blocked_with_active_subscriptions(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
        product: Product,
        customer: Customer,
    ) -> None:
        """Organization with active subscriptions cannot be immediately deleted."""
        from polar.models.subscription import SubscriptionStatus
        from tests.fixtures.random_objects import create_subscription

        await create_subscription(
            save_fixture,
            product=product,
            customer=customer,
            status=SubscriptionStatus.active,
        )

        result = await organization_service.check_can_delete(session, organization)

        assert result.can_delete_immediately is False
        assert "has_active_subscriptions" in [r.value for r in result.blocked_reasons]

    async def test_not_blocked_with_canceled_subscriptions(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
        product: Product,
        customer: Customer,
    ) -> None:
        """Organization with canceled subscriptions can be deleted."""
        from polar.models.subscription import SubscriptionStatus
        from tests.fixtures.random_objects import create_subscription

        await create_subscription(
            save_fixture,
            product=product,
            customer=customer,
            status=SubscriptionStatus.canceled,
        )

        result = await organization_service.check_can_delete(session, organization)

        assert result.can_delete_immediately is True
        assert result.blocked_reasons == []


@pytest.mark.asyncio
class TestRequestDeletion:
    @pytest.mark.auth
    async def test_immediate_deletion_no_activity(
        self,
        mocker: MockerFixture,
        session: AsyncSession,
        auth_subject: AuthSubject[User],
        organization: Organization,
    ) -> None:
        """Organization with no activity is immediately deleted."""
        enqueue_job_mock = mocker.patch("polar.organization.service.enqueue_job")

        result = await organization_service.request_deletion(
            session, auth_subject, organization
        )

        assert result.can_delete_immediately is True
        assert organization.deleted_at is not None
        # No job should be enqueued for immediate deletion
        enqueue_job_mock.assert_not_called()

    @pytest.mark.auth
    async def test_blocked_creates_support_ticket(
        self,
        mocker: MockerFixture,
        session: AsyncSession,
        save_fixture: SaveFixture,
        auth_subject: AuthSubject[User],
        organization: Organization,
        customer: Customer,
    ) -> None:
        """Organization with orders creates support ticket."""
        from tests.fixtures.random_objects import create_order

        await create_order(save_fixture, customer=customer)

        enqueue_job_mock = mocker.patch("polar.organization.service.enqueue_job")

        result = await organization_service.request_deletion(
            session, auth_subject, organization
        )

        assert result.can_delete_immediately is False
        assert organization.deleted_at is None
        enqueue_job_mock.assert_called_once_with(
            "organization.deletion_requested",
            organization_id=organization.id,
            user_id=auth_subject.subject.id,
            blocked_reasons=["has_orders"],
        )

    @pytest.mark.auth
    async def test_with_account_deletes_stripe_account(
        self,
        mocker: MockerFixture,
        session: AsyncSession,
        save_fixture: SaveFixture,
        auth_subject: AuthSubject[User],
        organization: Organization,
        user: User,
    ) -> None:
        """Organization with account deletes Stripe account first."""
        account = Account(
            account_type=AccountType.stripe,
            admin_id=user.id,
            country="US",
            currency="USD",
            is_details_submitted=True,
            is_charges_enabled=True,
            is_payouts_enabled=True,
            stripe_id="STRIPE_ACCOUNT_ID",
        )
        await save_fixture(account)

        organization.account = account
        organization.account_id = account.id
        await save_fixture(organization)

        # Mock Stripe account deletion
        mock_delete_stripe = mocker.patch(
            "polar.account.service.AccountService.delete_stripe_account"
        )
        mock_delete_account = mocker.patch(
            "polar.account.service.AccountService.delete"
        )

        result = await organization_service.request_deletion(
            session, auth_subject, organization
        )

        assert result.can_delete_immediately is True
        assert organization.deleted_at is not None
        mock_delete_stripe.assert_called_once()
        mock_delete_account.assert_called_once()

    @pytest.mark.auth
    async def test_stripe_deletion_failure_creates_ticket(
        self,
        mocker: MockerFixture,
        session: AsyncSession,
        save_fixture: SaveFixture,
        auth_subject: AuthSubject[User],
        organization: Organization,
        user: User,
    ) -> None:
        """Stripe account deletion failure creates support ticket."""
        account = Account(
            account_type=AccountType.stripe,
            admin_id=user.id,
            country="US",
            currency="USD",
            is_details_submitted=True,
            is_charges_enabled=True,
            is_payouts_enabled=True,
            stripe_id="STRIPE_ACCOUNT_ID",
        )
        await save_fixture(account)

        organization.account = account
        organization.account_id = account.id
        await save_fixture(organization)

        # Mock Stripe account deletion to fail
        mocker.patch(
            "polar.account.service.AccountService.delete_stripe_account",
            side_effect=Exception("Stripe deletion failed"),
        )
        enqueue_job_mock = mocker.patch("polar.organization.service.enqueue_job")

        result = await organization_service.request_deletion(
            session, auth_subject, organization
        )

        assert result.can_delete_immediately is False
        assert "stripe_account_deletion_failed" in [
            r.value for r in result.blocked_reasons
        ]
        assert organization.deleted_at is None
        enqueue_job_mock.assert_called_once()

    @pytest.mark.auth
    async def test_non_admin_with_account_raises_not_permitted(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        auth_subject: AuthSubject[User],
        organization: Organization,
    ) -> None:
        """Non-admin cannot delete organization with an account."""
        from polar.exceptions import NotPermitted

        # Create a different user who is the admin
        other_user = User(email="admin@example.com")
        await save_fixture(other_user)

        account = Account(
            account_type=AccountType.stripe,
            admin_id=other_user.id,  # Different admin than auth_subject
            country="US",
            currency="USD",
            is_details_submitted=True,
            is_charges_enabled=True,
            is_payouts_enabled=True,
            stripe_id="STRIPE_ACCOUNT_ID",
        )
        await save_fixture(account)

        organization.account = account
        organization.account_id = account.id
        await save_fixture(organization)

        with pytest.raises(NotPermitted) as exc_info:
            await organization_service.request_deletion(
                session, auth_subject, organization
            )

        assert "account admin" in str(exc_info.value).lower()

    @pytest.mark.auth
    async def test_any_member_can_delete_without_account(
        self,
        mocker: MockerFixture,
        session: AsyncSession,
        auth_subject: AuthSubject[User],
        organization: Organization,
    ) -> None:
        """Any organization member can delete when there's no account."""
        # Ensure no account is set
        assert organization.account_id is None

        mocker.patch("polar.organization.service.enqueue_job")

        result = await organization_service.request_deletion(
            session, auth_subject, organization
        )

        assert result.can_delete_immediately is True


@pytest.mark.asyncio
class TestSoftDeleteOrganization:
    async def test_anonymizes_pii_preserves_slug(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
    ) -> None:
        """Soft delete anonymizes PII but preserves slug."""
        original_slug = organization.slug
        organization.name = "Test Organization"
        organization.email = "test@example.com"
        organization.website = "https://test.com"
        organization.bio = "Test bio"
        organization.avatar_url = "https://example.com/avatar.png"
        await save_fixture(organization)

        result = await organization_service.soft_delete_organization(
            session, organization
        )

        # Slug should be preserved
        assert result.slug == original_slug

        # PII should be anonymized
        assert result.name != "Test Organization"
        assert result.email != "test@example.com"
        assert result.website != "https://test.com"
        assert result.bio != "Test bio"

        # Avatar should be set to Polar logo
        assert result.avatar_url is not None
        assert "avatars.githubusercontent.com" in result.avatar_url

        # Should be soft deleted
        assert result.deleted_at is not None

    async def test_clears_details_and_socials(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
    ) -> None:
        """Soft delete clears details and socials."""
        organization.details = {"about": "Test company"}  # type: ignore[assignment]
        organization.socials = [
            {"platform": "twitter", "url": "https://twitter.com/test"}
        ]
        await save_fixture(organization)

        result = await organization_service.soft_delete_organization(
            session, organization
        )

        assert result.details == {}  # type: ignore[comparison-overlap]
        assert result.socials == []
