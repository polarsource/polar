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
    `change_admin` swaps `UserOrganization.role`: the previous `owner` is
    demoted to `admin`, and the new admin is promoted to `owner`. The flow
    no longer touches `Account.admin_id`; ownership is driven entirely
    by `UserOrganization.role`.
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
        previous_owner_uo = UserOrganization(
            user_id=user.id,
            organization_id=organization.id,
            role=OrganizationRole.owner,
        )
        new_admin_uo = UserOrganization(
            user_id=user_second.id,
            organization_id=organization.id,
            role=OrganizationRole.member,
        )
        await save_fixture(previous_owner_uo)
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
        assert previous.role == OrganizationRole.admin
        assert new.role == OrganizationRole.owner

    async def test_no_previous_owner_promotes_new_admin(
        self,
        save_fixture: SaveFixture,
        session: Any,
        account: Account,
        organization: Organization,
        user: User,
        user_second: User,
    ) -> None:
        # Edge case: org has no current `owner` (shouldn't happen in
        # production post-backfill, but the swap should still promote
        # the new admin rather than blow up).
        previous_member_uo = UserOrganization(
            user_id=user.id,
            organization_id=organization.id,
            role=OrganizationRole.member,
        )
        new_admin_uo = UserOrganization(
            user_id=user_second.id,
            organization_id=organization.id,
            role=OrganizationRole.member,
        )
        await save_fixture(previous_member_uo)
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
