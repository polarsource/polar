from datetime import UTC, datetime, timedelta
from typing import cast
from unittest.mock import AsyncMock

import pytest
from pydantic import HttpUrl, ValidationError
from pytest_mock import MockerFixture

from polar.auth.models import AuthSubject
from polar.config import settings
from polar.enums import (
    InvoiceNumbering,
    PayoutAccountType,
    SubscriptionProrationBehavior,
    SubscriptionRecurringInterval,
)
from polar.exceptions import PolarRequestValidationError
from polar.models import Customer, Organization, Product, User, UserOrganization
from polar.models.account import Account
from polar.models.organization import (
    STATUS_CAPABILITIES,
    InvalidStatusTransitionError,
    OrganizationNotificationSettings,
    OrganizationStatus,
    OrganizationSubscriptionSettings,
)
from polar.models.organization import (
    OrganizationDetails as OrganizationDetailsDict,
)
from polar.models.organization_review import OrganizationReview
from polar.models.user import IdentityVerificationStatus
from polar.organization.repository import OrganizationRepository
from polar.organization.schemas import (
    OrganizationCreate,
    OrganizationDetails,
    OrganizationFeatureSettings,
    OrganizationSocialLink,
    OrganizationSocialPlatforms,
    OrganizationUpdate,
)
from polar.organization.service import OrganizationError
from polar.organization.service import organization as organization_service
from polar.organization_review.schemas import ReviewContext, ReviewVerdict
from polar.postgres import AsyncSession
from polar.user_organization.service import (
    user_organization as user_organization_service,
)
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import (
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
    async def test_concurrent_slug_creation(
        self,
        mocker: MockerFixture,
        auth_subject: AuthSubject[User],
        session: AsyncSession,
        organization: Organization,
    ) -> None:
        """
        Concurrent slug creation (TOCTOU race) is handled as a validation error.

        Simulates the race where slug_exists() returns False for both requests
        but the DB unique constraint catches the duplicate on INSERT.
        """
        # Bypass the pre-check to simulate both requests passing the pre-check
        mocker.patch.object(
            OrganizationRepository, "slug_exists", new=AsyncMock(return_value=False)
        )

        with pytest.raises(PolarRequestValidationError) as exc_info:
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
            "receipts_enabled": True,
        }

        user_organization = await user_organization_service.get_by_user_and_org(
            session, auth_subject.subject.id, organization.id
        )
        assert user_organization is not None

        enqueue_job_mock.assert_called_once_with(
            "organization.created", organization_id=organization.id
        )

    @pytest.mark.auth
    async def test_enqueues_polar_self_customer_with_owner(
        self,
        mocker: MockerFixture,
        auth_subject: AuthSubject[User],
        session: AsyncSession,
    ) -> None:
        create_customer_mock = mocker.patch(
            "polar.organization.service.polar_self_service.enqueue_create_customer"
        )
        add_member_mock = mocker.patch(
            "polar.organization.service.polar_self_service.enqueue_add_member"
        )

        organization = await organization_service.create(
            session,
            OrganizationCreate(name="My New Organization", slug="signup-race-test"),
            auth_subject,
        )

        create_customer_mock.assert_called_once_with(
            organization_id=organization.id,
            name=organization.name,
            owner_external_id=str(auth_subject.subject.id),
            owner_email=auth_subject.subject.email,
            owner_name=auth_subject.subject.public_name,
        )
        add_member_mock.assert_not_called()

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
            "receipts_enabled": True,
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

    @pytest.mark.auth
    async def test_sandbox_creates_active_organization(
        self,
        mocker: MockerFixture,
        auth_subject: AuthSubject[User],
        session: AsyncSession,
    ) -> None:
        mocker.patch(
            "polar.organization.service.settings.is_sandbox", return_value=True
        )

        organization = await organization_service.create(
            session,
            OrganizationCreate(name="Sandbox Org", slug="sandbox-org"),
            auth_subject,
        )

        assert organization.status == OrganizationStatus.ACTIVE
        assert (
            organization.capabilities == STATUS_CAPABILITIES[OrganizationStatus.ACTIVE]
        )
        assert organization.status_updated_at is not None

    @pytest.mark.auth
    async def test_non_sandbox_creates_organization_with_default_status(
        self,
        mocker: MockerFixture,
        auth_subject: AuthSubject[User],
        session: AsyncSession,
    ) -> None:
        mocker.patch(
            "polar.organization.service.settings.is_sandbox", return_value=False
        )

        organization = await organization_service.create(
            session,
            OrganizationCreate(name="Prod Org", slug="prod-org"),
            auth_subject,
        )

        assert organization.status == OrganizationStatus.CREATED
        assert (
            organization.capabilities == STATUS_CAPABILITIES[OrganizationStatus.CREATED]
        )


