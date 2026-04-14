import uuid
from datetime import UTC, datetime
from unittest.mock import call

import pytest
from pydantic import ValidationError
from pytest_mock import MockerFixture

from polar.auth.models import AuthSubject
from polar.config import Environment, settings
from polar.enums import (
    InvoiceNumbering,
    PayoutAccountType,
    SubscriptionRecurringInterval,
)
from polar.exceptions import PolarRequestValidationError
from polar.models import Customer, Organization, Product, User
from polar.models.account import Account
from polar.models.organization import (
    OrganizationNotificationSettings,
    OrganizationStatus,
)
from polar.models.organization_review import OrganizationReview
from polar.organization.schemas import (
    OrganizationCreate,
    OrganizationFeatureSettings,
    OrganizationUpdate,
)
from polar.organization.service import organization as organization_service
from polar.organization_review.schemas import ReviewVerdict
from polar.postgres import AsyncSession
from polar.user_organization.service import (
    user_organization as user_organization_service,
)
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import (
    create_account,
    create_order,
    create_payout_account,
)


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
        assert organization.feature_settings == {
            "member_model_enabled": True,
            "seat_based_pricing_enabled": True,
        }

        user_organization = await user_organization_service.get_by_user_and_org(
            session, auth_subject.subject.id, organization.id
        )
        assert user_organization is not None

        enqueue_job_mock.assert_called_once_with(
            "organization.created", organization_id=organization.id
        )

    @pytest.mark.auth
    async def test_enqueues_polar_self_customer_before_initial_member(
        self,
        mocker: MockerFixture,
        auth_subject: AuthSubject[User],
        session: AsyncSession,
    ) -> None:
        polar_self_manager = mocker.MagicMock()
        create_customer_mock = mocker.patch(
            "polar.organization.service.polar_self_service.enqueue_create_customer"
        )
        polar_self_manager.attach_mock(create_customer_mock, "enqueue_create_customer")
        add_member_mock = mocker.patch(
            "polar.organization.service.polar_self_service.enqueue_add_member"
        )
        polar_self_manager.attach_mock(add_member_mock, "enqueue_add_member")

        organization = await organization_service.create(
            session,
            OrganizationCreate(name="My New Organization", slug="signup-race-test"),
            auth_subject,
        )

        create_customer_mock.assert_called_once_with(
            organization_id=organization.id,
            email=organization.email or auth_subject.subject.email,
            name=organization.name,
        )
        add_member_mock.assert_called_once_with(
            external_customer_id=str(organization.id),
            email=auth_subject.subject.email,
            name=auth_subject.subject.public_name,
            external_id=str(auth_subject.subject.id),
            delay=1000,
        )
        assert polar_self_manager.mock_calls == [
            call.enqueue_create_customer(
                organization_id=organization.id,
                email=organization.email or auth_subject.subject.email,
                name=organization.name,
            ),
            call.enqueue_add_member(
                external_customer_id=str(organization.id),
                email=auth_subject.subject.email,
                name=auth_subject.subject.public_name,
                external_id=str(auth_subject.subject.id),
                delay=1000,
            ),
        ]

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

        assert organization.feature_settings == {
            "issue_funding_enabled": False,
            "member_model_enabled": True,
            "seat_based_pricing_enabled": True,
        }

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
    async def test_already_under_review_still_updates_total_balance(
        self,
        mocker: MockerFixture,
        session: AsyncSession,
        organization: Organization,
    ) -> None:
        # Given organization already under review
        organization.status = OrganizationStatus.REVIEW
        organization.next_review_threshold = 1000
        organization.total_balance = None

        mocker.patch(
            "polar.organization.service.transaction_service.get_transactions_sum",
            return_value=7500,
        )

        # When
        result = await organization_service.check_review_threshold(
            session, organization
        )

        # Then - status unchanged but total_balance is updated
        assert result.status == OrganizationStatus.REVIEW
        assert result.total_balance == 7500

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
        assert result.total_balance == 5000
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
        assert result.status == OrganizationStatus.REVIEW
        assert result.total_balance == 5000
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
        assert result.status == OrganizationStatus.REVIEW
        assert result.total_balance == 5000
        transaction_sum_mock.assert_called_once()
        enqueue_job_mock.assert_called_once_with(
            "organization.under_review", organization_id=organization.id
        )

    async def test_total_balance_zero(
        self,
        mocker: MockerFixture,
        session: AsyncSession,
        organization: Organization,
    ) -> None:
        # Given organization with no transactions
        organization.status = OrganizationStatus.ACTIVE
        organization.next_review_threshold = 10000
        organization.total_balance = None

        mocker.patch(
            "polar.organization.service.transaction_service.get_transactions_sum",
            return_value=0,
        )

        # When
        result = await organization_service.check_review_threshold(
            session, organization
        )

        # Then
        assert result.status == OrganizationStatus.ACTIVE
        assert result.total_balance == 0


