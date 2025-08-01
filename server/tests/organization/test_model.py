from datetime import UTC, datetime

import pytest

from polar.enums import AccountType
from polar.models import Account, Organization, User
from tests.fixtures.database import SaveFixture


@pytest.mark.asyncio
class TestIsPaymentReady:
    async def test_blocked_organization(
        self, save_fixture: SaveFixture, organization: Organization
    ) -> None:
        # Blocked organizations cannot accept payments
        organization.blocked_at = datetime.now(UTC)
        await save_fixture(organization)

        assert organization.is_payment_ready() is False

    async def test_denied_organization(
        self, save_fixture: SaveFixture, organization: Organization
    ) -> None:
        # Denied organizations cannot accept payments
        organization.status = Organization.Status.DENIED
        await save_fixture(organization)

        assert organization.is_payment_ready() is False

    async def test_grandfathered_organization(
        self, save_fixture: SaveFixture, organization: Organization
    ) -> None:
        # Organizations created before Jul 30, 2025 are grandfathered in
        organization.created_at = datetime(2025, 7, 29, tzinfo=UTC)
        await save_fixture(organization)

        assert organization.is_payment_ready() is True

    async def test_new_organization_created_status(
        self, save_fixture: SaveFixture, organization: Organization
    ) -> None:
        # New organizations with CREATED status cannot accept payments
        organization.created_at = datetime(2025, 8, 1, tzinfo=UTC)
        organization.status = Organization.Status.CREATED
        await save_fixture(organization)

        assert organization.is_payment_ready() is False

    async def test_new_organization_no_details(
        self, save_fixture: SaveFixture, organization: Organization
    ) -> None:
        # New organizations without details submitted cannot accept payments
        organization.created_at = datetime(2025, 8, 1, tzinfo=UTC)
        organization.status = Organization.Status.ACTIVE
        organization.details_submitted_at = None
        organization.details = {}  # type: ignore
        await save_fixture(organization)

        assert organization.is_payment_ready() is False

    async def test_new_organization_no_account(
        self, save_fixture: SaveFixture, organization: Organization
    ) -> None:
        # New organizations without account cannot accept payments
        organization.created_at = datetime(2025, 8, 1, tzinfo=UTC)
        organization.status = Organization.Status.ACTIVE
        organization.details_submitted_at = datetime.now(UTC)
        organization.details = {"about": "Test"}  # type: ignore
        organization.account_id = None
        await save_fixture(organization)

        assert organization.is_payment_ready() is False

    async def test_new_organization_account_not_ready(
        self, save_fixture: SaveFixture, organization: Organization, user: User
    ) -> None:
        # New organizations with account but details not submitted cannot accept payments
        organization.created_at = datetime(2025, 8, 1, tzinfo=UTC)
        organization.status = Organization.Status.ACTIVE
        organization.details_submitted_at = datetime.now(UTC)
        organization.details = {"about": "Test"}  # type: ignore

        account = Account(
            account_type=AccountType.stripe,
            admin_id=user.id,
            country="US",
            currency="USD",
            is_details_submitted=False,  # Account details not submitted
            is_charges_enabled=True,
            is_payouts_enabled=True,
            stripe_id="STRIPE_ACCOUNT_ID",
        )
        await save_fixture(account)
        organization.account = account
        organization.account_id = account.id
        await save_fixture(organization)

        assert organization.is_payment_ready() is False

    async def test_new_organization_fully_ready(
        self, save_fixture: SaveFixture, organization: Organization, user: User
    ) -> None:
        # New organizations with all requirements met can accept payments
        organization.created_at = datetime(2025, 8, 1, tzinfo=UTC)
        organization.status = Organization.Status.ACTIVE
        organization.details_submitted_at = datetime.now(UTC)
        organization.details = {"about": "Test"}  # type: ignore

        account = Account(
            account_type=AccountType.stripe,
            admin_id=user.id,
            country="US",
            currency="USD",
            is_details_submitted=True,  # Only checking details submitted now
            is_charges_enabled=False,  # These can be false
            is_payouts_enabled=False,  # These can be false
            stripe_id="STRIPE_ACCOUNT_ID",
        )
        await save_fixture(account)
        organization.account = account
        organization.account_id = account.id
        await save_fixture(organization)

        assert organization.is_payment_ready() is True

    async def test_new_organization_under_review_ready(
        self, save_fixture: SaveFixture, organization: Organization, user: User
    ) -> None:
        # Organizations under review can accept payments if other requirements are met
        organization.created_at = datetime(2025, 8, 1, tzinfo=UTC)
        organization.status = Organization.Status.UNDER_REVIEW
        organization.details_submitted_at = datetime.now(UTC)
        organization.details = {"about": "Test"}  # type: ignore

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

        assert organization.is_payment_ready() is True
