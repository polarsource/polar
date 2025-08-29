import pytest

from polar.account.service import (
    CannotChangeAdminError,
    UserNotOrganizationMemberError,
)
from polar.account.service import (
    account as account_service,
)
from polar.models import Account, Organization, Transaction, User, UserOrganization
from polar.models.transaction import Processor, TransactionType
from polar.models.user import IdentityVerificationStatus
from polar.postgres import AsyncSession
from tests.fixtures.database import SaveFixture

from .conftest import create_account


async def create_transaction(
    save_fixture: SaveFixture, *, account: Account | None = None, amount: int = 1000
) -> Transaction:
    transaction = Transaction(
        type=TransactionType.balance,
        processor=Processor.stripe,
        currency="usd",
        amount=amount,
        account_currency="eur",
        account_amount=int(amount * 0.9),
        tax_amount=0,
        account=account,
    )
    await save_fixture(transaction)
    return transaction


async def create_user_organization(
    save_fixture: SaveFixture, *, user: User, organization: Organization
) -> UserOrganization:
    user_organization = UserOrganization(
        user_id=user.id,
        organization_id=organization.id,
    )
    await save_fixture(user_organization)
    return user_organization


@pytest.mark.asyncio
class TestChangeAdmin:
    async def test_change_admin_success_verified_user(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
        user: User,
        user_second: User,
    ) -> None:
        # Set up verified user
        user_second.identity_verification_status = IdentityVerificationStatus.verified
        await save_fixture(user_second)

        # Create user-organization relationships
        await create_user_organization(
            save_fixture, user=user, organization=organization
        )
        await create_user_organization(
            save_fixture, user=user_second, organization=organization
        )

        # Create account with current admin (no Stripe ID)
        account = await create_account(
            save_fixture, admin=user, status=Account.Status.ACTIVE
        )
        account.stripe_id = None
        await save_fixture(account)

        # Test successful admin change
        updated_account = await account_service.change_admin(
            session, account, user_second.id, organization.id
        )

        assert updated_account.admin_id == user_second.id
        assert updated_account.id == account.id

    async def test_change_admin_fails_stripe_account_exists(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
        user: User,
        user_second: User,
    ) -> None:
        # Set up verified user
        user_second.identity_verification_status = IdentityVerificationStatus.verified
        await save_fixture(user_second)

        # Create user-organization relationships
        await create_user_organization(
            save_fixture, user=user, organization=organization
        )
        await create_user_organization(
            save_fixture, user=user_second, organization=organization
        )

        # Create account with Stripe ID
        account = await create_account(
            save_fixture, admin=user, status=Account.Status.ACTIVE
        )
        account.stripe_id = "acct_123456789"
        await save_fixture(account)

        # Test that admin change fails due to Stripe account
        with pytest.raises(
            CannotChangeAdminError, match="Stripe account must be deleted"
        ):
            await account_service.change_admin(
                session, account, user_second.id, organization.id
            )

    @pytest.mark.parametrize(
        "verification_status,expected_status_name",
        [
            (IdentityVerificationStatus.unverified, "Unverified"),
            (IdentityVerificationStatus.pending, "Pending"),
            (IdentityVerificationStatus.failed, "Failed"),
        ],
    )
    async def test_change_admin_fails_user_not_verified(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
        user: User,
        user_second: User,
        verification_status: IdentityVerificationStatus,
        expected_status_name: str,
    ) -> None:
        # Set up user with non-verified status
        user_second.identity_verification_status = verification_status
        await save_fixture(user_second)

        # Create user-organization relationships
        await create_user_organization(
            save_fixture, user=user, organization=organization
        )
        await create_user_organization(
            save_fixture, user=user_second, organization=organization
        )

        # Create account without Stripe ID
        account = await create_account(
            save_fixture, admin=user, status=Account.Status.ACTIVE
        )
        account.stripe_id = None
        await save_fixture(account)

        # Test that admin change fails due to non-verified user
        with pytest.raises(
            CannotChangeAdminError,
            match=f"New admin must be verified in Stripe.*{expected_status_name}",
        ):
            await account_service.change_admin(
                session, account, user_second.id, organization.id
            )

    async def test_change_admin_fails_user_not_organization_member(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
        user: User,
        user_second: User,
    ) -> None:
        # Set up verified user but don't add to organization
        user_second.identity_verification_status = IdentityVerificationStatus.verified
        await save_fixture(user_second)

        # Create user-organization relationship only for current admin
        await create_user_organization(
            save_fixture, user=user, organization=organization
        )

        # Create account
        account = await create_account(
            save_fixture, admin=user, status=Account.Status.ACTIVE
        )
        account.stripe_id = None
        await save_fixture(account)

        # Test that admin change fails for non-member
        with pytest.raises(UserNotOrganizationMemberError):
            await account_service.change_admin(
                session, account, user_second.id, organization.id
            )

    async def test_change_admin_fails_same_admin(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
        user: User,
    ) -> None:
        # Set up verified user
        user.identity_verification_status = IdentityVerificationStatus.verified
        await save_fixture(user)

        # Create user-organization relationship
        await create_user_organization(
            save_fixture, user=user, organization=organization
        )

        # Create account
        account = await create_account(
            save_fixture, admin=user, status=Account.Status.ACTIVE
        )
        account.stripe_id = None
        await save_fixture(account)

        # Test that admin change fails when trying to set same admin
        with pytest.raises(
            CannotChangeAdminError, match="New admin is the same as current admin"
        ):
            await account_service.change_admin(
                session, account, user.id, organization.id
            )