@pytest.mark.asyncio
class TestConfirmOrganizationReviewed:
    async def test_initial_review(
        self,
        mocker: MockerFixture,
        session: AsyncSession,
        organization: Organization,
    ) -> None:
        # Given organization under review
        organization.status = OrganizationStatus.REVIEW

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
            silent=False,
        )

    async def test_initial_review_silent(
        self,
        mocker: MockerFixture,
        session: AsyncSession,
        organization: Organization,
    ) -> None:
        # Given organization under review
        organization.status = OrganizationStatus.REVIEW

        enqueue_job_mock = mocker.patch("polar.organization.service.enqueue_job")

        # When
        result = await organization_service.confirm_organization_reviewed(
            session, organization, 15000, silent=True
        )

        # Then
        assert result.status == OrganizationStatus.ACTIVE
        assert result.initially_reviewed_at is not None
        assert result.next_review_threshold == 15000
        enqueue_job_mock.assert_called_once_with(
            "organization.reviewed",
            organization_id=organization.id,
            initial_review=True,
            silent=True,
        )

    async def test_ongoing_review(
        self,
        mocker: MockerFixture,
        session: AsyncSession,
        organization: Organization,
    ) -> None:
        # Given organization under review
        organization.status = OrganizationStatus.REVIEW
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
            silent=False,
        )

    async def test_overrides_rejected_appeal(
        self,
        mocker: MockerFixture,
        session: AsyncSession,
        organization: Organization,
    ) -> None:
        # Given: org denied with a rejected appeal
        organization.status = OrganizationStatus.DENIED
        organization.initially_reviewed_at = datetime(2025, 1, 1, 12, 0, tzinfo=UTC)

        review = OrganizationReview(
            organization_id=organization.id,
            verdict=OrganizationReview.Verdict.FAIL,
            risk_score=80.0,
            violated_sections=["tos"],
            reason="Violation",
            model_used="test",
            appeal_submitted_at=datetime(2025, 2, 1, tzinfo=UTC),
            appeal_reason="Please reconsider",
            appeal_decision=OrganizationReview.AppealDecision.REJECTED,
            appeal_reviewed_at=datetime(2025, 2, 2, tzinfo=UTC),
        )
        session.add(review)
        await session.flush()

        mocker.patch("polar.organization.service.enqueue_job")

        # When: operator manually approves the org
        result = await organization_service.confirm_organization_reviewed(
            session, organization, 15000
        )

        # Then: appeal decision is overridden to approved
        assert result.status == OrganizationStatus.ACTIVE
        assert review.appeal_decision == OrganizationReview.AppealDecision.APPROVED
        assert review.appeal_reviewed_at is not None