@pytest.mark.asyncio
class TestUpdateReviewSubmission:
    @pytest.mark.auth
    async def test_update_details_does_not_submit_for_review(
        self,
        mocker: MockerFixture,
        session: AsyncSession,
        organization: Organization,
    ) -> None:
        enqueue_job_mock = mocker.patch("polar.organization.service.enqueue_job")

        organization.status = OrganizationStatus.CREATED
        session.add(organization)
        await session.flush()

        result = await organization_service.update(
            session,
            organization,
            OrganizationUpdate(
                details=OrganizationDetails(
                    product_description="Subscription SaaS for software teams.",
                    selling_categories=["Software / SaaS"],
                    pricing_models=["Subscription"],
                    switching=False,
                )
            ),
        )

        assert result.details is not None
        assert (
            result.details["product_description"]
            == "Subscription SaaS for software teams."
        )
        assert result.details["selling_categories"] == ["Software / SaaS"]
        assert result.details["pricing_models"] == ["Subscription"]
        assert result.details["switching"] is False
        assert result.details_submitted_at is None
        enqueue_job_mock.assert_not_called()

    @pytest.mark.auth
    async def test_update_with_submit_for_review(
        self,
        mocker: MockerFixture,
        session: AsyncSession,
        organization: Organization,
    ) -> None:
        enqueue_job_mock = mocker.patch("polar.organization.service.enqueue_job")
        organization.status = OrganizationStatus.CREATED
        session.add(organization)
        await session.flush()
        await organization_service.update(
            session,
            organization,
            OrganizationUpdate(
                website=cast(HttpUrl, "https://example.com"),
                email="support@example.com",
                socials=[
                    OrganizationSocialLink(
                        platform=cast(OrganizationSocialPlatforms, "x"),
                        url=cast(HttpUrl, "https://x.com/polar"),
                    )
                ],
                details=OrganizationDetails(
                    product_description="Subscription SaaS for software teams and agencies.",
                    selling_categories=["Software / SaaS"],
                    pricing_models=["Subscription"],
                    switching=False,
                ),
            ),
        )
        result = await organization_service.submit_for_review(session, organization)

        assert result.details_submitted_at is not None
        enqueue_job_mock.assert_called_once_with(
            "organization_review.run_agent",
            organization_id=organization.id,
            context=ReviewContext.SUBMISSION,
        )

    @pytest.mark.auth
    async def test_update_with_submit_for_review_requires_relevant_fields(
        self,
        session: AsyncSession,
        organization: Organization,
    ) -> None:
        organization.status = OrganizationStatus.CREATED
        session.add(organization)
        await session.flush()
        await organization_service.update(
            session,
            organization,
            OrganizationUpdate(
                details=OrganizationDetails(
                    product_description="Too short",
                    selling_categories=["Software / SaaS"],
                    pricing_models=["Subscription"],
                    switching=False,
                ),
            ),
        )

        with pytest.raises(PolarRequestValidationError) as exc_info:
            await organization_service.submit_for_review(session, organization)

        error_locations = {tuple(error["loc"]) for error in exc_info.value.errors()}
        assert ("body", "website") in error_locations
        assert ("body", "email") in error_locations
        assert ("body", "socials") in error_locations
        assert ("body", "details", "product_description") in error_locations

    @pytest.mark.auth
    async def test_update_with_submit_for_review_requires_details(
        self,
        session: AsyncSession,
        organization: Organization,
    ) -> None:
        organization.status = OrganizationStatus.CREATED
        session.add(organization)
        await session.flush()
        await organization_service.update(
            session,
            organization,
            OrganizationUpdate(
                website=cast(HttpUrl, "https://example.com"),
                email="support@example.com",
                socials=[
                    OrganizationSocialLink(
                        platform=cast(OrganizationSocialPlatforms, "x"),
                        url=cast(HttpUrl, "https://x.com/polar"),
                    )
                ],
            ),
        )

        with pytest.raises(PolarRequestValidationError) as exc_info:
            await organization_service.submit_for_review(session, organization)

        error_locations = {tuple(error["loc"]) for error in exc_info.value.errors()}
        assert ("body", "details", "product_description") in error_locations

    @pytest.mark.auth
    async def test_update_details_ignored_after_initial_status(
        self,
        session: AsyncSession,
        organization: Organization,
    ) -> None:
        original_details: OrganizationDetailsDict = {
            "product_description": "Original description for the organization.",
            "selling_categories": ["Software / SaaS"],
            "pricing_models": ["Subscription"],
            "switching": False,
        }
        organization.details = original_details
        organization.status = OrganizationStatus.ACTIVE
        session.add(organization)
        await session.flush()

        result = await organization_service.update(
            session,
            organization,
            OrganizationUpdate(
                details=OrganizationDetails(
                    product_description="Attempted tampering after approval.",
                    selling_categories=["Other"],
                    pricing_models=["One-time"],
                    switching=True,
                )
            ),
        )

        assert result.details == original_details


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

    async def test_snoozed_within_grace_period_stays_snoozed(
        self,
        mocker: MockerFixture,
        session: AsyncSession,
        organization: Organization,
    ) -> None:
        # Given: snoozed less than 24h ago
        organization.status = OrganizationStatus.SNOOZED
        organization.status_updated_at = datetime.now(UTC) - timedelta(hours=12)
        organization.next_review_threshold = 1000

        mocker.patch(
            "polar.organization.service.transaction_service.get_transactions_sum",
            return_value=5000,
        )

        result = await organization_service.check_review_threshold(
            session, organization
        )

        # Then: stays snoozed, no review triggered
        assert result.status == OrganizationStatus.SNOOZED

    async def test_snoozed_after_grace_period_returns_to_review(
        self,
        mocker: MockerFixture,
        session: AsyncSession,
        organization: Organization,
    ) -> None:
        # Given: snoozed more than 24h ago (grace period expired)
        organization.status = OrganizationStatus.SNOOZED
        organization.status_updated_at = datetime.now(UTC) - timedelta(hours=25)
        organization.next_review_threshold = 1000

        mocker.patch(
            "polar.organization.service.transaction_service.get_transactions_sum",
            return_value=5000,
        )
        enqueue_job_mock = mocker.patch("polar.organization.service.enqueue_job")

        result = await organization_service.check_review_threshold(
            session, organization
        )

        # Then: transitions back to REVIEW and enqueues review job
        assert result.status == OrganizationStatus.REVIEW
        assert result.status_updated_at is not None
        enqueue_job_mock.assert_called_once_with(
            "organization.under_review", organization_id=organization.id
        )

    async def test_snoozed_without_status_updated_at_stays_snoozed(
        self,
        mocker: MockerFixture,
        session: AsyncSession,
        organization: Organization,
    ) -> None:
        # Given: snoozed but status_updated_at is None (edge case)
        organization.status = OrganizationStatus.SNOOZED
        organization.status_updated_at = None
        organization.next_review_threshold = 1000

        mocker.patch(
            "polar.organization.service.transaction_service.get_transactions_sum",
            return_value=5000,
        )

        result = await organization_service.check_review_threshold(
            session, organization
        )

        # Then: stays snoozed (can't compute grace period)
        assert result.status == OrganizationStatus.SNOOZED

    async def test_offboarding_over_threshold_stays_offboarding(
        self,
        mocker: MockerFixture,
        session: AsyncSession,
        organization: Organization,
    ) -> None:
        # Given: offboarding org with threshold 0 and a positive balance
        # (OFFBOARDING -> REVIEW is not a legal transition, so the check
        # must skip without raising InvalidStatusTransitionError)
        organization.status = OrganizationStatus.OFFBOARDING
        organization.next_review_threshold = 0

        mocker.patch(
            "polar.organization.service.transaction_service.get_transactions_sum",
            return_value=5000,
        )
        enqueue_job_mock = mocker.patch("polar.organization.service.enqueue_job")

        result = await organization_service.check_review_threshold(
            session, organization
        )

        # Then: no status mutation, balance still synced, no review enqueued
        assert result.status == OrganizationStatus.OFFBOARDING
        assert result.total_balance == 5000
        enqueue_job_mock.assert_not_called()

    async def test_sandbox_skips_review_transition(
        self,
        mocker: MockerFixture,
        session: AsyncSession,
        organization: Organization,
    ) -> None:
        organization.status = OrganizationStatus.ACTIVE
        organization.next_review_threshold = 0
        mocker.patch(
            "polar.organization.service.settings.is_sandbox", return_value=True
        )
        mocker.patch(
            "polar.organization.service.transaction_service.get_transactions_sum",
            return_value=5000,
        )
        enqueue_job_mock = mocker.patch("polar.organization.service.enqueue_job")

        result = await organization_service.check_review_threshold(
            session, organization
        )

        assert result.status == OrganizationStatus.ACTIVE
        assert result.total_balance == 5000
        enqueue_job_mock.assert_not_called()


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

        # When: operator manually approves the org with a reason
        result = await organization_service.confirm_organization_reviewed(
            session, organization, 15000, reason="Appeal re-examined"
        )

        assert result.status == OrganizationStatus.CREATED
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

        # When: verdict is APPROVE
        result = await organization_service.handle_ongoing_review_verdict(
            session, organization, ReviewVerdict.APPROVE
        )

        # Then: auto-approved, threshold doubled
        assert result is True
        assert organization.status == OrganizationStatus.ACTIVE
        assert organization.next_review_threshold == 100_000
        enqueue_job_mock.assert_called_once()

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

        # When: verdict is DENY
        result = await organization_service.handle_ongoing_review_verdict(
            session, organization, ReviewVerdict.DENY
        )

        # Then: escalated to backoffice (status unchanged), no auto-approval side effects
        assert result is False
        assert organization.status == OrganizationStatus.REVIEW
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

        # When: verdict is APPROVE
        result = await organization_service.handle_ongoing_review_verdict(
            session, organization, ReviewVerdict.APPROVE
        )

        # Then: auto-approved regardless of threshold, next threshold floored to $100
        assert result is True
        assert organization.status == OrganizationStatus.ACTIVE
        assert organization.next_review_threshold == 10_000
        enqueue_job_mock.assert_called_once()

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

        # When: verdict is APPROVE
        result = await organization_service.handle_ongoing_review_verdict(
            session, organization, ReviewVerdict.APPROVE
        )

        # Then: auto-approved even with default $0 threshold, next threshold set to $100
        assert result is True
        assert organization.status == OrganizationStatus.ACTIVE
        assert organization.next_review_threshold == 10_000
        enqueue_job_mock.assert_called_once()

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

        # When: verdict is APPROVE but org hasn't been initially reviewed
        result = await organization_service.handle_ongoing_review_verdict(
            session, organization, ReviewVerdict.APPROVE
        )

        # Then: not eligible for auto-approval, stays under review for backoffice handling
        assert result is False
        assert organization.status == OrganizationStatus.REVIEW
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

        # When: verdict is APPROVE but status is ACTIVE (not REVIEW)
        result = await organization_service.handle_ongoing_review_verdict(
            session, organization, ReviewVerdict.APPROVE
        )

        # Then: not eligible for auto-approval
        assert result is False
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


