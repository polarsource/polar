from typing import Any
from uuid import uuid4

import pytest

from polar.models import Account, Organization, User, UserOrganization
from polar.user_organization.service import (
    CannotRemoveOrganizationAdmin,
    OrganizationNotFound,
    UserNotMemberOfOrganization,
)
from polar.user_organization.service import (
    user_organization as user_organization_service,
)


@pytest.mark.asyncio
class TestRemoveMemberSafe:
    async def test_remove_member_success(
        self,
        session: Any,
        organization: Organization,
        user: User,
        user_organization: UserOrganization,
    ) -> None:
        # Test successful member removal
        await user_organization_service.remove_member_safe(
            session, user.id, organization.id
        )

        # Verify the member was soft deleted
        user_org = await user_organization_service.get_by_user_and_org(
            session, user.id, organization.id
        )
        assert user_org is None

    async def test_remove_member_organization_not_found(
        self,
        session: Any,
        user: User,
    ) -> None:
        # Test with non-existent organization
        non_existent_org_id = uuid4()

        with pytest.raises(OrganizationNotFound) as exc_info:
            await user_organization_service.remove_member_safe(
                session, user.id, non_existent_org_id
            )

        assert exc_info.value.organization_id == non_existent_org_id

    async def test_remove_member_user_not_member(
        self,
        session: Any,
        organization: Organization,
        user: User,
    ) -> None:
        # Test with user who is not a member
        with pytest.raises(UserNotMemberOfOrganization) as exc_info:
            await user_organization_service.remove_member_safe(
                session, user.id, organization.id
            )

        assert exc_info.value.user_id == user.id
        assert exc_info.value.organization_id == organization.id

    async def test_remove_member_cannot_remove_admin(
        self,
        session: Any,
        organization_account: Account,
        organization: Organization,
        user: User,
        save_fixture: Any,
    ) -> None:
        # Create user organization relationship for admin
        from polar.kit.utils import utc_now
        from polar.models import UserOrganization

        # The user fixture becomes the admin through organization_account fixture
        admin_user_org = UserOrganization(
            user_id=user.id,
            organization_id=organization.id,
            created_at=utc_now(),
        )
        await save_fixture(admin_user_org)

        # Test trying to remove organization admin
        with pytest.raises(CannotRemoveOrganizationAdmin) as exc_info:
            await user_organization_service.remove_member_safe(
                session, user.id, organization.id
            )

        assert exc_info.value.user_id == user.id
        assert exc_info.value.organization_id == organization.id

    async def test_remove_member_non_admin_with_account(
        self,
        session: Any,
        organization_account: Account,
        organization: Organization,
        user_second: User,
        save_fixture: Any,
    ) -> None:
        # Create user organization relationship for non-admin user
        from polar.kit.utils import utc_now
        from polar.models import UserOrganization

        user_org_relation = UserOrganization(
            user_id=user_second.id,
            organization_id=organization.id,
            created_at=utc_now(),
        )
        await save_fixture(user_org_relation)

        # Test removing a non-admin member from organization with account
        await user_organization_service.remove_member_safe(
            session, user_second.id, organization.id
        )

        # Verify the member was soft deleted
        user_org: (
            UserOrganization | None
        ) = await user_organization_service.get_by_user_and_org(
            session, user_second.id, organization.id
        )
        assert user_org is None

    async def test_remove_member_no_account(
        self,
        session: Any,
        organization: Organization,
        user: User,
        user_organization: UserOrganization,
    ) -> None:
        # Test removing member from organization without account (no admin check)
        await user_organization_service.remove_member_safe(
            session, user.id, organization.id
        )

        # Verify the member was soft deleted
        user_org = await user_organization_service.get_by_user_and_org(
            session, user.id, organization.id
        )
        assert user_org is None


@pytest.mark.asyncio
class TestRemoveMember:
    async def test_remove_member_soft_delete(
        self,
        session: Any,
        organization: Organization,
        user: User,
        user_organization: UserOrganization,
    ) -> None:
        # Test that remove_member performs soft delete
        await user_organization_service.remove_member(session, user.id, organization.id)

        # Verify the member was soft deleted (not returned by get_by_user_and_org)
        user_org = await user_organization_service.get_by_user_and_org(
            session, user.id, organization.id
        )
        assert user_org is None

        # But the record still exists in DB with deleted_at set
        from polar.postgres import sql

        result = await session.execute(
            sql.select(UserOrganization).where(
                UserOrganization.user_id == user.id,
                UserOrganization.organization_id == organization.id,
            )
        )
        deleted_user_org: UserOrganization | None = result.scalar_one_or_none()
        assert deleted_user_org is not None
        assert deleted_user_org.deleted_at is not None


@pytest.mark.asyncio
class TestListByOrg:
    async def test_list_by_org_excludes_deleted(
        self,
        session: Any,
        organization: Organization,
        user: User,
        user_organization: UserOrganization,
    ) -> None:
        # Initially should return the member
        members = await user_organization_service.list_by_org(session, organization.id)
        assert len(members) == 1
        assert members[0].user_id == user.id

        # After soft delete, should not return the member
        await user_organization_service.remove_member(session, user.id, organization.id)

        members = await user_organization_service.list_by_org(session, organization.id)
        assert len(members) == 0
