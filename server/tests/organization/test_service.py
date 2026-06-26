from datetime import UTC, datetime, timedelta
from typing import cast
from unittest.mock import AsyncMock

import pytest
from pydantic import HttpUrl, ValidationError
from pytest_mock import MockerFixture
from sqlalchemy import update

from polar.auth.models import AuthSubject
from polar.config import settings
from polar.dispute.dispute_case import dispute_case as dispute_case_service
from polar.enums import (
    InvoiceNumbering,
    PayoutAccountType,
    SubscriptionProrationBehavior,
    SubscriptionRecurringInterval,
)
from polar.exceptions import PolarRequestValidationError
from polar.kit.http import UrlReachability
from polar.models import Customer, Organization, Product, User, UserOrganization
from polar.models.account import Account
from polar.models.benefit import BenefitType
from polar.models.member import MemberRole
from polar.models.order import OrderStatus
from polar.models.organization import (
    STATUS_CAPABILITIES,
    InvalidStatusTransitionError,
    OrganizationStatus,
    OrganizationSubscriptionSettings,
    SnoozeType,
)
from polar.models.organization import (
    OrganizationDetails as OrganizationDetailsDict,
)
from polar.models.organization_access_token import OrganizationAccessToken
from polar.models.organization_review import OrganizationReview
from polar.models.user import IdentityVerificationStatus
from polar.models.user_organization import OrganizationRole
from polar.organization.repository import OrganizationRepository
from polar.organization.schemas import (
    LegacyOrganizationStatus,
    OrganizationCreate,
    OrganizationDetails,
    OrganizationFeatureSettingsUpdate,
    OrganizationReviewCheck,
    OrganizationReviewCheckKey,
    OrganizationReviewCheckReason,
    OrganizationReviewCheckStatus,
    OrganizationReviewState,
    OrganizationReviewSubCheck,
    OrganizationReviewSubCheckKey,
    OrganizationSocialLink,
    OrganizationSocialPlatforms,
    OrganizationUpdate,
)
from polar.organization.service import OrganizationError
from polar.organization.service import organization as organization_service
from polar.organization_review.appeal_case import appeal_case as appeal_case_service
from polar.organization_review.schemas import ReviewContext, ReviewVerdict
from polar.postgres import AsyncSession
from polar.support_case.repository import SupportCaseMessageRepository
from polar.user_organization.service import (
    user_organization as user_organization_service,
)
from tests.fixtures.auth import AuthSubjectFixture
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import (
    create_benefit,
    create_checkout_link,
    create_dispute,
    create_order,
    create_payment,
    create_payout_account,
    create_product,
    create_webhook_endpoint,
    set_product_benefits,
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
        }

        user_organization = await user_organization_service.get_by_user_and_org(
            session, auth_subject.subject.id, organization.id
        )
        assert user_organization is not None
        assert user_organization.role == OrganizationRole.owner

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

        owner = auth_subject.subject
        create_customer_mock.assert_called_once_with(
            organization_id=organization.id,
            name=organization.name,
            slug=organization.slug,
            owner_external_id=str(owner.id),
            owner_email=owner.email,
            owner_name=owner.full_name or owner.email.split("@", 1)[0],
        )
        add_member_mock.assert_not_called()

    @pytest.mark.auth
    async def test_valid_with_feature_settings(
        self, auth_subject: AuthSubject[User], session: AsyncSession
    ) -> None:
        organization = await organization_service.create(
            session,
            OrganizationCreate.model_validate(
                {
                    "name": "My New Organization",
                    "slug": "my-new-organization",
                    "feature_settings": {
                        "checkout_localization_enabled": True,
                        "off_session_charges_enabled": True,
                    },
                }
            ),
            auth_subject,
        )

        assert organization.name == "My New Organization"

        assert organization.feature_settings == {
            "checkout_localization_enabled": True,
            "member_model_enabled": True,
            "seat_based_pricing_enabled": True,
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
        assert ("body", "socials") not in error_locations
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
    async def test_update_details_allowed_after_initial_status(
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
                    product_description="Updated description after approval.",
                    selling_categories=["Other"],
                    pricing_models=["One-time"],
                    switching=True,
                )
            ),
        )

        assert result.details is not None
        assert result.details["product_description"] == (
            "Updated description after approval."
        )
        assert result.details["selling_categories"] == ["Other"]
        assert result.details["pricing_models"] == ["One-time"]
        assert result.details["switching"] is True


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
        # Given: NEXT_SALE snooze with deadline still in the future
        organization.status = OrganizationStatus.SNOOZED
        organization.status_updated_at = datetime.now(UTC) - timedelta(hours=12)
        organization.snoozed_until = datetime.now(UTC) + timedelta(hours=12)
        organization.snooze_type = SnoozeType.NEXT_SALE
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
        # Given: NEXT_SALE snooze with deadline already passed
        organization.status = OrganizationStatus.SNOOZED
        organization.status_updated_at = datetime.now(UTC) - timedelta(hours=25)
        organization.snoozed_until = datetime.now(UTC) - timedelta(hours=1)
        organization.snooze_type = SnoozeType.NEXT_SALE
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
        assert result.snoozed_until is None
        assert result.snooze_type is None
        enqueue_job_mock.assert_called_once_with(
            "organization.under_review", organization_id=organization.id
        )

    async def test_time_based_snooze_does_not_trigger_on_sale(
        self,
        mocker: MockerFixture,
        session: AsyncSession,
        organization: Organization,
    ) -> None:
        # Given: TIME_BASED snooze with deadline already passed — sales must
        # NOT pull it back into review (that's the cron task's job).
        organization.status = OrganizationStatus.SNOOZED
        organization.status_updated_at = datetime.now(UTC) - timedelta(hours=25)
        organization.snoozed_until = datetime.now(UTC) - timedelta(hours=1)
        organization.snooze_type = SnoozeType.TIME_BASED
        organization.next_review_threshold = 1000

        mocker.patch(
            "polar.organization.service.transaction_service.get_transactions_sum",
            return_value=5000,
        )

        result = await organization_service.check_review_threshold(
            session, organization
        )

        assert result.status == OrganizationStatus.SNOOZED

    async def test_snoozed_without_deadline_stays_snoozed(
        self,
        mocker: MockerFixture,
        session: AsyncSession,
        organization: Organization,
    ) -> None:
        # Given: a SNOOZED org with no snoozed_until (defensive — the
        # migration backfills this field, but be safe).
        organization.status = OrganizationStatus.SNOOZED
        organization.snoozed_until = None
        organization.snooze_type = SnoozeType.NEXT_SALE
        organization.next_review_threshold = 1000

        mocker.patch(
            "polar.organization.service.transaction_service.get_transactions_sum",
            return_value=5000,
        )

        result = await organization_service.check_review_threshold(
            session, organization
        )

        assert result.status == OrganizationStatus.SNOOZED

    async def test_offboarding_over_threshold_stays_offboarding(
        self,
        mocker: MockerFixture,
        session: AsyncSession,
        organization: Organization,
    ) -> None:
        # Given: offboarding org with threshold 0 and a positive balance.
        # Crossing the review threshold must NEVER pull an offboarding org
        # back into review — only a manual "Set under review" action may do
        # that. check_review_threshold only auto-transitions ACTIVE orgs.
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
        session: AsyncSession,
        organization: Organization,
    ) -> None:
        # Given organization under review
        organization.status = OrganizationStatus.REVIEW

        # When
        result = await organization_service.confirm_organization_reviewed(
            session, organization, 15000
        )

        # Then
        assert result is not None
        assert result.status == OrganizationStatus.ACTIVE
        assert result.initially_reviewed_at is not None
        assert result.next_review_threshold == 15000

    async def test_ongoing_review(
        self,
        session: AsyncSession,
        organization: Organization,
    ) -> None:
        # Given organization under review
        organization.status = OrganizationStatus.REVIEW
        initially_reviewed_at = datetime(2025, 1, 1, 12, 0, tzinfo=UTC)
        organization.initially_reviewed_at = initially_reviewed_at

        # When
        result = await organization_service.confirm_organization_reviewed(
            session, organization, 15000
        )

        # Then
        assert result is not None
        assert result.status == OrganizationStatus.ACTIVE
        assert result.initially_reviewed_at == initially_reviewed_at
        assert result.next_review_threshold == 15000

    async def test_rejects_non_review_status(
        self,
        session: AsyncSession,
        organization: Organization,
    ) -> None:
        organization.status = OrganizationStatus.DENIED

        with pytest.raises(OrganizationError, match="REVIEW or SNOOZED"):
            await organization_service.confirm_organization_reviewed(
                session, organization, 15000
            )

    async def test_enqueues_release_held_payouts(
        self,
        mocker: MockerFixture,
        session: AsyncSession,
        organization: Organization,
    ) -> None:
        organization.status = OrganizationStatus.REVIEW
        enqueue_job_mock = mocker.patch("polar.organization.service.enqueue_job")

        result = await organization_service.confirm_organization_reviewed(
            session, organization, 15000
        )

        assert result is not None
        enqueue_job_mock.assert_any_call(
            "payout.release_held_payouts",
            account_id=organization.account_id,
        )

    async def test_race_lost_returns_none(
        self,
        session: AsyncSession,
        organization: Organization,
    ) -> None:
        """Simulate another worker winning the confirm race.

        The in-memory snapshot looks REVIEW (the value this worker saw
        before its LLM call), but the DB row was flipped to ACTIVE by a
        concurrent worker. The atomic UPDATE must match zero rows and the
        service must return ``None``.
        """
        # Settle the org in REVIEW so the in-memory object is clean.
        organization.status = OrganizationStatus.REVIEW
        await session.flush()

        # Another worker won: flip the DB row to ACTIVE without touching
        # our session's identity-mapped snapshot.
        await session.execute(
            update(Organization)
            .where(Organization.id == organization.id)
            .values(
                status=OrganizationStatus.ACTIVE,
                capabilities={**STATUS_CAPABILITIES[OrganizationStatus.ACTIVE]},
            )
            .execution_options(synchronize_session=False)
        )

        # Stale on purpose — the assertion guards the test setup, not the
        # service under test.
        assert organization.status == OrganizationStatus.REVIEW

        result = await organization_service.confirm_organization_reviewed(
            session, organization
        )

        assert result is None

    async def test_threshold_doubled_from_db_not_memory(
        self,
        session: AsyncSession,
        organization: Organization,
    ) -> None:
        """Doubling must read the current row, not the caller's snapshot.

        Two parallel workers both loaded the org with threshold=50_000.
        Worker A has already bumped the DB to 100_000 but worker B's
        in-memory snapshot still says 50_000. Worker B's doubling must
        compute from the DB (100_000 → 200_000), not from the snapshot
        (50_000 → 100_000), so the doublings don't collapse.
        """
        organization.status = OrganizationStatus.REVIEW
        organization.next_review_threshold = 50_000
        await session.flush()

        # Worker A wins first: bump DB threshold to 100_000 but keep DB
        # status=REVIEW so worker B's UPDATE can still match.
        await session.execute(
            update(Organization)
            .where(Organization.id == organization.id)
            .values(next_review_threshold=100_000)
            .execution_options(synchronize_session=False)
        )

        # Worker B's snapshot is still 50_000.
        assert organization.next_review_threshold == 50_000

        result = await organization_service.confirm_organization_reviewed(
            session, organization
        )

        # Doubling reads the DB row (100_000), not the stale snapshot.
        assert result is not None
        assert result.next_review_threshold == 200_000


