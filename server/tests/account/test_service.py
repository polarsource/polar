from typing import Any

import pytest

from polar.account.service import account as account_service
from polar.models import Account, Organization, User, UserOrganization
from polar.models.user import IdentityVerificationStatus
from polar.models.user_organization import OrganizationRole
from polar.user_organization.service import (
    user_organization as user_organization_service,
)
from tests.fixtures.database import SaveFixture


@pytest.mark.asyncio
class TestChangeAdminRoleSwap:
    """
    The `change_admin` flow keeps `UserOrganization.role` aligned with
    `Account.admin_id`: previous admin's `owner` is demoted to `admin`,
    new admin is promoted to `owner`. Pre-backfill rows where the previous
    admin still carries `member` are left alone (the demote is conditional
    on `role == owner`).
    """

    async def test_swaps_owner_role_on_admin_change(
        self,
        save_fixture: SaveFixture,
        session: Any,
        account: Account,
        organization: Organization,
        user: User,
        user_second: User,
    ) -> None:
        # Previous admin row at `owner` (post-backfill state).
        previous_admin_uo = UserOrganization(
            user_id=user.id,
            organization_id=organization.id,
            role=OrganizationRole.owner,
        )
        # New admin starts as a member.
        new_admin_uo = UserOrganization(
            user_id=user_second.id,
            organization_id=organization.id,
            role=OrganizationRole.member,
        )
        await save_fixture(previous_admin_uo)
        await save_fixture(new_admin_uo)

        # `change_admin` requires the new admin to be Stripe-identity-verified.
        user_second.identity_verification_status = IdentityVerificationStatus.verified
        await save_fixture(user_second)

        await account_service.change_admin(
            session,
            account=account,
            new_admin_id=user_second.id,
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

    async def test_pre_backfill_previous_admin_left_alone(
        self,
        save_fixture: SaveFixture,
        session: Any,
        account: Account,
        organization: Organization,
        user: User,
        user_second: User,
    ) -> None:
        # Pre-backfill: previous Account.admin still carries the default
        # `member`. The conditional demote should leave them as `member`,
        # not push them to `admin`.
        previous_admin_uo = UserOrganization(
            user_id=user.id,
            organization_id=organization.id,
            role=OrganizationRole.member,
        )
        new_admin_uo = UserOrganization(
            user_id=user_second.id,
            organization_id=organization.id,
            role=OrganizationRole.member,
        )
        await save_fixture(previous_admin_uo)
        await save_fixture(new_admin_uo)

        user_second.identity_verification_status = IdentityVerificationStatus.verified
        await save_fixture(user_second)

        await account_service.change_admin(
            session,
            account=account,
            new_admin_id=user_second.id,
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
