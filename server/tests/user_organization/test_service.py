from typing import Any
from uuid import uuid4

import pytest
from pytest_mock import MockerFixture

from polar.models import Account, Organization, User, UserOrganization
from polar.models.user_organization import OrganizationRole
from polar.user_organization.service import (
    CannotRemoveOrganizationAdmin,
    InvalidOwnerRoleAssignment,
    OrganizationNotFound,
    OwnerRoleCannotBeRemoved,
    UserNotMemberOfOrganization,
)
from polar.user_organization.service import (
    user_organization as user_organization_service,
)
from tests.fixtures.database import SaveFixture


@pytest.mark.asyncio
class TestRemoveMemberSafe:
    async def test_remove_member_success(
        self,
        save_fixture: SaveFixture,
        session: Any,
        organization: Organization,
        user: User,
        user_second: User,
        user_organization: UserOrganization,
    ) -> None:
        user_organization = UserOrganization(
            user=user_second, organization=organization
        )
        await save_fixture(user_organization)

        # Test successful member removal
        await user_organization_service.remove_member_safe(
            session,
            user_id=user_second.id,
            organization_id=organization.id,
        )

        # Verify the member was soft deleted
        user_org = await user_organization_service.get_by_user_and_org(
            session, user_second.id, organization.id
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
                session,
                user_id=user.id,
                organization_id=non_existent_org_id,
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
                session,
                user_id=user.id,
                organization_id=organization.id,
            )

        assert exc_info.value.user_id == user.id
        assert exc_info.value.organization_id == organization.id

    async def test_remove_member_cannot_remove_admin(
        self,
        session: Any,
        account: Account,
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
                session,
                user_id=user.id,
                organization_id=organization.id,
            )

        assert exc_info.value.user_id == user.id
        assert exc_info.value.organization_id == organization.id

    async def test_remove_member_non_admin_with_account(
        self,
        session: Any,
        account: Account,
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
            session,
            user_id=user_second.id,
            organization_id=organization.id,
        )

        # Verify the member was soft deleted
        user_org: (
            UserOrganization | None
        ) = await user_organization_service.get_by_user_and_org(
            session, user_second.id, organization.id
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
        await user_organization_service.remove_member(
            session,
            user_id=user.id,
            organization_id=organization.id,
        )

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

    async def test_enqueues_polar_self_member_removal(
        self,
        mocker: MockerFixture,
        session: Any,
        organization: Organization,
        user: User,
        user_organization: UserOrganization,
    ) -> None:
        enqueue_remove_member_mock = mocker.patch(
            "polar.user_organization.service.polar_self_service.enqueue_remove_member"
        )

        await user_organization_service.remove_member(
            session,
            user_id=user.id,
            organization_id=organization.id,
        )

        enqueue_remove_member_mock.assert_called_once_with(
            external_customer_id=str(organization.id),
            external_id=str(user.id),
        )

    async def test_does_not_enqueue_when_member_not_found(
        self,
        mocker: MockerFixture,
        session: Any,
        organization: Organization,
        user: User,
    ) -> None:
        enqueue_remove_member_mock = mocker.patch(
            "polar.user_organization.service.polar_self_service.enqueue_remove_member"
        )

        await user_organization_service.remove_member(
            session,
            user_id=user.id,
            organization_id=organization.id,
        )

        enqueue_remove_member_mock.assert_not_called()


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
        await user_organization_service.remove_member(
            session,
            user_id=user.id,
            organization_id=organization.id,
        )

        members = await user_organization_service.list_by_org(session, organization.id)
        assert len(members) == 0


@pytest.mark.asyncio
class TestSetRole:
    async def test_promote_member_to_admin(
        self,
        save_fixture: SaveFixture,
        session: Any,
        account: Account,
        organization: Organization,
        user_second: User,
    ) -> None:
        relation = UserOrganization(
            user_id=user_second.id, organization_id=organization.id
        )
        await save_fixture(relation)

        result = await user_organization_service.set_role(
            session,
            user_id=user_second.id,
            organization_id=organization.id,
            role=OrganizationRole.admin,
        )

        assert result.role == OrganizationRole.admin

    async def test_owner_role_rejected_for_non_admin_user(
        self,
        save_fixture: SaveFixture,
        session: Any,
        account: Account,
        organization: Organization,
        user_second: User,
    ) -> None:
        # `account` fixture sets `account.admin_id = user`, so user_second is
        # not the Account.admin_id user — assigning `owner` to them must fail.
        relation = UserOrganization(
            user_id=user_second.id, organization_id=organization.id
        )
        await save_fixture(relation)

        with pytest.raises(InvalidOwnerRoleAssignment):
            await user_organization_service.set_role(
                session,
                user_id=user_second.id,
                organization_id=organization.id,
                role=OrganizationRole.owner,
            )

    async def test_owner_role_allowed_for_admin_user(
        self,
        save_fixture: SaveFixture,
        session: Any,
        account: Account,
        organization: Organization,
        user: User,
    ) -> None:
        # `account.admin_id == user.id` from the fixture; assigning `owner`
        # to the matching user is allowed.
        relation = UserOrganization(user_id=user.id, organization_id=organization.id)
        await save_fixture(relation)

        result = await user_organization_service.set_role(
            session,
            user_id=user.id,
            organization_id=organization.id,
            role=OrganizationRole.owner,
        )

        assert result.role == OrganizationRole.owner

    async def test_owner_cannot_be_demoted_directly(
        self,
        save_fixture: SaveFixture,
        session: Any,
        account: Account,
        organization: Organization,
        user: User,
    ) -> None:
        relation = UserOrganization(
            user_id=user.id,
            organization_id=organization.id,
            role=OrganizationRole.owner,
        )
        await save_fixture(relation)

        with pytest.raises(OwnerRoleCannotBeRemoved):
            await user_organization_service.set_role(
                session,
                user_id=user.id,
                organization_id=organization.id,
                role=OrganizationRole.admin,
            )

    async def test_user_not_member(
        self,
        session: Any,
        organization: Organization,
        user_second: User,
    ) -> None:
        with pytest.raises(UserNotMemberOfOrganization):
            await user_organization_service.set_role(
                session,
                user_id=user_second.id,
                organization_id=organization.id,
                role=OrganizationRole.member,
            )