@pytest.mark.asyncio
class TestHandleOngoingReviewVerdict:
    async def test_auto_approve_on_approve_verdict(
        self,
        session: AsyncSession,
        organization: Organization,
    ) -> None:
        # Given: org is REVIEW with threshold=$500 (50_000 cents)
        organization.status = OrganizationStatus.REVIEW
        organization.next_review_threshold = 50_000
        organization.initially_reviewed_at = datetime(2025, 1, 1, 12, 0, tzinfo=UTC)

        # When: verdict is APPROVE
        result = await organization_service.handle_ongoing_review_verdict(
            session, organization, ReviewVerdict.APPROVE
        )

        # Then: auto-approved, threshold doubled
        assert result is True
        assert organization.status == OrganizationStatus.ACTIVE
        assert organization.next_review_threshold == 100_000

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
        session: AsyncSession,
        organization: Organization,
    ) -> None:
        # Given: org is REVIEW with a low threshold (no min threshold required)
        organization.status = OrganizationStatus.REVIEW
        organization.next_review_threshold = 100
        organization.initially_reviewed_at = datetime(2025, 1, 1, 12, 0, tzinfo=UTC)

        # When: verdict is APPROVE
        result = await organization_service.handle_ongoing_review_verdict(
            session, organization, ReviewVerdict.APPROVE
        )

        # Then: auto-approved regardless of threshold, next threshold floored to $100
        assert result is True
        assert organization.status == OrganizationStatus.ACTIVE
        assert organization.next_review_threshold == 10_000

    async def test_auto_approve_zero_threshold(
        self,
        session: AsyncSession,
        organization: Organization,
    ) -> None:
        # Given: org is REVIEW with default threshold of $0
        organization.status = OrganizationStatus.REVIEW
        organization.next_review_threshold = 0
        organization.initially_reviewed_at = datetime(2025, 1, 1, 12, 0, tzinfo=UTC)

        # When: verdict is APPROVE
        result = await organization_service.handle_ongoing_review_verdict(
            session, organization, ReviewVerdict.APPROVE
        )

        # Then: auto-approved even with default $0 threshold, next threshold set to $100
        assert result is True
        assert organization.status == OrganizationStatus.ACTIVE
        assert organization.next_review_threshold == 10_000

    async def test_auto_approve_without_initial_review(
        self,
        session: AsyncSession,
        organization: Organization,
    ) -> None:
        # Given: org is REVIEW without initially_reviewed_at (first-pass review)
        organization.status = OrganizationStatus.REVIEW
        organization.next_review_threshold = 50_000

        # When: verdict is APPROVE
        result = await organization_service.handle_ongoing_review_verdict(
            session, organization, ReviewVerdict.APPROVE
        )

        # Then: auto-approved on first pass
        assert result is True
        assert organization.status == OrganizationStatus.ACTIVE

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

    async def test_enqueues_cancel_pending_payouts(
        self,
        mocker: MockerFixture,
        session: AsyncSession,
        organization: Organization,
    ) -> None:
        organization.status = OrganizationStatus.REVIEW
        enqueue_job_mock = mocker.patch("polar.organization.service.enqueue_job")

        await organization_service.deny_organization(session, organization)

        enqueue_job_mock.assert_any_call(
            "payout.cancel_account_payouts",
            account_id=organization.account_id,
        )


@pytest.mark.asyncio
class TestBlockOrganization:
    async def test_block_organization(
        self,
        session: AsyncSession,
        organization: Organization,
    ) -> None:
        organization.status = OrganizationStatus.ACTIVE

        result = await organization_service.block_organization(session, organization)

        assert result.status == OrganizationStatus.BLOCKED

    async def test_enqueues_cancel_pending_payouts(
        self,
        mocker: MockerFixture,
        session: AsyncSession,
        organization: Organization,
    ) -> None:
        organization.status = OrganizationStatus.REVIEW
        enqueue_job_mock = mocker.patch("polar.organization.service.enqueue_job")

        await organization_service.block_organization(session, organization)

        enqueue_job_mock.assert_any_call(
            "payout.cancel_account_payouts",
            account_id=organization.account_id,
        )


@pytest.mark.asyncio
class TestMaybeActivate:
    @pytest.mark.parametrize(
        "status",
        [
            OrganizationStatus.REVIEW,
            OrganizationStatus.SNOOZED,
            OrganizationStatus.DENIED,
            OrganizationStatus.BLOCKED,
        ],
    )
    async def test_only_transitions_from_created(
        self,
        session: AsyncSession,
        organization: Organization,
        status: OrganizationStatus,
    ) -> None:
        organization.status = status

        review = OrganizationReview(
            organization_id=organization.id,
            verdict=OrganizationReview.Verdict.PASS,
            risk_score=10.0,
            violated_sections=[],
            reason="Clean",
            model_used="test",
        )
        session.add(review)
        await session.flush()

        result = await organization_service.maybe_activate(session, organization)

        assert result is False
        assert organization.status == status

    async def test_does_not_undo_admin_redeny_after_appeal_approval(
        self,
        session: AsyncSession,
        organization: Organization,
    ) -> None:
        """Edge case: appeal approved → admin re-denies → Stripe webhook fires.

        The webhook must not undo the admin's deny, even though the appeal is
        still marked APPROVED on the review record.
        """
        organization.status = OrganizationStatus.DENIED
        review = OrganizationReview(
            organization_id=organization.id,
            verdict=OrganizationReview.Verdict.FAIL,
            risk_score=80.0,
            violated_sections=["tos"],
            reason="Violation",
            model_used="test",
            appeal_submitted_at=datetime(2025, 2, 1, tzinfo=UTC),
            appeal_reason="Please reconsider",
            appeal_decision=OrganizationReview.AppealDecision.APPROVED,
            appeal_reviewed_at=datetime(2025, 2, 2, tzinfo=UTC),
        )
        session.add(review)
        await session.flush()

        result = await organization_service.maybe_activate(session, organization)

        assert result is False
        assert organization.status == OrganizationStatus.DENIED

    async def test_activates_uncertain_verdict_with_approved_appeal(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        organization: Organization,
        user: User,
    ) -> None:
        await _setup_passing_org(save_fixture, organization, user)
        organization.status = OrganizationStatus.CREATED
        organization.details_submitted_at = datetime.now(UTC)
        await save_fixture(organization)

        review = OrganizationReview(
            organization_id=organization.id,
            verdict=OrganizationReview.Verdict.UNCERTAIN,
            risk_score=50.0,
            violated_sections=[],
            reason="Borderline",
            model_used="test",
            appeal_submitted_at=datetime(2025, 2, 1, tzinfo=UTC),
            appeal_reason="Please reconsider",
            appeal_decision=OrganizationReview.AppealDecision.APPROVED,
            appeal_reviewed_at=datetime(2025, 2, 2, tzinfo=UTC),
        )
        session.add(review)
        await session.flush()

        result = await organization_service.maybe_activate(session, organization)

        assert result is True
        assert organization.status == OrganizationStatus.ACTIVE

    async def test_activates_when_owner_verified_but_payout_admin_unverified(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        organization: Organization,
        user: User,
        user_second: User,
    ) -> None:
        """Activation keys off the org owner's identity verification, not the
        (static) payout account admin's.

        Scenario: ``user`` (A) created the org and payout account (A is the
        admin) but never completed identity verification. Ownership was
        transferred to ``user_second`` (B), who is verified. Activation must
        succeed because the owner is verified.
        """
        await _setup_passing_org(save_fixture, organization, user)
        organization.status = OrganizationStatus.CREATED
        organization.details_submitted_at = datetime.now(UTC)
        await save_fixture(organization)

        # A (payout account admin) is NOT identity-verified.
        user.identity_verification_status = IdentityVerificationStatus.unverified
        await save_fixture(user)

        # Transfer ownership: demote A, promote verified B to owner.
        owner_uo = await user_organization_service.get_by_user_and_org(
            session, user.id, organization.id
        )
        assert owner_uo is not None
        owner_uo.role = OrganizationRole.admin
        await save_fixture(owner_uo)

        user_second.identity_verification_status = IdentityVerificationStatus.verified
        await save_fixture(user_second)
        await save_fixture(
            UserOrganization(
                user_id=user_second.id,
                organization_id=organization.id,
                role=OrganizationRole.owner,
            )
        )

        review = OrganizationReview(
            organization_id=organization.id,
            verdict=OrganizationReview.Verdict.PASS,
            risk_score=10.0,
            violated_sections=[],
            reason="Clean",
            model_used="test",
        )
        session.add(review)
        await session.flush()

        result = await organization_service.maybe_activate(session, organization)

        assert result is True
        assert organization.status == OrganizationStatus.ACTIVE

    async def test_does_not_activate_when_owner_unverified_but_payout_admin_verified(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        organization: Organization,
        user: User,
        user_second: User,
    ) -> None:
        """The reverse: a verified payout account admin must not unlock
        activation when the current owner is unverified.
        """
        await _setup_passing_org(save_fixture, organization, user)
        organization.status = OrganizationStatus.CREATED
        organization.details_submitted_at = datetime.now(UTC)
        await save_fixture(organization)

        # A (payout account admin) stays verified, but the new owner B isn't.
        owner_uo = await user_organization_service.get_by_user_and_org(
            session, user.id, organization.id
        )
        assert owner_uo is not None
        owner_uo.role = OrganizationRole.admin
        await save_fixture(owner_uo)

        user_second.identity_verification_status = IdentityVerificationStatus.unverified
        await save_fixture(user_second)
        await save_fixture(
            UserOrganization(
                user_id=user_second.id,
                organization_id=organization.id,
                role=OrganizationRole.owner,
            )
        )

        review = OrganizationReview(
            organization_id=organization.id,
            verdict=OrganizationReview.Verdict.PASS,
            risk_score=10.0,
            violated_sections=[],
            reason="Clean",
            model_used="test",
        )
        session.add(review)
        await session.flush()

        result = await organization_service.maybe_activate(session, organization)

        assert result is False
        assert organization.status == OrganizationStatus.CREATED


