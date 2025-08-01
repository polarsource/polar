from datetime import UTC, datetime

import pytest
from pydantic import ValidationError
from pytest_mock import MockerFixture

from polar.auth.models import AuthSubject
from polar.config import settings
from polar.enums import AccountType
from polar.exceptions import PolarRequestValidationError
from polar.models import Organization, Product, User
from polar.models.account import Account
from polar.models.organization import OrganizationNotificationSettings
from polar.models.user import IdentityVerificationStatus
from polar.organization.schemas import OrganizationCreate, OrganizationFeatureSettings
from polar.organization.service import organization as organization_service
from polar.postgres import AsyncSession
from polar.user_organization.service import (
    user_organization as user_organization_service,
)
from tests.fixtures.database import SaveFixture


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
async def test_get_next_invoice_number(
    session: AsyncSession,
    organization: Organization,
) -> None:
    assert organization.customer_invoice_next_number == 1

    next_invoice_number = await organization_service.get_next_invoice_number(
        session, organization
    )

    assert next_invoice_number == f"{organization.customer_invoice_prefix}-0001"
    assert organization.customer_invoice_next_number == 2


@pytest.mark.asyncio
class TestCheckReviewThreshold:
    async def test_already_under_review(
        self,
        session: AsyncSession,
        organization: Organization,
    ) -> None:
        # Given organization already under review
        organization.status = Organization.Status.UNDER_REVIEW
        organization.next_review_threshold = 1000

        # When
        result = await organization_service.check_review_threshold(
            session, organization
        )

        # Then
        assert result.status == Organization.Status.UNDER_REVIEW

    async def test_zero_threshold(
        self,
        mocker: MockerFixture,
        session: AsyncSession,
        organization: Organization,
    ) -> None:
        # Given organization with review threshold set to 0
        organization.status = Organization.Status.ACTIVE
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
        assert result.status == Organization.Status.UNDER_REVIEW
        transaction_sum_mock.assert_called_once()

    async def test_below_review_threshold(
        self,
        mocker: MockerFixture,
        session: AsyncSession,
        organization: Organization,
    ) -> None:
        # Given organization below review threshold
        organization.status = Organization.Status.ACTIVE
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
        assert result.status == Organization.Status.ACTIVE
        transaction_sum_mock.assert_called_once()

    async def test_above_review_threshold(
        self,
        mocker: MockerFixture,
        session: AsyncSession,
        organization: Organization,
    ) -> None:
        # Given organization above review threshold
        organization.status = Organization.Status.ACTIVE
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
        assert result.status == Organization.Status.UNDER_REVIEW
        transaction_sum_mock.assert_called_once()
        enqueue_job_mock.assert_called_once_with(
            "organization.under_review", organization_id=organization.id
        )


@pytest.mark.asyncio
class TestConfirmOrganizationReviewed:
    async def test_confirm_organization_reviewed(
        self,
        mocker: MockerFixture,
        session: AsyncSession,
        organization: Organization,
    ) -> None:
        # Given organization under review
        organization.status = Organization.Status.UNDER_REVIEW

        enqueue_job_mock = mocker.patch("polar.organization.service.enqueue_job")

        # When
        result = await organization_service.confirm_organization_reviewed(
            session, organization, 15000
        )

        # Then
        assert result.status == Organization.Status.ACTIVE
        assert result.next_review_threshold == 15000
        enqueue_job_mock.assert_called_once_with(
            "organization.reviewed", organization_id=organization.id
        )


@pytest.mark.asyncio
class TestDenyOrganization:
    async def test_deny_organization(
        self,
        session: AsyncSession,
        organization: Organization,
    ) -> None:
        # Given organization active
        organization.status = Organization.Status.ACTIVE

        # When
        result = await organization_service.deny_organization(session, organization)

        # Then
        assert result.status == Organization.Status.DENIED


@pytest.mark.asyncio
class TestSetOrganizationUnderReview:
    async def test_set_organization_under_review(
        self,
        mocker: MockerFixture,
        session: AsyncSession,
        organization: Organization,
    ) -> None:
        # Given organization active
        organization.status = Organization.Status.ACTIVE

        enqueue_job_mock = mocker.patch("polar.organization.service.enqueue_job")

        # When
        result = await organization_service.set_organization_under_review(
            session, organization
        )

        # Then
        assert result.status == Organization.Status.UNDER_REVIEW
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
        organization.created_at = datetime(2025, 8, 1, tzinfo=UTC)
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

        integrate_api_step = next(
            s for s in payment_status.steps if s.id == "integrate_api"
        )
        assert integrate_api_step.completed is False

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
        organization.created_at = datetime(2025, 8, 1, tzinfo=UTC)
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

        integrate_api_step = next(
            s for s in payment_status.steps if s.id == "integrate_api"
        )
        assert integrate_api_step.completed is False

    async def test_with_api_key_created(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
        mocker: MockerFixture,
    ) -> None:
        # Make this a new organization (not grandfathered)
        organization.created_at = datetime(2025, 8, 1, tzinfo=UTC)
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

        integrate_api_step = next(
            s for s in payment_status.steps if s.id == "integrate_api"
        )
        assert integrate_api_step.completed is True

    async def test_with_account_setup_complete(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
        user: User,
    ) -> None:
        # Make this a new organization (not grandfathered)
        organization.created_at = datetime(2025, 8, 1, tzinfo=UTC)

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
        organization.created_at = datetime(2025, 7, 29, tzinfo=UTC)
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
        organization.created_at = datetime(2025, 8, 1, tzinfo=UTC)
        organization.status = Organization.Status.ACTIVE
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