class TestGetPaymentStatus:
    def test_active_org_is_payment_ready(
        self,
        organization: Organization,
    ) -> None:
        # Default fixture status is ACTIVE → checkout_payments capability is True.
        payment_status = organization_service.get_payment_status(organization)
        assert payment_status.payment_ready is True

    def test_blocked_org_is_not_payment_ready(
        self,
        organization: Organization,
    ) -> None:
        organization.set_status(OrganizationStatus.BLOCKED)

        payment_status = organization_service.get_payment_status(organization)

        assert payment_status.payment_ready is False


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

        enqueue_job_mock = mocker.patch("polar.organization.service.enqueue_job")

        appeal_reason = "We selling templates and not consultancy services"
        result = await organization_service.submit_appeal(
            session, organization, appeal_reason
        )

        assert result.appeal_submitted_at is not None
        assert result.appeal_reason == appeal_reason
        enqueue_job_mock.assert_called_once_with(
            "organization_review.appeal_submitted", organization.id
        )

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

    async def test_submit_appeal_enqueues_ai_review(
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

        enqueue_job_mock = mocker.patch("polar.organization.service.enqueue_job")

        await organization_service.submit_appeal(
            session, organization, "Please review again"
        )

        enqueue_job_mock.assert_called_once_with(
            "organization_review.appeal_submitted", organization.id
        )


@pytest.mark.asyncio
class TestApproveAppeal:
    async def test_approve_appeal_activates_when_all_gates_pass(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
        user: User,
    ) -> None:
        organization.status = OrganizationStatus.DENIED
        organization.details_submitted_at = datetime.now(UTC)
        organization.details = {"about": "Test"}
        await save_fixture(organization)

        user.identity_verification_status = IdentityVerificationStatus.verified
        await save_fixture(user)

        await create_payout_account(save_fixture, organization, user)

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

    async def test_approve_appeal_reverts_to_created_when_gates_missing(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
    ) -> None:
        organization.status = OrganizationStatus.DENIED
        await save_fixture(organization)

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

        assert organization.status == OrganizationStatus.CREATED
        assert organization.internal_notes is not None
        assert "Appeal approved" in organization.internal_notes
        assert "pending Stripe Identity" in organization.internal_notes
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

    async def test_anonymizes_pii_and_releases_slug(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
    ) -> None:
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

        # The live slug should no longer be the original, freeing it for reuse.
        assert result.slug != original_slug

        # The original slug is archived in slug_history.
        assert len(result.slug_history) == 1
        assert result.slug_history[0]["slug"] == original_slug
        assert "deleted_at" in result.slug_history[0]

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

    async def test_releases_slug_for_reuse(
        self,
        mocker: MockerFixture,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
    ) -> None:
        original_slug = organization.slug
        await organization_service.soft_delete_organization(session, organization)
        await session.flush()

        repository = OrganizationRepository.from_session(session)
        # Original slug is now free — slug_exists (which still inspects
        # soft-deleted rows defensively) reports it as available.
        assert await repository.slug_exists(original_slug) is False

    async def test_appends_to_existing_slug_history(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
    ) -> None:
        previous_entry = {
            "slug": "previous-slug",
            "deleted_at": "2026-01-01T00:00:00+00:00",
        }
        organization.slug_history = [previous_entry]
        await save_fixture(organization)

        result = await organization_service.soft_delete_organization(
            session, organization
        )

        assert len(result.slug_history) == 2
        assert result.slug_history[0] == previous_entry
        assert result.slug_history[1]["slug"] != previous_entry["slug"]

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
class TestResetProrationBehavior:
    async def test_cant_set_without_feature_flag(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
    ) -> None:
        organization.feature_settings = {
            **organization.feature_settings,
            "reset_proration_behavior_enabled": False,
        }
        await save_fixture(organization)

        with pytest.raises(PolarRequestValidationError):
            await organization_service.update(
                session,
                organization,
                OrganizationUpdate(
                    subscription_settings=OrganizationSubscriptionSettings(
                        allow_multiple_subscriptions=False,
                        proration_behavior=SubscriptionProrationBehavior.reset,
                        benefit_revocation_grace_period=0,
                        prevent_trial_abuse=False,
                        allow_customer_updates=True,
                    ),
                ),
            )

    async def test_can_set_with_feature_flag(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
    ) -> None:
        organization.feature_settings = {
            **organization.feature_settings,
            "reset_proration_behavior_enabled": True,
        }
        await save_fixture(organization)

        result = await organization_service.update(
            session,
            organization,
            OrganizationUpdate(
                subscription_settings=OrganizationSubscriptionSettings(
                    allow_multiple_subscriptions=False,
                    proration_behavior=SubscriptionProrationBehavior.reset,
                    benefit_revocation_grace_period=0,
                    prevent_trial_abuse=False,
                    allow_customer_updates=True,
                ),
            ),
        )

        assert (
            result.subscription_settings["proration_behavior"]
            == SubscriptionProrationBehavior.reset
        )


@pytest.mark.asyncio
class TestSetOrganizationOffboarding:
    async def test_from_review(
        self,
        session: AsyncSession,
        organization: Organization,
    ) -> None:
        organization.status = OrganizationStatus.REVIEW

        result = await organization_service.set_organization_offboarding(
            session, organization
        )

        assert result.status == OrganizationStatus.OFFBOARDING
        assert result.status_updated_at is not None

    @pytest.mark.parametrize(
        "status",
        [
            OrganizationStatus.SNOOZED,
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
class TestSnoozeOrganization:
    async def test_from_review(
        self,
        session: AsyncSession,
        organization: Organization,
    ) -> None:
        organization.status = OrganizationStatus.REVIEW
        organization.snooze_count = 0

        result = await organization_service.snooze_organization(session, organization)

        assert result.status == OrganizationStatus.SNOOZED
        assert result.snooze_count == 1
        assert result.status_updated_at is not None

    async def test_increments_snooze_count(
        self,
        session: AsyncSession,
        organization: Organization,
    ) -> None:
        organization.status = OrganizationStatus.REVIEW
        organization.snooze_count = 3

        result = await organization_service.snooze_organization(session, organization)

        assert result.snooze_count == 4

    async def test_from_non_review_raises(
        self,
        session: AsyncSession,
        organization: Organization,
    ) -> None:
        organization.status = OrganizationStatus.ACTIVE

        with pytest.raises(Exception, match="Only organizations under review"):
            await organization_service.snooze_organization(session, organization)

    async def test_with_reason_appends_internal_notes(
        self,
        session: AsyncSession,
        organization: Organization,
    ) -> None:
        organization.status = OrganizationStatus.REVIEW
        organization.snooze_count = 0
        organization.internal_notes = None

        result = await organization_service.snooze_organization(
            session, organization, reason="Merchant not responding"
        )

        assert result.internal_notes is not None
        assert "Merchant not responding" in result.internal_notes
        assert "snoozed (#1)" in result.internal_notes

    async def test_appends_to_existing_notes(
        self,
        session: AsyncSession,
        organization: Organization,
    ) -> None:
        organization.status = OrganizationStatus.REVIEW
        organization.snooze_count = 0
        organization.internal_notes = "Previous note"

        result = await organization_service.snooze_organization(session, organization)

        assert result.internal_notes is not None
        assert "Previous note" in result.internal_notes
        assert "snoozed (#1)" in result.internal_notes


@pytest.mark.asyncio
class TestUnsnoozeOrganization:
    async def test_from_snoozed(
        self,
        mocker: MockerFixture,
        session: AsyncSession,
        organization: Organization,
    ) -> None:
        organization.status = OrganizationStatus.SNOOZED
        enqueue_job_mock = mocker.patch("polar.organization.service.enqueue_job")

        result = await organization_service.unsnooze_organization(session, organization)

        assert result.status == OrganizationStatus.REVIEW
        assert result.status_updated_at is not None
        enqueue_job_mock.assert_called_once_with(
            "organization.under_review", organization_id=organization.id
        )

    async def test_from_non_snoozed_raises(
        self,
        session: AsyncSession,
        organization: Organization,
    ) -> None:
        organization.status = OrganizationStatus.REVIEW

        with pytest.raises(Exception, match="Only snoozed organizations"):
            await organization_service.unsnooze_organization(session, organization)


@pytest.mark.asyncio
class TestSetPayoutAccount:
    @pytest.mark.auth
    async def test_set_payout_account_on_organization(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
        user_organization: UserOrganization,
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
            session, organization, payout_account
        )

        assert updated_org.payout_account_id == payout_account.id


@pytest.mark.asyncio
class TestStatusTransitions:
    """Tests for the organization status transition rules enforced in
    Organization.set_status()."""

    @pytest.mark.parametrize(
        "current",
        [
            OrganizationStatus.CREATED,
            OrganizationStatus.REVIEW,
            OrganizationStatus.SNOOZED,
            OrganizationStatus.ACTIVE,
            OrganizationStatus.DENIED,
            OrganizationStatus.OFFBOARDING,
        ],
    )
    async def test_every_status_can_go_to_blocked(
        self,
        current: OrganizationStatus,
        organization: Organization,
    ) -> None:
        organization.status = current
        organization.set_status(OrganizationStatus.BLOCKED)
        assert organization.status == OrganizationStatus.BLOCKED

    async def test_review_can_go_to_offboarding(
        self,
        organization: Organization,
    ) -> None:
        organization.status = OrganizationStatus.REVIEW
        organization.set_status(OrganizationStatus.OFFBOARDING)
        assert organization.status == OrganizationStatus.OFFBOARDING

    @pytest.mark.parametrize(
        "current",
        [
            OrganizationStatus.CREATED,
            OrganizationStatus.SNOOZED,
            OrganizationStatus.ACTIVE,
            OrganizationStatus.DENIED,
            OrganizationStatus.BLOCKED,
        ],
    )
    async def test_only_review_can_go_to_offboarding(
        self,
        current: OrganizationStatus,
        organization: Organization,
    ) -> None:
        organization.status = current
        with pytest.raises(InvalidStatusTransitionError):
            organization.set_status(OrganizationStatus.OFFBOARDING)

    @pytest.mark.parametrize(
        "current",
        [OrganizationStatus.DENIED, OrganizationStatus.BLOCKED],
    )
    async def test_reactivation_requires_reason(
        self,
        current: OrganizationStatus,
        mocker: MockerFixture,
        session: AsyncSession,
        organization: Organization,
    ) -> None:
        organization.status = current
        mocker.patch("polar.organization.service.enqueue_job")

        with pytest.raises(OrganizationError):
            await organization_service.confirm_organization_reviewed(
                session, organization, 15000
            )

    @pytest.mark.parametrize(
        ("current", "expected_note_fragment"),
        [
            (OrganizationStatus.DENIED, "reactivated from denied"),
            (OrganizationStatus.BLOCKED, "unblocked"),
        ],
    )
    async def test_reactivation_without_gates_reverts_to_created(
        self,
        current: OrganizationStatus,
        expected_note_fragment: str,
        mocker: MockerFixture,
        session: AsyncSession,
        organization: Organization,
    ) -> None:
        organization.status = current
        organization.initially_reviewed_at = datetime(2025, 1, 1, 12, 0, tzinfo=UTC)
        mocker.patch("polar.organization.service.enqueue_job")

        result = await organization_service.confirm_organization_reviewed(
            session, organization, 15000, reason="Merchant provided additional docs"
        )

        assert result.status == OrganizationStatus.CREATED
        assert result.internal_notes is not None
        assert expected_note_fragment in result.internal_notes
        assert "Merchant provided additional docs" in result.internal_notes
        assert "pending Stripe Identity" in result.internal_notes

    @pytest.mark.parametrize(
        "current",
        [OrganizationStatus.DENIED, OrganizationStatus.BLOCKED],
    )
    async def test_reactivation_with_gates_met_activates(
        self,
        current: OrganizationStatus,
        mocker: MockerFixture,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
        user: User,
    ) -> None:
        organization.status = current
        organization.initially_reviewed_at = datetime(2025, 1, 1, 12, 0, tzinfo=UTC)
        organization.details_submitted_at = datetime.now(UTC)
        organization.details = {"about": "Test"}
        await save_fixture(organization)

        user.identity_verification_status = IdentityVerificationStatus.verified
        await save_fixture(user)

        await create_payout_account(save_fixture, organization, user)

        mocker.patch("polar.organization.service.enqueue_job")

        result = await organization_service.confirm_organization_reviewed(
            session, organization, 15000, reason="Merchant provided additional docs"
        )

        assert result.status == OrganizationStatus.ACTIVE

    async def test_self_transition_is_noop(
        self,
        organization: Organization,
    ) -> None:
        organization.status = OrganizationStatus.BLOCKED
        organization.set_status(OrganizationStatus.BLOCKED)
        assert organization.status == OrganizationStatus.BLOCKED

    @pytest.mark.parametrize(
        "target",
        [
            OrganizationStatus.REVIEW,
            OrganizationStatus.SNOOZED,
            OrganizationStatus.DENIED,
            OrganizationStatus.OFFBOARDING,
        ],
    )
    async def test_blocked_only_transitions_to_active_or_created(
        self,
        target: OrganizationStatus,
        organization: Organization,
    ) -> None:
        organization.status = OrganizationStatus.BLOCKED
        with pytest.raises(InvalidStatusTransitionError):
            organization.set_status(target)

    @pytest.mark.parametrize(
        "previous_status",
        [OrganizationStatus.DENIED, OrganizationStatus.BLOCKED],
    )
    async def test_reactivation_to_created_is_allowed(
        self,
        previous_status: OrganizationStatus,
        organization: Organization,
    ) -> None:
        organization.status = previous_status
        organization.set_status(OrganizationStatus.CREATED)
        assert organization.status == OrganizationStatus.CREATED


@pytest.mark.asyncio
class TestCapabilityOverrides:
    """Capability overrides flip enforcement gates without changing status."""

    async def test_checkout_payments_override_blocks_active_org(
        self,
        organization: Organization,
    ) -> None:
        organization.set_status(OrganizationStatus.ACTIVE)
        assert organization.capabilities is not None
        organization.capabilities = {
            **organization.capabilities,
            "checkout_payments": False,
        }

        assert organization.can_accept_payments is False

    async def test_can_authenticate_follows_api_access_capability(
        self,
        organization: Organization,
    ) -> None:
        organization.set_status(OrganizationStatus.ACTIVE)
        assert organization.can_authenticate is True
        assert organization.capabilities is not None

        organization.capabilities = {
            **organization.capabilities,
            "api_access": False,
        }
        assert organization.can_authenticate is False

    async def test_can_access_dashboard_follows_dashboard_access_capability(
        self,
        organization: Organization,
    ) -> None:
        organization.set_status(OrganizationStatus.ACTIVE)
        assert organization.can_access_dashboard is True
        assert organization.capabilities is not None

        organization.capabilities = {
            **organization.capabilities,
            "dashboard_access": False,
        }
        assert organization.can_access_dashboard is False


@pytest.mark.asyncio
class TestSetStatusCapabilities:
    @pytest.mark.parametrize("status", list(OrganizationStatus))
    async def test_set_status_writes_capabilities(
        self,
        status: OrganizationStatus,
        organization: Organization,
    ) -> None:
        # Bypass set_status's transition validation: this test verifies the
        # capability mapping for each status, not the transition rules.
        organization.status = status
        organization.set_status(status)

        assert organization.status == status
        assert organization.capabilities == STATUS_CAPABILITIES[status]

    async def test_set_status_overwrites_prior_overrides(
        self,
        organization: Organization,
    ) -> None:
        organization.set_status(OrganizationStatus.ACTIVE)
        assert organization.capabilities is not None
        organization.capabilities = {**organization.capabilities, "payouts": False}

        organization.set_status(OrganizationStatus.BLOCKED)

        assert (
            organization.capabilities == STATUS_CAPABILITIES[OrganizationStatus.BLOCKED]
        )


@pytest.mark.asyncio
class TestSetCapability:
    async def test_flips_value(
        self,
        session: AsyncSession,
        organization: Organization,
    ) -> None:
        organization.set_status(OrganizationStatus.ACTIVE)
        assert organization.capabilities is not None
        assert organization.capabilities["payouts"] is True

        result = await organization_service.set_capability(
            session,
            organization,
            "payouts",
            False,
            reason="Investigating suspicious withdrawal pattern",
        )

        assert result.capabilities is not None
        assert result.capabilities["payouts"] is False
        assert result.capabilities["checkout_payments"] is True

    async def test_appends_internal_note_with_reason(
        self,
        session: AsyncSession,
        organization: Organization,
    ) -> None:
        organization.set_status(OrganizationStatus.ACTIVE)
        organization.internal_notes = None

        await organization_service.set_capability(
            session,
            organization,
            "payouts",
            False,
            reason="Manual ops hold",
            admin_email="ops@polar.sh",
        )

        assert organization.internal_notes is not None
        assert (
            "Capability 'payouts' disabled by ops@polar.sh"
            in organization.internal_notes
        )
        assert "Reason: Manual ops hold" in organization.internal_notes

    async def test_noop_when_unchanged(
        self,
        session: AsyncSession,
        organization: Organization,
    ) -> None:
        organization.set_status(OrganizationStatus.ACTIVE)
        organization.internal_notes = None
        initial = dict(organization.capabilities or {})

        await organization_service.set_capability(
            session,
            organization,
            "payouts",
            True,
            reason="Already enabled, should not change",
        )

        assert organization.capabilities == initial
        assert organization.internal_notes is None

    async def test_status_transition_resets_override(
        self,
        session: AsyncSession,
        organization: Organization,
    ) -> None:
        organization.set_status(OrganizationStatus.ACTIVE)
        await organization_service.set_capability(
            session,
            organization,
            "payouts",
            False,
            reason="Temporary hold for KYC recheck",
        )
        assert organization.capabilities is not None
        assert organization.capabilities["payouts"] is False

        organization.set_status(OrganizationStatus.REVIEW)
        assert organization.capabilities is not None
        # REVIEW default for payouts is False, and checkout_payments defaults True.
        assert organization.capabilities["checkout_payments"] is True