@pytest.mark.asyncio
class TestBackofficeApprove:
    async def test_rejects_non_denied_or_blocked(
        self,
        session: AsyncSession,
        organization: Organization,
        user: User,
    ) -> None:
        organization.status = OrganizationStatus.REVIEW

        with pytest.raises(OrganizationError, match="DENIED or BLOCKED"):
            await organization_service.backoffice_approve(
                session, organization, reason="Test", staff_user=user
            )

    async def test_reverts_to_created_when_not_activation_ready(
        self,
        session: AsyncSession,
        organization: Organization,
        user: User,
    ) -> None:
        organization.status = OrganizationStatus.DENIED

        await organization_service.backoffice_approve(
            session, organization, reason="Support escalation", staff_user=user
        )

        assert organization.status == OrganizationStatus.CREATED

    async def test_overrides_rejected_appeal(
        self,
        session: AsyncSession,
        organization: Organization,
        user: User,
    ) -> None:
        """Support-contact escalation: AI rejected the appeal, admin overrides."""
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

        await organization_service.backoffice_approve(
            session, organization, 15000, reason="Appeal re-examined", staff_user=user
        )

        assert organization.status == OrganizationStatus.CREATED
        assert review.appeal_decision == OrganizationReview.AppealDecision.APPROVED
        assert review.appeal_reviewed_at is not None
        assert organization.next_review_threshold == 15000


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

    async def test_set_organization_under_review_from_offboarding(
        self,
        mocker: MockerFixture,
        session: AsyncSession,
        organization: Organization,
    ) -> None:
        # Given an offboarding organization
        organization.status = OrganizationStatus.OFFBOARDING

        mocker.patch("polar.organization.service.enqueue_job")

        # When reverting it to review
        result = await organization_service.set_organization_under_review(
            session, organization
        )

        # Then it transitions back into the review flow
        assert result.status == OrganizationStatus.REVIEW


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


async def _setup_passing_org(
    save_fixture: SaveFixture,
    organization: Organization,
    user: User,
) -> None:
    organization.email = "support@example.com"
    organization.website = "https://example.com"
    organization.socials = [{"platform": "x", "url": "https://x.com/polar"}]
    organization.details = {
        "product_description": "Subscription SaaS for software teams and agencies."
    }
    await save_fixture(organization)

    user.identity_verification_status = IdentityVerificationStatus.verified
    await save_fixture(user)

    # `get_owner_user` returns the user holding `owner` on the org.
    await save_fixture(
        UserOrganization(
            user_id=user.id,
            organization_id=organization.id,
            role=OrganizationRole.owner,
        )
    )

    await create_payout_account(save_fixture, organization, user)

    # Product configuration + setup readiness: a product with a license-key
    # benefit reachable through a checkout link satisfies both new checks.
    product = await create_product(
        save_fixture, organization=organization, recurring_interval=None
    )
    benefit = await create_benefit(
        save_fixture, organization=organization, type=BenefitType.license_keys
    )
    await set_product_benefits(save_fixture, product=product, benefits=[benefit])
    await create_checkout_link(save_fixture, products=[product])


def _step(
    state: OrganizationReviewState, key: OrganizationReviewCheckKey
) -> OrganizationReviewCheck:
    for step in state.preliminary_steps:
        if step.key == key:
            return step
    raise AssertionError(f"step {key} missing from {state}")


def _sub(
    step: OrganizationReviewCheck, key: OrganizationReviewSubCheckKey
) -> OrganizationReviewSubCheck:
    for sub in step.sub_checks:
        if sub.key == key:
            return sub
    raise AssertionError(f"sub_check {key} missing from {step}")