@pytest.mark.asyncio
class TestHandleOngoingReviewVerdict:
    async def test_auto_approve_on_approve_verdict(
        self,
        mocker: MockerFixture,
        session: AsyncSession,
        organization: Organization,
    ) -> None:
        # Given: org is REVIEW with threshold=$500 (50_000 cents)
        organization.status = OrganizationStatus.REVIEW
        organization.next_review_threshold = 50_000
        organization.initially_reviewed_at = datetime(2025, 1, 1, 12, 0, tzinfo=UTC)

        enqueue_job_mock = mocker.patch("polar.organization.service.enqueue_job")
        plain_mock = mocker.patch(
            "polar.organization.service.plain_service.create_organization_review_thread"
        )

        # When: verdict is APPROVE
        result = await organization_service.handle_ongoing_review_verdict(
            session, organization, ReviewVerdict.APPROVE
        )

        # Then: auto-approved, threshold doubled
        assert result is True
        assert organization.status == OrganizationStatus.ACTIVE
        assert organization.next_review_threshold == 100_000
        enqueue_job_mock.assert_called_once()
        plain_mock.assert_not_called()

    async def test_escalate_on_deny_verdict(
        self,
        mocker: MockerFixture,
        session: AsyncSession,
        organization: Organization,
    ) -> None:
        # Given: org is REVIEW with threshold=$500
        organization.status = OrganizationStatus.REVIEW
        organization.next_review_threshold = 50_000
        organization.initially_reviewed_at = datetime(2025, 1, 1, 12, 0, tzinfo=UTC)

        enqueue_job_mock = mocker.patch("polar.organization.service.enqueue_job")
        plain_mock = mocker.patch(
            "polar.organization.service.plain_service.create_organization_review_thread"
        )

        # When: verdict is DENY
        result = await organization_service.handle_ongoing_review_verdict(
            session, organization, ReviewVerdict.DENY
        )

        # Then: escalated, Plain ticket created, status unchanged
        assert result is False
        assert organization.status == OrganizationStatus.REVIEW
        plain_mock.assert_called_once_with(session, organization)
        enqueue_job_mock.assert_not_called()

    async def test_escalate_on_needs_human_review(
        self,
        mocker: MockerFixture,
        session: AsyncSession,
        organization: Organization,
    ) -> None:
        # Given: org is REVIEW with threshold=$500
        organization.status = OrganizationStatus.REVIEW
        organization.next_review_threshold = 50_000
        organization.initially_reviewed_at = datetime(2025, 1, 1, 12, 0, tzinfo=UTC)

        enqueue_job_mock = mocker.patch("polar.organization.service.enqueue_job")
        plain_mock = mocker.patch(
            "polar.organization.service.plain_service.create_organization_review_thread"
        )

        # When: verdict is DENY
        result = await organization_service.handle_ongoing_review_verdict(
            session, organization, ReviewVerdict.DENY
        )

        # Then: escalated, Plain ticket created
        assert result is False
        assert organization.status == OrganizationStatus.REVIEW
        plain_mock.assert_called_once_with(session, organization)
        enqueue_job_mock.assert_not_called()

    async def test_auto_approve_low_threshold(
        self,
        mocker: MockerFixture,
        session: AsyncSession,
        organization: Organization,
    ) -> None:
        # Given: org is REVIEW with a low threshold (no min threshold required)
        organization.status = OrganizationStatus.REVIEW
        organization.next_review_threshold = 100
        organization.initially_reviewed_at = datetime(2025, 1, 1, 12, 0, tzinfo=UTC)

        enqueue_job_mock = mocker.patch("polar.organization.service.enqueue_job")
        plain_mock = mocker.patch(
            "polar.organization.service.plain_service.create_organization_review_thread"
        )

        # When: verdict is APPROVE
        result = await organization_service.handle_ongoing_review_verdict(
            session, organization, ReviewVerdict.APPROVE
        )

        # Then: auto-approved regardless of threshold, next threshold floored to $100
        assert result is True
        assert organization.status == OrganizationStatus.ACTIVE
        assert organization.next_review_threshold == 10_000
        enqueue_job_mock.assert_called_once()
        plain_mock.assert_not_called()

    async def test_auto_approve_zero_threshold(
        self,
        mocker: MockerFixture,
        session: AsyncSession,
        organization: Organization,
    ) -> None:
        # Given: org is REVIEW with default threshold of $0
        organization.status = OrganizationStatus.REVIEW
        organization.next_review_threshold = 0
        organization.initially_reviewed_at = datetime(2025, 1, 1, 12, 0, tzinfo=UTC)

        enqueue_job_mock = mocker.patch("polar.organization.service.enqueue_job")
        plain_mock = mocker.patch(
            "polar.organization.service.plain_service.create_organization_review_thread"
        )

        # When: verdict is APPROVE
        result = await organization_service.handle_ongoing_review_verdict(
            session, organization, ReviewVerdict.APPROVE
        )

        # Then: auto-approved even with default $0 threshold, next threshold set to $100
        assert result is True
        assert organization.status == OrganizationStatus.ACTIVE
        assert organization.next_review_threshold == 10_000
        enqueue_job_mock.assert_called_once()
        plain_mock.assert_not_called()

    async def test_not_eligible_no_initial_review(
        self,
        mocker: MockerFixture,
        session: AsyncSession,
        organization: Organization,
    ) -> None:
        # Given: org is REVIEW without initially_reviewed_at
        organization.status = OrganizationStatus.REVIEW
        organization.next_review_threshold = 50_000

        enqueue_job_mock = mocker.patch("polar.organization.service.enqueue_job")
        plain_mock = mocker.patch(
            "polar.organization.service.plain_service.create_organization_review_thread"
        )

        # When: verdict is APPROVE but org hasn't been initially reviewed
        result = await organization_service.handle_ongoing_review_verdict(
            session, organization, ReviewVerdict.APPROVE
        )

        # Then: not eligible, escalated to Plain
        assert result is False
        assert organization.status == OrganizationStatus.REVIEW
        plain_mock.assert_called_once_with(session, organization)
        enqueue_job_mock.assert_not_called()

    async def test_not_eligible_wrong_status(
        self,
        mocker: MockerFixture,
        session: AsyncSession,
        organization: Organization,
    ) -> None:
        # Given: org is ACTIVE with threshold=$500
        organization.status = OrganizationStatus.ACTIVE
        organization.next_review_threshold = 50_000
        organization.initially_reviewed_at = datetime(2025, 1, 1, 12, 0, tzinfo=UTC)

        enqueue_job_mock = mocker.patch("polar.organization.service.enqueue_job")
        plain_mock = mocker.patch(
            "polar.organization.service.plain_service.create_organization_review_thread"
        )

        # When: verdict is APPROVE but status is ACTIVE (not REVIEW)
        result = await organization_service.handle_ongoing_review_verdict(
            session, organization, ReviewVerdict.APPROVE
        )

        # Then: not eligible, but org is not under review so no Plain thread
        assert result is False
        plain_mock.assert_not_called()
        enqueue_job_mock.assert_not_called()


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
        assert result.status == OrganizationStatus.REVIEW
        enqueue_job_mock.assert_called_once_with(
            "organization.under_review", organization_id=organization.id
        )