@pytest.mark.asyncio
class TestGetReviewState:
    """Test the merchant self-review checklist."""

    @pytest.fixture(autouse=True)
    def mock_check_url_reachable(self, mocker: MockerFixture) -> AsyncMock:
        # Default to reachable so existing tests don't make outbound requests.
        # Individual tests can re-patch via `mocker.patch(...)` to override.
        return mocker.patch(
            "polar.organization.service.check_url_reachable",
            new=AsyncMock(return_value=UrlReachability(reachable=True, status=200)),
        )

    async def test_empty_org_blocks_submission(
        self,
        session: AsyncSession,
        organization: Organization,
    ) -> None:
        state = await organization_service.get_review_state(session, organization)

        assert state.can_submit is False
        assert state.submitted_at is None
        assert state.verdict is None
        assert state.appeal is None
        assert all(
            step.status == OrganizationReviewCheckStatus.PENDING
            for step in state.preliminary_steps
        )
        # Aggregate checks carry reasons on sub_checks, not the parent.
        for step in state.preliminary_steps:
            reason_lists = (
                [sub.reasons for sub in step.sub_checks]
                if step.sub_checks
                else [step.reasons]
            )
            assert all(
                OrganizationReviewCheckReason.NOT_STARTED in reasons
                for reasons in reason_lists
            )

    @pytest.mark.auth
    async def test_identity_owner_viewer_sees_not_started(
        self,
        auth_subject: AuthSubject[User],
        session: AsyncSession,
        organization: Organization,
        user_organization: UserOrganization,
    ) -> None:
        state = await organization_service.get_review_state(
            session, organization, auth_subject
        )
        step = _step(state, OrganizationReviewCheckKey.IDENTITY_STRIPE_VERIFICATION)
        assert step.status == OrganizationReviewCheckStatus.PENDING
        assert OrganizationReviewCheckReason.NOT_STARTED in step.reasons

    @pytest.mark.auth(AuthSubjectFixture(subject="user_second"))
    async def test_identity_non_owner_viewer_sees_not_authorized(
        self,
        auth_subject: AuthSubject[User],
        session: AsyncSession,
        organization: Organization,
        user_organization: UserOrganization,
    ) -> None:
        state = await organization_service.get_review_state(
            session, organization, auth_subject
        )
        step = _step(state, OrganizationReviewCheckKey.IDENTITY_STRIPE_VERIFICATION)
        assert step.status == OrganizationReviewCheckStatus.PENDING
        assert step.reasons == [OrganizationReviewCheckReason.NOT_AUTHORIZED]

    async def test_email_set_passes(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        organization: Organization,
    ) -> None:
        organization.email = "support@example.com"
        await save_fixture(organization)

        state = await organization_service.get_review_state(session, organization)
        step = _step(state, OrganizationReviewCheckKey.IDENTITY_EMAIL)

        assert step.status == OrganizationReviewCheckStatus.PASSED
        assert step.reasons == []

    async def test_email_personal_domain_warns(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        organization: Organization,
    ) -> None:
        # Free/personal email — the merchant can still submit, but we surface
        # this as a soft warning so reviewers know the support address isn't
        # tied to a business domain.
        organization.email = "founder@gmail.com"
        await save_fixture(organization)

        state = await organization_service.get_review_state(session, organization)
        step = _step(state, OrganizationReviewCheckKey.IDENTITY_EMAIL)

        assert step.status == OrganizationReviewCheckStatus.WARNING
        assert OrganizationReviewCheckReason.IDENTITY_PERSONAL_EMAIL in step.reasons
        assert state.can_submit is False  # other checks still pending
        # Warnings alone don't block — verified by isolating the failing keys.
        non_email_failing = [
            s
            for s in state.preliminary_steps
            if s.key != OrganizationReviewCheckKey.IDENTITY_EMAIL
            and s.status
            in (
                OrganizationReviewCheckStatus.FAILED,
                OrganizationReviewCheckStatus.PENDING,
            )
        ]
        assert non_email_failing  # something else is blocking, not the warning

    async def test_email_domain_mismatch_warns(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        organization: Organization,
    ) -> None:
        organization.email = "support@otherdomain.com"
        organization.website = "https://example.com"
        await save_fixture(organization)

        state = await organization_service.get_review_state(session, organization)
        step = _step(state, OrganizationReviewCheckKey.IDENTITY_EMAIL)

        assert step.status == OrganizationReviewCheckStatus.WARNING
        assert OrganizationReviewCheckReason.IDENTITY_DOMAIN_MISMATCH in step.reasons

    async def test_email_matching_website_passes(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        organization: Organization,
    ) -> None:
        organization.email = "support@example.com"
        organization.website = "https://www.example.com/products"
        await save_fixture(organization)

        state = await organization_service.get_review_state(session, organization)
        step = _step(state, OrganizationReviewCheckKey.IDENTITY_EMAIL)

        assert step.status == OrganizationReviewCheckStatus.PASSED
        assert step.reasons == []

    @pytest.mark.parametrize(
        "website",
        [
            "https://framer.com/acme",
            "https://acme.framer.com",
        ],
    )
    async def test_email_skip_domain_mismatch_for_hosted_websites(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        organization: Organization,
        website: str,
    ) -> None:
        organization.email = "support@acme.com"
        organization.website = website
        await save_fixture(organization)

        state = await organization_service.get_review_state(session, organization)
        step = _step(state, OrganizationReviewCheckKey.IDENTITY_EMAIL)

        assert step.status == OrganizationReviewCheckStatus.PASSED
        assert (
            OrganizationReviewCheckReason.IDENTITY_DOMAIN_MISMATCH not in step.reasons
        )

    async def test_socials_present_passes(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        organization: Organization,
    ) -> None:
        organization.socials = [{"platform": "x", "url": "https://x.com/polar"}]
        await save_fixture(organization)

        state = await organization_service.get_review_state(session, organization)
        step = _step(state, OrganizationReviewCheckKey.IDENTITY_SOCIAL_LINKS)

        assert step.status == OrganizationReviewCheckStatus.PASSED

    @pytest.mark.parametrize(
        ("identity_status", "expected_status", "expected_reason"),
        [
            (
                IdentityVerificationStatus.verified,
                OrganizationReviewCheckStatus.PASSED,
                None,
            ),
            (
                IdentityVerificationStatus.pending,
                OrganizationReviewCheckStatus.PENDING,
                OrganizationReviewCheckReason.EXTERNAL_PENDING,
            ),
            (
                IdentityVerificationStatus.failed,
                OrganizationReviewCheckStatus.FAILED,
                OrganizationReviewCheckReason.IDENTITY_REJECTED,
            ),
            (
                IdentityVerificationStatus.unverified,
                OrganizationReviewCheckStatus.PENDING,
                OrganizationReviewCheckReason.NOT_STARTED,
            ),
        ],
    )
    async def test_identity_verification_branches(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        organization: Organization,
        user: User,
        user_organization: UserOrganization,
        identity_status: IdentityVerificationStatus,
        expected_status: OrganizationReviewCheckStatus,
        expected_reason: OrganizationReviewCheckReason | None,
    ) -> None:
        user.identity_verification_status = identity_status
        await save_fixture(user)

        state = await organization_service.get_review_state(session, organization)
        step = _step(state, OrganizationReviewCheckKey.IDENTITY_STRIPE_VERIFICATION)

        assert step.status == expected_status
        if expected_reason is None:
            assert step.reasons == []
        else:
            assert expected_reason in step.reasons

    async def test_product_description_missing_is_not_started(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        organization: Organization,
    ) -> None:
        # Empty/whitespace-only string is treated the same as missing.
        organization.details = {"product_description": "   "}
        await save_fixture(organization)

        state = await organization_service.get_review_state(session, organization)
        step = _step(state, OrganizationReviewCheckKey.PRODUCT_DESCRIPTION)

        assert step.status == OrganizationReviewCheckStatus.PENDING
        assert OrganizationReviewCheckReason.NOT_STARTED in step.reasons

    async def test_product_description_too_short_is_in_progress(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        organization: Organization,
    ) -> None:
        # Started but not yet meeting the 30-char threshold — action required,
        # not "to do". Distinguishes the merchant who tried from one who
        # never started.
        organization.details = {"product_description": "too short"}
        await save_fixture(organization)

        state = await organization_service.get_review_state(session, organization)
        step = _step(state, OrganizationReviewCheckKey.PRODUCT_DESCRIPTION)

        assert step.status == OrganizationReviewCheckStatus.FAILED
        assert OrganizationReviewCheckReason.IN_PROGRESS in step.reasons

    async def test_product_description_long_enough(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        organization: Organization,
    ) -> None:
        organization.details = {
            "product_description": "Subscription SaaS for software teams and agencies."
        }
        await save_fixture(organization)

        state = await organization_service.get_review_state(session, organization)
        step = _step(state, OrganizationReviewCheckKey.PRODUCT_DESCRIPTION)

        assert step.status == OrganizationReviewCheckStatus.PASSED

    async def test_product_url_missing_is_not_started(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        organization: Organization,
        mock_check_url_reachable: AsyncMock,
    ) -> None:
        assert organization.website is None
        state = await organization_service.get_review_state(session, organization)
        step = _step(state, OrganizationReviewCheckKey.PRODUCT_URL)

        assert step.status == OrganizationReviewCheckStatus.PENDING
        assert OrganizationReviewCheckReason.NOT_STARTED in step.reasons
        assert step.value is None
        mock_check_url_reachable.assert_not_called()

    async def test_product_url_reachable_passes_with_value(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        organization: Organization,
    ) -> None:
        organization.website = "https://example.com"
        await save_fixture(organization)

        state = await organization_service.get_review_state(session, organization)
        step = _step(state, OrganizationReviewCheckKey.PRODUCT_URL)

        assert step.status == OrganizationReviewCheckStatus.PASSED
        assert step.value == "https://example.com"

    async def test_product_url_unreachable_fails(
        self,
        mocker: MockerFixture,
        save_fixture: SaveFixture,
        session: AsyncSession,
        organization: Organization,
    ) -> None:
        organization.website = "https://example.com"
        await save_fixture(organization)
        mocker.patch(
            "polar.organization.service.check_url_reachable",
            new=AsyncMock(
                return_value=UrlReachability(reachable=False, error="DNS failed")
            ),
        )

        state = await organization_service.get_review_state(session, organization)
        step = _step(state, OrganizationReviewCheckKey.PRODUCT_URL)

        assert step.status == OrganizationReviewCheckStatus.FAILED
        assert OrganizationReviewCheckReason.PRODUCT_URL_UNREACHABLE in step.reasons
        assert step.value == "https://example.com"
        assert state.can_submit is False

    async def test_payout_account_ready(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        organization: Organization,
        user: User,
    ) -> None:
        await create_payout_account(save_fixture, organization, user)

        state = await organization_service.get_review_state(session, organization)
        step = _step(state, OrganizationReviewCheckKey.PAYOUT_ACCOUNT)

        assert step.status == OrganizationReviewCheckStatus.PASSED

    async def test_payout_account_payouts_disabled_when_stripe_blocked(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        organization: Organization,
        user: User,
    ) -> None:
        # Details + charges submitted, but Stripe explicitly disabled payouts.
        # This is the only case that should surface as PAYOUTS_DISABLED.
        await create_payout_account(
            save_fixture, organization, user, is_payouts_enabled=False
        )

        state = await organization_service.get_review_state(session, organization)
        step = _step(state, OrganizationReviewCheckKey.PAYOUT_ACCOUNT)

        assert step.status == OrganizationReviewCheckStatus.FAILED
        assert (
            OrganizationReviewCheckReason.PAYOUT_ACCOUNT_PAYOUTS_DISABLED
            in step.reasons
        )

    async def test_payout_account_requirements_due_when_onboarding_incomplete(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        organization: Organization,
        user: User,
    ) -> None:
        # Merchant created the Stripe Connect account but never finished
        # onboarding. ~4.5k orgs in this state in prod — they should see
        # "complete onboarding", NOT "Stripe disabled your payouts".
        payout = await create_payout_account(
            save_fixture, organization, user, is_payouts_enabled=False
        )
        payout.is_details_submitted = False
        payout.is_charges_enabled = False
        await save_fixture(payout)

        state = await organization_service.get_review_state(session, organization)
        step = _step(state, OrganizationReviewCheckKey.PAYOUT_ACCOUNT)

        assert step.status == OrganizationReviewCheckStatus.FAILED
        assert (
            OrganizationReviewCheckReason.PAYOUT_ACCOUNT_REQUIREMENTS_DUE
            in step.reasons
        )

    async def test_payout_account_requirements_due_when_no_stripe_id(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        organization: Organization,
        user: User,
    ) -> None:
        # is_payouts_enabled=True but stripe_id is None: is_payout_ready returns
        # False via the stripe_id check. Falls through to REQUIREMENTS_DUE.
        await create_payout_account(save_fixture, organization, user, stripe_id=None)

        state = await organization_service.get_review_state(session, organization)
        step = _step(state, OrganizationReviewCheckKey.PAYOUT_ACCOUNT)

        assert step.status == OrganizationReviewCheckStatus.FAILED
        assert (
            OrganizationReviewCheckReason.PAYOUT_ACCOUNT_REQUIREMENTS_DUE
            in step.reasons
        )

    async def test_product_configuration_missing_is_not_started(
        self,
        session: AsyncSession,
        organization: Organization,
    ) -> None:
        state = await organization_service.get_review_state(session, organization)
        step = _step(state, OrganizationReviewCheckKey.PRODUCT_CONFIGURATION)

        assert step.status == OrganizationReviewCheckStatus.PENDING
        assert OrganizationReviewCheckReason.NOT_STARTED in step.reasons

    async def test_product_configuration_with_product_passes(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        organization: Organization,
    ) -> None:
        await create_product(
            save_fixture, organization=organization, recurring_interval=None
        )

        state = await organization_service.get_review_state(session, organization)
        step = _step(state, OrganizationReviewCheckKey.PRODUCT_CONFIGURATION)

        assert step.status == OrganizationReviewCheckStatus.PASSED

    async def test_setup_readiness_missing_is_not_started(
        self,
        session: AsyncSession,
        organization: Organization,
    ) -> None:
        state = await organization_service.get_review_state(session, organization)
        step = _step(state, OrganizationReviewCheckKey.SETUP_READINESS)

        assert step.status == OrganizationReviewCheckStatus.PENDING
        assert step.reasons == []
        for sub_key in (
            OrganizationReviewSubCheckKey.SETUP_READINESS_CHECKOUT_LINK,
            OrganizationReviewSubCheckKey.SETUP_READINESS_ACCESS_TOKEN,
            OrganizationReviewSubCheckKey.SETUP_READINESS_WEBHOOK,
        ):
            sub = _sub(step, sub_key)
            assert sub.status == OrganizationReviewCheckStatus.PENDING
            assert OrganizationReviewCheckReason.NOT_STARTED in sub.reasons

    @pytest.mark.parametrize(
        "benefit_type",
        [
            BenefitType.downloadables,
            BenefitType.license_keys,
            BenefitType.github_repository,
            BenefitType.discord,
            BenefitType.slack_shared_channel,
            # `custom` is a free-form note, but the customer still sees it in
            # their portal post-purchase — no API integration required.
            BenefitType.custom,
        ],
    )
    async def test_setup_readiness_checkout_link_with_eligible_benefit_passes(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        organization: Organization,
        benefit_type: BenefitType,
    ) -> None:
        product = await create_product(
            save_fixture, organization=organization, recurring_interval=None
        )
        benefit = await create_benefit(
            save_fixture,
            organization=organization,
            type=benefit_type,
        )
        await set_product_benefits(save_fixture, product=product, benefits=[benefit])
        await create_checkout_link(save_fixture, products=[product])

        state = await organization_service.get_review_state(session, organization)
        step = _step(state, OrganizationReviewCheckKey.SETUP_READINESS)

        assert step.status == OrganizationReviewCheckStatus.PASSED
        assert (
            _sub(
                step, OrganizationReviewSubCheckKey.SETUP_READINESS_CHECKOUT_LINK
            ).status
            == OrganizationReviewCheckStatus.PASSED
        )
        assert (
            _sub(
                step, OrganizationReviewSubCheckKey.SETUP_READINESS_ACCESS_TOKEN
            ).status
            == OrganizationReviewCheckStatus.PENDING
        )

    @pytest.mark.parametrize(
        "benefit_type",
        [
            # Benefits a checkout link can't fulfill on its own — they only mean
            # something once the merchant integrates the API. `feature_flag`:
            # the merchant's app reads the flag. `meter_credit`: the credit is
            # consumed via usage events the merchant ingests.
            BenefitType.feature_flag,
            BenefitType.meter_credit,
        ],
    )
    async def test_setup_readiness_ineligible_benefit_does_not_count(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        organization: Organization,
        benefit_type: BenefitType,
    ) -> None:
        product = await create_product(
            save_fixture, organization=organization, recurring_interval=None
        )
        benefit = await create_benefit(
            save_fixture, organization=organization, type=benefit_type
        )
        await set_product_benefits(save_fixture, product=product, benefits=[benefit])
        await create_checkout_link(save_fixture, products=[product])

        state = await organization_service.get_review_state(session, organization)
        step = _step(state, OrganizationReviewCheckKey.SETUP_READINESS)

        assert step.status == OrganizationReviewCheckStatus.FAILED
        checkout_link_sub = _sub(
            step, OrganizationReviewSubCheckKey.SETUP_READINESS_CHECKOUT_LINK
        )
        assert checkout_link_sub.status == OrganizationReviewCheckStatus.FAILED
        assert (
            OrganizationReviewCheckReason.SETUP_READINESS_CHECKOUT_LINK_NOT_FULFILLABLE
            in checkout_link_sub.reasons
        )

    async def test_setup_readiness_checkout_link_with_success_url_passes(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        organization: Organization,
    ) -> None:
        product = await create_product(
            save_fixture, organization=organization, recurring_interval=None
        )
        await create_checkout_link(
            save_fixture,
            products=[product],
            success_url="https://example.com/thank-you",
        )

        state = await organization_service.get_review_state(session, organization)
        step = _step(state, OrganizationReviewCheckKey.SETUP_READINESS)

        assert step.status == OrganizationReviewCheckStatus.PASSED
        assert (
            _sub(
                step, OrganizationReviewSubCheckKey.SETUP_READINESS_CHECKOUT_LINK
            ).status
            == OrganizationReviewCheckStatus.PASSED
        )

    async def test_setup_readiness_checkout_link_without_benefits_or_success_url_fails(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        organization: Organization,
    ) -> None:
        product = await create_product(
            save_fixture, organization=organization, recurring_interval=None
        )
        await create_checkout_link(save_fixture, products=[product])

        state = await organization_service.get_review_state(session, organization)
        step = _step(state, OrganizationReviewCheckKey.SETUP_READINESS)

        assert step.status == OrganizationReviewCheckStatus.FAILED
        assert (
            OrganizationReviewCheckReason.SETUP_READINESS_CHECKOUT_LINK_NOT_FULFILLABLE
            in step.reasons
        )
        checkout_link_sub = _sub(
            step, OrganizationReviewSubCheckKey.SETUP_READINESS_CHECKOUT_LINK
        )
        assert checkout_link_sub.status == OrganizationReviewCheckStatus.FAILED
        assert (
            OrganizationReviewCheckReason.SETUP_READINESS_CHECKOUT_LINK_NOT_FULFILLABLE
            in checkout_link_sub.reasons
        )

    async def test_setup_readiness_access_token_and_webhook_passes(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        organization: Organization,
    ) -> None:
        await save_fixture(
            OrganizationAccessToken(
                comment="test",
                token="hash",
                organization=organization,
                scope="openid",
            )
        )
        await create_webhook_endpoint(save_fixture, organization=organization)

        state = await organization_service.get_review_state(session, organization)
        step = _step(state, OrganizationReviewCheckKey.SETUP_READINESS)

        assert step.status == OrganizationReviewCheckStatus.PASSED
        assert (
            _sub(
                step, OrganizationReviewSubCheckKey.SETUP_READINESS_CHECKOUT_LINK
            ).status
            == OrganizationReviewCheckStatus.PENDING
        )
        assert (
            _sub(
                step, OrganizationReviewSubCheckKey.SETUP_READINESS_ACCESS_TOKEN
            ).status
            == OrganizationReviewCheckStatus.PASSED
        )
        assert (
            _sub(step, OrganizationReviewSubCheckKey.SETUP_READINESS_WEBHOOK).status
            == OrganizationReviewCheckStatus.PASSED
        )

    async def test_setup_readiness_access_token_without_webhook_warns(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        organization: Organization,
    ) -> None:
        await save_fixture(
            OrganizationAccessToken(
                comment="test",
                token="hash",
                organization=organization,
                scope="openid",
            )
        )

        state = await organization_service.get_review_state(session, organization)
        step = _step(state, OrganizationReviewCheckKey.SETUP_READINESS)

        assert step.status == OrganizationReviewCheckStatus.WARNING
        assert step.reasons == [
            OrganizationReviewCheckReason.SETUP_READINESS_WEBHOOK_MISSING
        ]
        access_token_sub = _sub(
            step, OrganizationReviewSubCheckKey.SETUP_READINESS_ACCESS_TOKEN
        )
        assert access_token_sub.status == OrganizationReviewCheckStatus.PASSED
        webhook_sub = _sub(step, OrganizationReviewSubCheckKey.SETUP_READINESS_WEBHOOK)
        assert webhook_sub.status == OrganizationReviewCheckStatus.WARNING
        assert (
            OrganizationReviewCheckReason.SETUP_READINESS_WEBHOOK_MISSING
            in webhook_sub.reasons
        )
        # Warnings do not block submission, even when this check is in WARNING.
        non_setup_failing = [
            s
            for s in state.preliminary_steps
            if s.key != OrganizationReviewCheckKey.SETUP_READINESS
            and s.status
            in (
                OrganizationReviewCheckStatus.FAILED,
                OrganizationReviewCheckStatus.PENDING,
            )
        ]
        assert non_setup_failing  # other checks block, not this warning

    async def test_all_checks_pass_can_submit(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        organization: Organization,
        user: User,
    ) -> None:
        await _setup_passing_org(save_fixture, organization, user)

        state = await organization_service.get_review_state(session, organization)

        assert state.can_submit is True
        assert all(
            step.status == OrganizationReviewCheckStatus.PASSED
            for step in state.preliminary_steps
        )

    async def test_missing_socials_does_not_block_submission(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        organization: Organization,
        user: User,
    ) -> None:
        await _setup_passing_org(save_fixture, organization, user)
        organization.socials = []
        await save_fixture(organization)

        state = await organization_service.get_review_state(session, organization)

        socials_step = _step(state, OrganizationReviewCheckKey.IDENTITY_SOCIAL_LINKS)
        assert socials_step.status == OrganizationReviewCheckStatus.PENDING
        assert state.can_submit is True

    async def test_submitted_blocks_resubmission(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        organization: Organization,
        user: User,
    ) -> None:
        await _setup_passing_org(save_fixture, organization, user)
        organization.details_submitted_at = datetime.now(UTC)
        await save_fixture(organization)

        state = await organization_service.get_review_state(session, organization)

        assert state.submitted_at is not None
        assert state.can_submit is False

    @pytest.mark.parametrize(
        ("verdict", "expected"),
        [
            (OrganizationReview.Verdict.PASS, "pass"),
            (OrganizationReview.Verdict.FAIL, "fail"),
            (OrganizationReview.Verdict.UNCERTAIN, None),
        ],
    )
    async def test_verdict_mapping(
        self,
        session: AsyncSession,
        organization: Organization,
        verdict: OrganizationReview.Verdict,
        expected: str | None,
    ) -> None:
        review = OrganizationReview(
            organization_id=organization.id,
            verdict=verdict,
            risk_score=10.0,
            violated_sections=[],
            reason="test",
            timed_out=False,
            organization_details_snapshot={},
            model_used="test-model",
        )
        session.add(review)
        await session.flush()

        state = await organization_service.get_review_state(session, organization)

        assert state.verdict == expected
        assert state.appeal is None

    async def test_appeal_pending_decision(
        self,
        session: AsyncSession,
        organization: Organization,
    ) -> None:
        appeal_submitted = datetime.now(UTC)
        review = OrganizationReview(
            organization_id=organization.id,
            verdict=OrganizationReview.Verdict.FAIL,
            risk_score=80.0,
            violated_sections=[],
            reason="High risk",
            timed_out=False,
            organization_details_snapshot={},
            model_used="test-model",
            appeal_submitted_at=appeal_submitted,
            appeal_reason="Please reconsider, here's why...",
        )
        session.add(review)
        await session.flush()

        state = await organization_service.get_review_state(session, organization)

        assert state.appeal is not None
        assert state.appeal.submitted_at == appeal_submitted
        assert state.appeal.reviewed_at is None
        assert state.appeal.decision is None

    async def test_appeal_approved(
        self,
        session: AsyncSession,
        organization: Organization,
    ) -> None:
        appeal_submitted = datetime.now(UTC)
        appeal_reviewed = datetime.now(UTC) + timedelta(hours=1)
        review = OrganizationReview(
            organization_id=organization.id,
            verdict=OrganizationReview.Verdict.FAIL,
            risk_score=80.0,
            violated_sections=[],
            reason="High risk",
            timed_out=False,
            organization_details_snapshot={},
            model_used="test-model",
            appeal_submitted_at=appeal_submitted,
            appeal_reason="Please reconsider, here's why...",
            appeal_reviewed_at=appeal_reviewed,
            appeal_decision=OrganizationReview.AppealDecision.APPROVED,
        )
        session.add(review)
        await session.flush()

        state = await organization_service.get_review_state(session, organization)

        assert state.appeal is not None
        assert state.appeal.decision == OrganizationReview.AppealDecision.APPROVED
        assert state.appeal.reviewed_at == appeal_reviewed


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
        await save_fixture(
            UserOrganization(
                user_id=user.id,
                organization_id=organization.id,
                role=OrganizationRole.owner,
            )
        )

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

    async def test_closes_open_appeal_case(
        self,
        mocker: MockerFixture,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
        user: User,
    ) -> None:
        mocker.patch("polar.organization.service.polar_self_service")
        review = OrganizationReview(
            organization_id=organization.id,
            verdict=OrganizationReview.Verdict.FAIL,
            risk_score=90.0,
            violated_sections=[],
            reason="Automated review denied.",
            model_used="test",
            appeal_submitted_at=datetime.now(UTC),
            appeal_reason="Please reconsider.",
            appeal_reviewed_at=datetime.now(UTC),
            appeal_decision=OrganizationReview.AppealDecision.REJECTED,
        )
        await save_fixture(review)
        case = await appeal_case_service.request_human_review(
            session,
            review,
            reason="Here is the additional context for the review.",
            requested_by_user=user,
            organization=organization,
        )

        await organization_service.soft_delete_organization(session, organization)

        message_repository = SupportCaseMessageRepository.from_session(session)
        assert await message_repository.is_open(case.id) is False

    async def test_leaves_dispute_case_open(
        self,
        mocker: MockerFixture,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
        customer: Customer,
        product: Product,
    ) -> None:
        # Disputes are live financial matters — they must outlive the merchant
        # deleting their account.
        mocker.patch("polar.organization.service.polar_self_service")
        order = await create_order(save_fixture, customer=customer, product=product)
        payment = await create_payment(save_fixture, organization, order=order)
        dispute = await create_dispute(save_fixture, order, payment)
        case = await dispute_case_service.open_case(
            session, dispute, organization=organization
        )
        assert case.organization_id == organization.id

        await organization_service.soft_delete_organization(session, organization)

        message_repository = SupportCaseMessageRepository.from_session(session)
        assert await message_repository.is_open(case.id) is True

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
            session, organization, release_slug=True
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
        await organization_service.soft_delete_organization(
            session, organization, release_slug=True
        )
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
            session, organization, release_slug=True
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

    async def test_scrubs_slug_without_releasing(
        self,
        mocker: MockerFixture,
        session: AsyncSession,
        organization: Organization,
    ) -> None:
        # Backoffice/erasure deletions scrub the slug as PII rather than
        # archiving it for reuse, leaving no recoverable trace of the original.
        mocker.patch("polar.organization.service.polar_self_service")
        original_slug = organization.slug

        result = await organization_service.soft_delete_organization(
            session, organization
        )

        assert result.slug != original_slug
        assert original_slug not in result.slug
        assert result.slug_history == []


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
                feature_settings=OrganizationFeatureSettingsUpdate(
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
                    feature_settings=OrganizationFeatureSettingsUpdate(
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
                    feature_settings=OrganizationFeatureSettingsUpdate(
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
                feature_settings=OrganizationFeatureSettingsUpdate(
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
                feature_settings=OrganizationFeatureSettingsUpdate(
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
                feature_settings=OrganizationFeatureSettingsUpdate(
                    seat_based_pricing_enabled=True,
                ),
            ),
        )

        assert result.feature_settings["seat_based_pricing_enabled"] is True


@pytest.mark.asyncio
class TestUpdateFeatureSettings:
    async def test_non_updatable_flag_ignored(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
    ) -> None:
        organization.feature_settings = {}
        await save_fixture(organization)

        result = await organization_service.update(
            session,
            organization,
            OrganizationUpdate.model_validate(
                {"feature_settings": {"off_session_charges_enabled": True}}
            ),
        )

        assert "off_session_charges_enabled" not in result.feature_settings

    async def test_non_updatable_flag_preserved(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
    ) -> None:
        organization.feature_settings = {"preview_access_enabled": True}
        await save_fixture(organization)

        result = await organization_service.update(
            session,
            organization,
            OrganizationUpdate.model_validate(
                {
                    "feature_settings": {
                        "preview_access_enabled": False,
                        "checkout_localization_enabled": True,
                    }
                }
            ),
        )

        assert result.feature_settings["preview_access_enabled"] is True
        assert result.feature_settings["checkout_localization_enabled"] is True

    async def test_enable_member_model_enqueues_backfill(
        self,
        mocker: MockerFixture,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
    ) -> None:
        enqueue_job_mock = mocker.patch("polar.organization.service.enqueue_job")
        organization.feature_settings = {}
        await save_fixture(organization)

        result = await organization_service.update(
            session,
            organization,
            OrganizationUpdate.model_validate(
                {"feature_settings": {"member_model_enabled": True}}
            ),
        )

        assert result.feature_settings["member_model_enabled"] is True
        enqueue_job_mock.assert_called_once_with(
            "organization.backfill_members", organization_id=organization.id
        )

    async def test_overview_metrics_updated(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
    ) -> None:
        organization.feature_settings = {"member_model_enabled": True}
        await save_fixture(organization)

        result = await organization_service.update(
            session,
            organization,
            OrganizationUpdate.model_validate(
                {"feature_settings": {"overview_metrics": ["revenue", "orders"]}}
            ),
        )

        assert result.feature_settings["overview_metrics"] == ["revenue", "orders"]
        assert result.feature_settings["member_model_enabled"] is True


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

    async def test_enqueues_cancel_pending_payouts(
        self,
        mocker: MockerFixture,
        session: AsyncSession,
        organization: Organization,
    ) -> None:
        organization.status = OrganizationStatus.REVIEW
        enqueue_job_mock = mocker.patch("polar.organization.service.enqueue_job")

        await organization_service.set_organization_offboarding(session, organization)

        enqueue_job_mock.assert_any_call(
            "payout.cancel_account_payouts",
            account_id=organization.account_id,
        )


@pytest.mark.asyncio
class TestSetOrganizationOffboarded:
    async def test_from_offboarding(
        self,
        mocker: MockerFixture,
        session: AsyncSession,
        organization: Organization,
    ) -> None:
        organization.status = OrganizationStatus.OFFBOARDING
        enqueue_job_mock = mocker.patch("polar.organization.service.enqueue_job")

        result = await organization_service.set_organization_offboarded(
            session, organization
        )

        assert result.status == OrganizationStatus.OFFBOARDED
        assert result.status_updated_at is not None
        assert result.internal_notes is not None
        assert "Manually offboarded" in result.internal_notes
        enqueue_job_mock.assert_called_once_with(
            "organization.offboarded", organization_id=organization.id
        )

    @pytest.mark.parametrize(
        "status",
        [
            OrganizationStatus.REVIEW,
            OrganizationStatus.SNOOZED,
            OrganizationStatus.ACTIVE,
            OrganizationStatus.DENIED,
            OrganizationStatus.CREATED,
            OrganizationStatus.OFFBOARDED,
        ],
    )
    async def test_from_non_offboarding_raises(
        self,
        status: OrganizationStatus,
        session: AsyncSession,
        organization: Organization,
    ) -> None:
        organization.status = status

        with pytest.raises(Exception, match="Only organizations that are offboarding"):
            await organization_service.set_organization_offboarded(
                session, organization
            )


@pytest.mark.asyncio
class TestSnoozeOrganization:
    async def test_from_review(
        self,
        session: AsyncSession,
        organization: Organization,
    ) -> None:
        organization.status = OrganizationStatus.REVIEW
        organization.snooze_count = 0

        result = await organization_service.snooze_organization(
            session, organization, days=7, snooze_type=SnoozeType.NEXT_SALE
        )

        assert result.status == OrganizationStatus.SNOOZED
        assert result.snooze_count == 1
        assert result.status_updated_at is not None
        assert result.snoozed_until is not None
        assert result.snooze_type == SnoozeType.NEXT_SALE

    async def test_time_based_sets_deadline(
        self,
        session: AsyncSession,
        organization: Organization,
    ) -> None:
        organization.status = OrganizationStatus.REVIEW
        organization.snooze_count = 0

        before = datetime.now(UTC)
        result = await organization_service.snooze_organization(
            session, organization, days=5, snooze_type=SnoozeType.TIME_BASED
        )
        after = datetime.now(UTC)

        assert result.snooze_type == SnoozeType.TIME_BASED
        assert result.snoozed_until is not None
        assert before + timedelta(days=5) <= result.snoozed_until
        assert result.snoozed_until <= after + timedelta(days=5)

    async def test_increments_snooze_count(
        self,
        session: AsyncSession,
        organization: Organization,
    ) -> None:
        organization.status = OrganizationStatus.REVIEW
        organization.snooze_count = 3

        result = await organization_service.snooze_organization(
            session, organization, days=7, snooze_type=SnoozeType.NEXT_SALE
        )

        assert result.snooze_count == 4

    async def test_from_non_review_raises(
        self,
        session: AsyncSession,
        organization: Organization,
    ) -> None:
        organization.status = OrganizationStatus.ACTIVE

        with pytest.raises(Exception, match="Only organizations under review"):
            await organization_service.snooze_organization(
                session, organization, days=7, snooze_type=SnoozeType.NEXT_SALE
            )

    async def test_invalid_days_raises(
        self,
        session: AsyncSession,
        organization: Organization,
    ) -> None:
        organization.status = OrganizationStatus.REVIEW

        with pytest.raises(Exception, match="Snooze duration must be"):
            await organization_service.snooze_organization(
                session, organization, days=0, snooze_type=SnoozeType.NEXT_SALE
            )

    async def test_with_reason_appends_internal_notes(
        self,
        session: AsyncSession,
        organization: Organization,
    ) -> None:
        organization.status = OrganizationStatus.REVIEW
        organization.snooze_count = 0
        organization.internal_notes = None

        result = await organization_service.snooze_organization(
            session,
            organization,
            days=7,
            snooze_type=SnoozeType.NEXT_SALE,
            reason="Merchant not responding",
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

        result = await organization_service.snooze_organization(
            session, organization, days=7, snooze_type=SnoozeType.NEXT_SALE
        )

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
        organization.snoozed_until = datetime.now(UTC) + timedelta(days=7)
        organization.snooze_type = SnoozeType.NEXT_SALE
        enqueue_job_mock = mocker.patch("polar.organization.service.enqueue_job")

        result = await organization_service.unsnooze_organization(session, organization)

        assert result.status == OrganizationStatus.REVIEW
        assert result.status_updated_at is not None
        assert result.snoozed_until is None
        assert result.snooze_type is None
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
class TestUnsnoozeExpiredOrganizations:
    async def test_expired_time_based_transitions(
        self,
        mocker: MockerFixture,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
    ) -> None:
        organization.status = OrganizationStatus.SNOOZED
        organization.snoozed_until = datetime.now(UTC) - timedelta(hours=1)
        organization.snooze_type = SnoozeType.TIME_BASED
        await save_fixture(organization)
        enqueue_job_mock = mocker.patch("polar.organization.service.enqueue_job")

        result = await organization_service.unsnooze_expired_organizations(session)

        assert len(result) == 1
        assert result[0].id == organization.id
        assert result[0].status == OrganizationStatus.REVIEW
        assert result[0].snoozed_until is None
        assert result[0].snooze_type is None
        enqueue_job_mock.assert_called_once_with(
            "organization.under_review", organization_id=organization.id
        )

    async def test_future_deadline_skipped(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
    ) -> None:
        organization.status = OrganizationStatus.SNOOZED
        organization.snoozed_until = datetime.now(UTC) + timedelta(days=1)
        organization.snooze_type = SnoozeType.TIME_BASED
        await save_fixture(organization)

        result = await organization_service.unsnooze_expired_organizations(session)

        assert result == []
        assert organization.status == OrganizationStatus.SNOOZED

    async def test_next_sale_snooze_skipped(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
    ) -> None:
        # NEXT_SALE snoozes are handled by check_review_threshold, not the cron.
        organization.status = OrganizationStatus.SNOOZED
        organization.snoozed_until = datetime.now(UTC) - timedelta(hours=1)
        organization.snooze_type = SnoozeType.NEXT_SALE
        await save_fixture(organization)

        result = await organization_service.unsnooze_expired_organizations(session)

        assert result == []
        assert organization.status == OrganizationStatus.SNOOZED

    async def test_status_changed_concurrently_is_skipped(
        self,
        mocker: MockerFixture,
        session: AsyncSession,
        organization: Organization,
    ) -> None:
        # Simulate the race: the candidate query returns an org whose status
        # has flipped to ACTIVE between SELECT and UPDATE. The guard must
        # skip without raising InvalidStatusTransitionError.
        organization.status = OrganizationStatus.ACTIVE
        mocker.patch.object(
            OrganizationRepository,
            "get_expired_time_based_snoozes",
            return_value=[organization],
        )
        enqueue_job_mock = mocker.patch("polar.organization.service.enqueue_job")

        result = await organization_service.unsnooze_expired_organizations(session)

        assert result == []
        assert organization.status == OrganizationStatus.ACTIVE
        enqueue_job_mock.assert_not_called()


@pytest.mark.asyncio
class TestOffboardExpiredOrganizations:
    async def _make_offboarding(
        self,
        save_fixture: SaveFixture,
        organization: Organization,
        *,
        status_updated_days_ago: int,
    ) -> None:
        organization.status = OrganizationStatus.OFFBOARDING
        organization.status_updated_at = datetime.now(UTC) - timedelta(
            days=status_updated_days_ago
        )
        await save_fixture(organization)

    async def test_both_anchors_old_transitions(
        self,
        mocker: MockerFixture,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
        customer: Customer,
    ) -> None:
        # Both gates clear: chargeback window expired and merchant has had
        # their wind-down period in offboarding.
        await self._make_offboarding(
            save_fixture, organization, status_updated_days_ago=121
        )
        await create_order(
            save_fixture,
            customer=customer,
            status=OrderStatus.paid,
            created_at=datetime.now(UTC) - timedelta(days=121),
        )
        enqueue_job_mock = mocker.patch("polar.organization.service.enqueue_job")

        result = await organization_service.offboard_expired_organizations(session)

        assert len(result) == 1
        assert result[0].id == organization.id
        assert result[0].status == OrganizationStatus.OFFBOARDED
        enqueue_job_mock.assert_called_once_with(
            "organization.offboarded", organization_id=organization.id
        )

    async def test_old_paid_order_but_recent_offboarding_skipped(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
        customer: Customer,
    ) -> None:
        # Regression: an org freshly put into offboarding must still get its
        # full wind-down period even if its last payment is already past the
        # chargeback window. Anchor = MAX(last_paid, status_updated_at).
        await self._make_offboarding(
            save_fixture, organization, status_updated_days_ago=4
        )
        await create_order(
            save_fixture,
            customer=customer,
            status=OrderStatus.paid,
            created_at=datetime.now(UTC) - timedelta(days=149),
        )

        result = await organization_service.offboard_expired_organizations(session)

        assert result == []
        assert organization.status == OrganizationStatus.OFFBOARDING

    async def test_recent_paid_order_skipped(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
        customer: Customer,
    ) -> None:
        # Old offboarding date, but a recent paid order anchors the window.
        await self._make_offboarding(
            save_fixture, organization, status_updated_days_ago=200
        )
        await create_order(
            save_fixture,
            customer=customer,
            status=OrderStatus.paid,
            created_at=datetime.now(UTC) - timedelta(days=10),
        )

        result = await organization_service.offboard_expired_organizations(session)

        assert result == []
        assert organization.status == OrganizationStatus.OFFBOARDING

    async def test_partially_refunded_recent_order_skipped(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
        customer: Customer,
    ) -> None:
        # Partially refunded orders still count as paid-and-not-fully-refunded.
        await self._make_offboarding(
            save_fixture, organization, status_updated_days_ago=200
        )
        await create_order(
            save_fixture,
            customer=customer,
            status=OrderStatus.partially_refunded,
            created_at=datetime.now(UTC) - timedelta(days=10),
        )

        result = await organization_service.offboard_expired_organizations(session)

        assert result == []
        assert organization.status == OrganizationStatus.OFFBOARDING

    async def test_fully_refunded_order_falls_back_to_status_updated_at(
        self,
        mocker: MockerFixture,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
        customer: Customer,
    ) -> None:
        # A fully refunded order is ignored, so the window falls back to the
        # offboarding-entry date, which is old enough here.
        await self._make_offboarding(
            save_fixture, organization, status_updated_days_ago=121
        )
        await create_order(
            save_fixture,
            customer=customer,
            status=OrderStatus.refunded,
            created_at=datetime.now(UTC) - timedelta(days=1),
        )
        enqueue_job_mock = mocker.patch("polar.organization.service.enqueue_job")

        result = await organization_service.offboard_expired_organizations(session)

        assert len(result) == 1
        assert result[0].status == OrganizationStatus.OFFBOARDED
        enqueue_job_mock.assert_called_once_with(
            "organization.offboarded", organization_id=organization.id
        )

    async def test_no_orders_uses_status_updated_at(
        self,
        mocker: MockerFixture,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
    ) -> None:
        await self._make_offboarding(
            save_fixture, organization, status_updated_days_ago=121
        )
        enqueue_job_mock = mocker.patch("polar.organization.service.enqueue_job")

        result = await organization_service.offboard_expired_organizations(session)

        assert len(result) == 1
        assert result[0].status == OrganizationStatus.OFFBOARDED
        enqueue_job_mock.assert_called_once_with(
            "organization.offboarded", organization_id=organization.id
        )

    async def test_recent_offboarding_no_orders_skipped(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
    ) -> None:
        await self._make_offboarding(
            save_fixture, organization, status_updated_days_ago=10
        )

        result = await organization_service.offboard_expired_organizations(session)

        assert result == []
        assert organization.status == OrganizationStatus.OFFBOARDING

    async def test_old_offboarding_recent_paid_order_skipped(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
        customer: Customer,
    ) -> None:
        # Mirror of the resumeset case: chargeback gate clears (offboarding is
        # ancient) but the merchant just took a payment, so we must wait
        # another 120 days from that payment before the terminal transition.
        await self._make_offboarding(
            save_fixture, organization, status_updated_days_ago=200
        )
        await create_order(
            save_fixture,
            customer=customer,
            status=OrderStatus.paid,
            created_at=datetime.now(UTC) - timedelta(days=4),
        )

        result = await organization_service.offboard_expired_organizations(session)

        assert result == []
        assert organization.status == OrganizationStatus.OFFBOARDING


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

    @pytest.mark.auth
    async def test_activates_when_all_gates_pass(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
        user_organization: UserOrganization,
        user: User,
    ) -> None:
        organization.status = OrganizationStatus.CREATED
        organization.details_submitted_at = datetime(2026, 5, 4, 12, 0, tzinfo=UTC)
        organization.details = {
            "product_description": "Subscription SaaS for software teams."
        }
        await save_fixture(organization)

        user.identity_verification_status = IdentityVerificationStatus.verified
        await save_fixture(user)

        review = OrganizationReview(
            organization_id=organization.id,
            verdict=OrganizationReview.Verdict.PASS,
            risk_score=10.0,
            violated_sections=[],
            reason="Clean",
            model_used="test",
        )
        session.add(review)
        await session.flush()

        payout_account = await create_payout_account(
            save_fixture, organization, user, type=PayoutAccountType.stripe
        )
        organization.payout_account = None
        await save_fixture(organization)

        updated_org = await organization_service.set_payout_account(
            session, organization, payout_account
        )

        assert updated_org.payout_account_id == payout_account.id
        assert updated_org.status == OrganizationStatus.ACTIVE

    @pytest.mark.auth
    async def test_swap_cancels_held_payouts(
        self,
        mocker: MockerFixture,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
        user_organization: UserOrganization,
        user: User,
    ) -> None:
        old_payout_account = await create_payout_account(
            save_fixture, organization, user, type=PayoutAccountType.stripe
        )
        new_payout_account = await create_payout_account(
            save_fixture, organization, user, type=PayoutAccountType.stripe
        )
        # create_payout_account links the org to whichever account it just
        # created, so pin the "previous" account back to the old one.
        organization.payout_account = old_payout_account
        await save_fixture(organization)

        enqueue_job_mock = mocker.patch("polar.organization.service.enqueue_job")

        await organization_service.set_payout_account(
            session, organization, new_payout_account
        )

        enqueue_job_mock.assert_any_call(
            "payout.cancel_held_payouts",
            account_id=organization.account_id,
            payout_account_id=old_payout_account.id,
        )

    @pytest.mark.auth
    async def test_no_swap_does_not_cancel(
        self,
        mocker: MockerFixture,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
        user_organization: UserOrganization,
        user: User,
    ) -> None:
        payout_account = await create_payout_account(
            save_fixture, organization, user, type=PayoutAccountType.stripe
        )
        organization.payout_account = payout_account
        await save_fixture(organization)

        enqueue_job_mock = mocker.patch("polar.organization.service.enqueue_job")

        await organization_service.set_payout_account(
            session, organization, payout_account
        )

        cancel_calls = [
            c
            for c in enqueue_job_mock.call_args_list
            if c.args and c.args[0] == "payout.cancel_held_payouts"
        ]
        assert cancel_calls == []


class TestLegacyOrganizationStatus:
    @pytest.mark.parametrize("status", list(OrganizationStatus))
    def test_from_status_covers_every_status(self, status: OrganizationStatus) -> None:
        # Every status must map to a legacy value — a missing entry would 500
        # when serializing the org through the public schema.
        assert isinstance(
            LegacyOrganizationStatus.from_status(status), LegacyOrganizationStatus
        )

    def test_offboarded_maps_to_denied(self) -> None:
        assert (
            LegacyOrganizationStatus.from_status(OrganizationStatus.OFFBOARDED)
            == LegacyOrganizationStatus.DENIED
        )


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
            OrganizationStatus.OFFBOARDED,
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

    async def test_offboarding_can_go_to_offboarded(
        self,
        organization: Organization,
    ) -> None:
        organization.status = OrganizationStatus.OFFBOARDING
        organization.set_status(OrganizationStatus.OFFBOARDED)
        assert organization.status == OrganizationStatus.OFFBOARDED
        assert (
            organization.capabilities
            == STATUS_CAPABILITIES[OrganizationStatus.OFFBOARDED]
        )

    async def test_offboarded_enables_payout_blocks_payments(
        self,
        organization: Organization,
    ) -> None:
        organization.status = OrganizationStatus.OFFBOARDING
        organization.set_status(OrganizationStatus.OFFBOARDED)
        assert organization.can_payout is True
        assert organization.can_accept_payments is False
        assert organization.can_renew_subscriptions is False
        assert organization.can_refund is False

    @pytest.mark.parametrize(
        "target",
        [
            OrganizationStatus.ACTIVE,
            OrganizationStatus.REVIEW,
            OrganizationStatus.DENIED,
            OrganizationStatus.OFFBOARDING,
        ],
    )
    async def test_offboarded_is_terminal_except_blocked(
        self,
        target: OrganizationStatus,
        organization: Organization,
    ) -> None:
        organization.status = OrganizationStatus.OFFBOARDED
        with pytest.raises(InvalidStatusTransitionError):
            organization.set_status(target)

    async def test_review_can_go_to_offboarding(
        self,
        organization: Organization,
    ) -> None:
        organization.status = OrganizationStatus.REVIEW
        organization.set_status(OrganizationStatus.OFFBOARDING)
        assert organization.status == OrganizationStatus.OFFBOARDING

    async def test_offboarding_can_go_to_denied(
        self,
        organization: Organization,
    ) -> None:
        organization.status = OrganizationStatus.OFFBOARDING
        organization.set_status(OrganizationStatus.DENIED)
        assert organization.status == OrganizationStatus.DENIED

    async def test_offboarding_can_go_to_review(
        self,
        organization: Organization,
    ) -> None:
        organization.status = OrganizationStatus.OFFBOARDING
        organization.set_status(OrganizationStatus.REVIEW)
        assert organization.status == OrganizationStatus.REVIEW

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
        user: User,
    ) -> None:
        organization.status = current
        organization.initially_reviewed_at = datetime(2025, 1, 1, 12, 0, tzinfo=UTC)
        mocker.patch("polar.organization.service.enqueue_job")

        result = await organization_service.backoffice_approve(
            session,
            organization,
            15000,
            reason="Merchant provided additional docs",
            staff_user=user,
        )

        assert result.status == OrganizationStatus.CREATED
        assert result.internal_notes is not None
        assert expected_note_fragment in result.internal_notes
        assert "Merchant provided additional docs" in result.internal_notes
        assert "pending Stripe Identity" in result.internal_notes

    async def test_internal_note_overrides_default_note_and_omits_reason(
        self,
        mocker: MockerFixture,
        session: AsyncSession,
        organization: Organization,
        user: User,
    ) -> None:
        organization.status = OrganizationStatus.DENIED
        organization.initially_reviewed_at = datetime(2025, 1, 1, 12, 0, tzinfo=UTC)
        mocker.patch("polar.organization.service.enqueue_job")

        result = await organization_service.backoffice_approve(
            session,
            organization,
            reason="Lives on the support case, not the note",
            internal_note="Appeal approved — see support case.",
            staff_user=user,
        )

        assert result.internal_notes is not None
        assert "Appeal approved — see support case." in result.internal_notes
        # The default reactivation wording and the reason are both dropped.
        assert "reactivated from denied" not in result.internal_notes
        assert "Lives on the support case" not in result.internal_notes

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
        await save_fixture(
            UserOrganization(
                user_id=user.id,
                organization_id=organization.id,
                role=OrganizationRole.owner,
            )
        )

        await create_payout_account(save_fixture, organization, user)

        mocker.patch("polar.organization.service.enqueue_job")

        result = await organization_service.backoffice_approve(
            session,
            organization,
            15000,
            reason="Merchant provided additional docs",
            staff_user=user,
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


@pytest.mark.asyncio
class TestChangeOwnerRoleSwap:
    """
    `change_owner` swaps `UserOrganization.role`: the previous `owner` is
    demoted to `admin`, and the new owner is promoted to `owner`. The flow
    no longer touches `Account.admin_id`; ownership is driven entirely
    by `UserOrganization.role`.
    """

    async def test_swaps_owner_role_on_owner_change(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        organization: Organization,
        user: User,
        user_second: User,
    ) -> None:
        previous_owner_uo = UserOrganization(
            user_id=user.id,
            organization_id=organization.id,
            role=OrganizationRole.owner,
        )
        new_owner_uo = UserOrganization(
            user_id=user_second.id,
            organization_id=organization.id,
            role=OrganizationRole.member,
        )
        await save_fixture(previous_owner_uo)
        await save_fixture(new_owner_uo)

        user_second.identity_verification_status = IdentityVerificationStatus.verified
        await save_fixture(user_second)

        await organization_service.change_owner(
            session,
            new_owner_id=user_second.id,
            organization_id=organization.id,
        )

        previous = await user_organization_service.get_by_user_and_org(
            session, user.id, organization.id
        )
        new = await user_organization_service.get_by_user_and_org(
            session, user_second.id, organization.id
        )
        assert previous is not None
        assert new is not None
        assert previous.role == OrganizationRole.admin
        assert new.role == OrganizationRole.owner

    async def test_no_previous_owner_promotes_new_owner(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        organization: Organization,
        user: User,
        user_second: User,
    ) -> None:
        # Edge case: org has no current `owner` (shouldn't happen in
        # production post-backfill, but the swap should still promote
        # the new owner rather than blow up).
        previous_member_uo = UserOrganization(
            user_id=user.id,
            organization_id=organization.id,
            role=OrganizationRole.member,
        )
        new_owner_uo = UserOrganization(
            user_id=user_second.id,
            organization_id=organization.id,
            role=OrganizationRole.member,
        )
        await save_fixture(previous_member_uo)
        await save_fixture(new_owner_uo)

        user_second.identity_verification_status = IdentityVerificationStatus.verified
        await save_fixture(user_second)

        await organization_service.change_owner(
            session,
            new_owner_id=user_second.id,
            organization_id=organization.id,
        )

        previous = await user_organization_service.get_by_user_and_org(
            session, user.id, organization.id
        )
        new = await user_organization_service.get_by_user_and_org(
            session, user_second.id, organization.id
        )
        assert previous is not None
        assert new is not None
        assert previous.role == OrganizationRole.member
        assert new.role == OrganizationRole.owner


@pytest.mark.asyncio
class TestAddUser:
    @pytest.mark.parametrize(
        ("organization_role", "expected_member_role"),
        [
            (OrganizationRole.owner, MemberRole.billing_manager),
            (OrganizationRole.admin, MemberRole.billing_manager),
            (OrganizationRole.member, MemberRole.member),
        ],
    )
    async def test_mirrors_org_role_to_polar_self_member_role(
        self,
        mocker: MockerFixture,
        session: AsyncSession,
        organization: Organization,
        user: User,
        organization_role: OrganizationRole,
        expected_member_role: MemberRole,
    ) -> None:
        add_member_mock = mocker.patch(
            "polar.organization.service.polar_self_service.enqueue_add_member"
        )

        await organization_service.add_user(
            session, organization, user, role=organization_role
        )

        add_member_mock.assert_called_once_with(
            external_customer_id=str(organization.id),
            email=user.email,
            name=user.full_name or user.email.split("@", 1)[0],
            external_id=str(user.id),
            role=expected_member_role,
            delay=None,
        )