@pytest.mark.asyncio
class TestGetPaymentStatus:
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

    async def test_sandbox_environment_allows_payments(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
        mocker: MockerFixture,
    ) -> None:
        # Make organization not payment ready
        organization.created_at = datetime(2025, 8, 4, 12, 0, tzinfo=UTC)
        organization.status = OrganizationStatus.CREATED
        await save_fixture(organization)

        # Mock environment to be sandbox
        mocker.patch("polar.organization.service.settings.ENV", Environment.sandbox)

        payment_status = await organization_service.get_payment_status(
            session, organization
        )

        # Should be payment ready in sandbox even if account setup is incomplete
        assert payment_status.payment_ready is True


@pytest.mark.asyncio
class TestGetAIReview:
    """Test AI review retrieval in OrganizationService."""

    async def test_get_ai_review_no_review(
        self,
        session: AsyncSession,
        organization: Organization,
    ) -> None:
        """Test returns None when no review exists."""
        result = await organization_service.get_ai_review(session, organization)
        assert result is None

    async def test_get_ai_review_existing_review(
        self,
        session: AsyncSession,
        organization: Organization,
    ) -> None:
        """Test returns existing review when one exists."""
        # Create a review record
        review = OrganizationReview(
            organization_id=organization.id,
            verdict=OrganizationReview.Verdict.PASS,
            risk_score=10.0,
            violated_sections=[],
            reason="Looks good.",
            timed_out=False,
            organization_details_snapshot={
                "name": organization.name,
                "website": organization.website,
                "details": organization.details,
                "socials": organization.socials,
            },
            model_used="test-model",
        )
        session.add(review)
        await session.flush()

        result = await organization_service.get_ai_review(session, organization)

        assert result is not None
        assert result.id == review.id
        assert result.verdict == OrganizationReview.Verdict.PASS


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
        organization.status = OrganizationStatus.REVIEW
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

    async def test_blocked_with_paid_orders(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
        customer: Customer,
    ) -> None:
        """Organization with paid orders cannot be immediately deleted."""
        from tests.fixtures.random_objects import create_order

        await create_order(save_fixture, customer=customer, subtotal_amount=1000)

        result = await organization_service.check_can_delete(session, organization)

        assert result.can_delete_immediately is False
        assert "has_orders" in [r.value for r in result.blocked_reasons]

    async def test_not_blocked_with_zero_amount_orders(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
        customer: Customer,
    ) -> None:
        """Organization with only $0 orders can be deleted."""
        from tests.fixtures.random_objects import create_order

        await create_order(
            save_fixture,
            customer=customer,
            subtotal_amount=0,
            tax_amount=0,
        )

        result = await organization_service.check_can_delete(session, organization)

        assert result.can_delete_immediately is True
        assert result.blocked_reasons == []

    async def test_not_blocked_with_fully_discounted_orders(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
        customer: Customer,
    ) -> None:
        """Organization with only fully discounted $0 orders can be deleted."""
        from tests.fixtures.random_objects import create_order

        await create_order(
            save_fixture,
            customer=customer,
            subtotal_amount=1000,
            discount_amount=1000,
            tax_amount=0,
        )

        result = await organization_service.check_can_delete(session, organization)

        assert result.can_delete_immediately is True
        assert result.blocked_reasons == []

    async def test_blocked_with_paid_active_subscriptions(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
        product: Product,
        customer: Customer,
    ) -> None:
        """Organization with paid active subscriptions cannot be immediately deleted."""
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

    async def test_not_blocked_with_free_active_subscriptions(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
        customer: Customer,
    ) -> None:
        """Organization with only free active subscriptions can be deleted."""
        from polar.models.subscription import SubscriptionStatus
        from tests.fixtures.random_objects import create_product, create_subscription

        free_product = await create_product(
            save_fixture,
            organization=organization,
            recurring_interval=SubscriptionRecurringInterval.month,
            prices=[(None, "usd")],
        )
        await create_subscription(
            save_fixture,
            product=free_product,
            customer=customer,
            status=SubscriptionStatus.active,
        )

        result = await organization_service.check_can_delete(session, organization)

        assert result.can_delete_immediately is True
        assert result.blocked_reasons == []

    async def test_not_blocked_with_forever_discounted_free_subscriptions(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
        product: Product,
        customer: Customer,
    ) -> None:
        """Organization with subscriptions made free by a forever discount can be deleted."""
        from polar.models.discount import DiscountDuration, DiscountType
        from polar.models.subscription import SubscriptionStatus
        from tests.fixtures.random_objects import create_discount, create_subscription

        discount = await create_discount(
            save_fixture,
            type=DiscountType.percentage,
            basis_points=10000,
            duration=DiscountDuration.forever,
            organization=organization,
        )
        await create_subscription(
            save_fixture,
            product=product,
            customer=customer,
            status=SubscriptionStatus.active,
            discount=discount,
        )

        result = await organization_service.check_can_delete(session, organization)

        assert result.can_delete_immediately is True
        assert result.blocked_reasons == []

    async def test_blocked_with_non_forever_discounted_free_subscriptions(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
        product: Product,
        customer: Customer,
    ) -> None:
        """Subscription with a 100% off once discount still blocks deletion."""
        from polar.models.discount import DiscountDuration, DiscountType
        from polar.models.subscription import SubscriptionStatus
        from tests.fixtures.random_objects import create_discount, create_subscription

        discount = await create_discount(
            save_fixture,
            type=DiscountType.percentage,
            basis_points=10000,
            duration=DiscountDuration.once,
            organization=organization,
        )
        await create_subscription(
            save_fixture,
            product=product,
            customer=customer,
            status=SubscriptionStatus.active,
            discount=discount,
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
    async def test_with_account_deletes_payout_account(
        self,
        mocker: MockerFixture,
        session: AsyncSession,
        save_fixture: SaveFixture,
        auth_subject: AuthSubject[User],
        organization: Organization,
        account: Account,
        user: User,
    ) -> None:
        """Organization with account deletes payout account first."""
        await create_payout_account(
            save_fixture, organization, user, type=PayoutAccountType.stripe
        )
        payout_account_delete_mock = mocker.patch(
            "polar.organization.service.payout_account_service.delete",
            return_value=None,
        )

        result = await organization_service.request_deletion(
            session, auth_subject, organization
        )

        assert result.can_delete_immediately is True
        assert organization.deleted_at is not None
        payout_account_delete_mock.assert_called_once()

    @pytest.mark.auth
    async def test_payout_account_deletion_failure_creates_ticket(
        self,
        mocker: MockerFixture,
        session: AsyncSession,
        save_fixture: SaveFixture,
        auth_subject: AuthSubject[User],
        organization: Organization,
        user: User,
    ) -> None:
        """Payout account deletion failure creates support ticket."""
        await create_payout_account(
            save_fixture, organization, user, type=PayoutAccountType.stripe
        )
        mocker.patch(
            "polar.organization.service.payout_account_service.delete",
            side_effect=Exception("Stripe API error"),
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

        account = await create_account(save_fixture, user=other_user)
        organization.account = account
        await save_fixture(organization)

        with pytest.raises(NotPermitted) as exc_info:
            await organization_service.request_deletion(
                session, auth_subject, organization
            )

        assert "account admin" in str(exc_info.value).lower()


@pytest.mark.asyncio
class TestSoftDeleteOrganization:
    async def test_enqueues_polar_self_customer_deletion(
        self,
        mocker: MockerFixture,
        session: AsyncSession,
        organization: Organization,
    ) -> None:
        enqueue_delete_customer_mock = mocker.patch(
            "polar.organization.service.polar_self_service.enqueue_delete_customer"
        )

        await organization_service.soft_delete_organization(session, organization)

        enqueue_delete_customer_mock.assert_called_once_with(
            organization_id=organization.id
        )

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
        organization.details = {"about": "Test company"}
        organization.socials = [
            {"platform": "twitter", "url": "https://twitter.com/test"}
        ]
        await save_fixture(organization)

        result = await organization_service.soft_delete_organization(
            session, organization
        )

        assert result.details == {}
        assert result.socials == []


@pytest.mark.asyncio
class TestDelete:
    async def test_enqueues_polar_self_customer_deletion(
        self,
        mocker: MockerFixture,
        session: AsyncSession,
        organization: Organization,
    ) -> None:
        enqueue_delete_customer_mock = mocker.patch(
            "polar.organization.service.polar_self_service.enqueue_delete_customer"
        )

        await organization_service.delete(session, organization)

        enqueue_delete_customer_mock.assert_called_once_with(
            organization_id=organization.id
        )


@pytest.mark.asyncio
class TestUpdateSeatBasedPricing:
    async def test_enable_seat_based_pricing_with_member_model(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
    ) -> None:
        organization.feature_settings = {
            "member_model_enabled": True,
            "seat_based_pricing_enabled": False,
        }
        await save_fixture(organization)

        result = await organization_service.update(
            session,
            organization,
            OrganizationUpdate(
                feature_settings=OrganizationFeatureSettings(
                    seat_based_pricing_enabled=True,
                ),
            ),
        )

        assert result.feature_settings["seat_based_pricing_enabled"] is True

    async def test_enable_seat_based_pricing_without_member_model(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
    ) -> None:
        organization.feature_settings = {
            "member_model_enabled": False,
            "seat_based_pricing_enabled": False,
        }
        await save_fixture(organization)

        with pytest.raises(PolarRequestValidationError):
            await organization_service.update(
                session,
                organization,
                OrganizationUpdate(
                    feature_settings=OrganizationFeatureSettings(
                        seat_based_pricing_enabled=True,
                    ),
                ),
            )

    async def test_disable_seat_based_pricing_when_enabled(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
    ) -> None:
        organization.feature_settings = {
            "member_model_enabled": True,
            "seat_based_pricing_enabled": True,
        }
        await save_fixture(organization)

        with pytest.raises(PolarRequestValidationError):
            await organization_service.update(
                session,
                organization,
                OrganizationUpdate(
                    feature_settings=OrganizationFeatureSettings(
                        seat_based_pricing_enabled=False,
                    ),
                ),
            )

    async def test_keep_seat_based_pricing_enabled(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
    ) -> None:
        organization.feature_settings = {
            "member_model_enabled": True,
            "seat_based_pricing_enabled": True,
        }
        await save_fixture(organization)

        result = await organization_service.update(
            session,
            organization,
            OrganizationUpdate(
                feature_settings=OrganizationFeatureSettings(
                    seat_based_pricing_enabled=True,
                ),
            ),
        )

        assert result.feature_settings["seat_based_pricing_enabled"] is True

    async def test_update_unrelated_setting_with_inconsistent_state(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
    ) -> None:
        """Orgs in inconsistent state (seat_based=True, member_model=False)
        should still be able to update other feature settings."""
        organization.feature_settings = {
            "member_model_enabled": False,
            "seat_based_pricing_enabled": True,
        }
        await save_fixture(organization)

        result = await organization_service.update(
            session,
            organization,
            OrganizationUpdate(
                feature_settings=OrganizationFeatureSettings(
                    checkout_localization_enabled=True,
                ),
            ),
        )

        assert result.feature_settings["seat_based_pricing_enabled"] is True
        assert result.feature_settings["checkout_localization_enabled"] is True

    async def test_resend_seat_based_true_with_inconsistent_state(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
    ) -> None:
        """Orgs in inconsistent state should not be blocked when
        seat_based_pricing_enabled=True is re-sent (no False->True transition)."""
        organization.feature_settings = {
            "member_model_enabled": False,
            "seat_based_pricing_enabled": True,
        }
        await save_fixture(organization)

        result = await organization_service.update(
            session,
            organization,
            OrganizationUpdate(
                feature_settings=OrganizationFeatureSettings(
                    seat_based_pricing_enabled=True,
                ),
            ),
        )

        assert result.feature_settings["seat_based_pricing_enabled"] is True


@pytest.mark.asyncio
class TestSetOrganizationOffboarding:
    @pytest.mark.parametrize(
        "status",
        [
            OrganizationStatus.REVIEW,
            OrganizationStatus.SNOOZED,
        ],
    )
    async def test_from_review_statuses(
        self,
        status: OrganizationStatus,
        session: AsyncSession,
        organization: Organization,
    ) -> None:
        organization.status = status

        result = await organization_service.set_organization_offboarding(
            session, organization
        )

        assert result.status == OrganizationStatus.OFFBOARDING
        assert result.status_updated_at is not None

    @pytest.mark.parametrize(
        "status",
        [
            OrganizationStatus.ACTIVE,
            OrganizationStatus.DENIED,
            OrganizationStatus.CREATED,
        ],
    )
    async def test_from_non_review_raises(
        self,
        status: OrganizationStatus,
        session: AsyncSession,
        organization: Organization,
    ) -> None:
        organization.status = status

        with pytest.raises(Exception, match="Only organizations under review"):
            await organization_service.set_organization_offboarding(
                session, organization
            )

    async def test_with_reason_appends_internal_notes(
        self,
        session: AsyncSession,
        organization: Organization,
    ) -> None:
        organization.status = OrganizationStatus.REVIEW
        organization.internal_notes = None

        result = await organization_service.set_organization_offboarding(
            session, organization, reason="Requested by merchant"
        )

        assert result.status == OrganizationStatus.OFFBOARDING
        assert result.internal_notes is not None
        assert "Requested by merchant" in result.internal_notes


@pytest.mark.asyncio
class TestReactivateOrganization:
    async def test_from_offboarding(
        self,
        session: AsyncSession,
        organization: Organization,
    ) -> None:
        organization.status = OrganizationStatus.OFFBOARDING

        result = await organization_service.reactivate_organization(
            session, organization
        )

        assert result.status == OrganizationStatus.ACTIVE
        assert result.status_updated_at is not None

    async def test_from_non_offboarding_raises(
        self,
        session: AsyncSession,
        organization: Organization,
    ) -> None:
        organization.status = OrganizationStatus.ACTIVE

        with pytest.raises(Exception, match="Only offboarding organizations"):
            await organization_service.reactivate_organization(session, organization)


@pytest.mark.asyncio
class TestOffboardingPaymentReady:
    async def test_offboarding_allows_payments(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
    ) -> None:
        """Offboarding organizations should still be able to accept payments."""
        # Grandfathered organization so we skip account setup checks
        organization.created_at = datetime(2025, 8, 4, 8, 0, tzinfo=UTC)
        organization.status = OrganizationStatus.OFFBOARDING
        await save_fixture(organization)

        result = await organization_service.is_organization_ready_for_payment(
            session, organization
        )

        assert result is True


@pytest.mark.asyncio
class TestSetPayoutAccount:
    @pytest.mark.auth
    async def test_set_payout_account_on_organization(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        auth_subject: AuthSubject[User],
        organization: Organization,
        user: User,
    ) -> None:
        """Successfully sets the payout account on an organization."""
        payout_account = await create_payout_account(
            save_fixture, organization, user, type=PayoutAccountType.stripe
        )
        # Unlink from org first
        organization.payout_account = None
        await save_fixture(organization)

        updated_org = await organization_service.set_payout_account(
            session, auth_subject, organization, payout_account.id
        )

        assert updated_org.payout_account_id == payout_account.id

    @pytest.mark.auth
    async def test_set_unknown_payout_account_raises_error(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        auth_subject: AuthSubject[User],
        organization: Organization,
        user: User,
    ) -> None:
        """Raises PolarRequestValidationError for unknown payout account."""
        with pytest.raises(PolarRequestValidationError):
            await organization_service.set_payout_account(
                session, auth_subject, organization, uuid.uuid4()
            )
