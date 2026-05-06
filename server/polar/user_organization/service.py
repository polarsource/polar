from collections.abc import Sequence
from uuid import UUID

from sqlalchemy import Select, func
from sqlalchemy.orm import joinedload

from polar.account.repository import AccountRepository
from polar.exceptions import PolarError
from polar.integrations.polar.service import polar_self as polar_self_service
from polar.kit.utils import utc_now
from polar.models import UserOrganization
from polar.models.user_organization import OrganizationRole
from polar.postgres import AsyncReadSession, AsyncSession, sql


class UserOrganizationError(PolarError): ...


class OrganizationNotFound(UserOrganizationError):
    def __init__(self, organization_id: UUID) -> None:
        self.organization_id = organization_id
        message = f"Organization with id {organization_id} not found."
        super().__init__(message, 404)


class UserNotMemberOfOrganization(UserOrganizationError):
    def __init__(self, user_id: UUID, organization_id: UUID) -> None:
        self.user_id = user_id
        self.organization_id = organization_id
        message = (
            f"User with id {user_id} is not a member of organization {organization_id}."
        )
        super().__init__(message, 404)


class CannotRemoveOrganizationAdmin(UserOrganizationError):
    def __init__(self, user_id: UUID, organization_id: UUID) -> None:
        self.user_id = user_id
        self.organization_id = organization_id
        message = f"Cannot remove user {user_id} - they are the admin of organization {organization_id}."
        super().__init__(message, 403)


class InvalidOwnerRoleAssignment(UserOrganizationError):
    def __init__(self, user_id: UUID, organization_id: UUID) -> None:
        self.user_id = user_id
        self.organization_id = organization_id
        message = (
            f"User {user_id} cannot be assigned the 'owner' role on "
            f"organization {organization_id}."
        )
        super().__init__(message, 400)


class OwnerRoleCannotBeRemoved(UserOrganizationError):
    def __init__(self, user_id: UUID, organization_id: UUID) -> None:
        self.user_id = user_id
        self.organization_id = organization_id
        message = (
            f"User {user_id} carries the 'owner' role on organization "
            f"{organization_id} and cannot be moved off it directly. "
            f"Ownership must be transferred first."
        )
        super().__init__(message, 400)


class UserOrganizationService:
    async def list_by_org(
        self, session: AsyncReadSession, org_id: UUID
    ) -> Sequence[UserOrganization]:
        stmt = (
            sql.select(UserOrganization)
            .where(
                UserOrganization.organization_id == org_id,
                UserOrganization.is_deleted.is_(False),
            )
            .options(
                joinedload(UserOrganization.user),
                joinedload(UserOrganization.organization),
            )
        )

        res = await session.execute(stmt)
        return res.scalars().unique().all()

    async def get_member_count(self, session: AsyncReadSession, org_id: UUID) -> int:
        """Get the count of active members in an organization."""
        stmt = sql.select(func.count(UserOrganization.user_id)).where(
            UserOrganization.organization_id == org_id,
            UserOrganization.is_deleted.is_(False),
        )
        res = await session.execute(stmt)
        count = res.scalar()
        return count if count else 0

    async def list_by_user_id(
        self, session: AsyncSession, user_id: UUID
    ) -> Sequence[UserOrganization]:
        stmt = self._get_list_by_user_id_query(user_id)
        res = await session.execute(stmt)
        return res.scalars().unique().all()

    async def get_user_organization_count(
        self, session: AsyncSession, user_id: UUID
    ) -> int:
        stmt = self._get_list_by_user_id_query(
            user_id, ordered=False
        ).with_only_columns(func.count(UserOrganization.organization_id))
        res = await session.execute(stmt)
        count = res.scalar()
        if count:
            return count
        return 0

    async def get_by_user_and_org(
        self,
        session: AsyncSession,
        user_id: UUID,
        organization_id: UUID,
    ) -> UserOrganization | None:
        stmt = (
            sql.select(UserOrganization)
            .where(
                UserOrganization.user_id == user_id,
                UserOrganization.organization_id == organization_id,
                UserOrganization.is_deleted.is_(False),
            )
            .options(
                joinedload(UserOrganization.user),
                joinedload(UserOrganization.organization),
            )
        )

        res = await session.execute(stmt)
        return res.scalars().unique().one_or_none()

    async def set_role(
        self,
        session: AsyncSession,
        *,
        user_id: UUID,
        organization_id: UUID,
        role: OrganizationRole,
    ) -> UserOrganization:
        """
        Set a user's role on an organization, with validation.

        - `role == owner` is only allowed when `user_id` matches the org's
          `Account.admin_id`.
        - A user that currently carries `owner` cannot be moved off it
          directly; ownership transfer flows through `Account.admin_id`
          mutations (today: backoffice `change_admin`).

        Internal trusted flows that swap roles atomically with an
        `Account.admin_id` change (`account_service.change_admin`) bypass
        this method by design.
        """
        user_org = await self.get_by_user_and_org(session, user_id, organization_id)
        if user_org is None:
            raise UserNotMemberOfOrganization(user_id, organization_id)

        account_repo = AccountRepository.from_session(session)
        account = await account_repo.get_by_organization(organization_id)
        if account is None:
            raise OrganizationNotFound(organization_id)

        if role == OrganizationRole.owner and user_id != account.admin_id:
            raise InvalidOwnerRoleAssignment(user_id, organization_id)

        if user_org.role == OrganizationRole.owner and role != OrganizationRole.owner:
            raise OwnerRoleCannotBeRemoved(user_id, organization_id)

        if user_org.role == role:
            return user_org

        await session.execute(
            sql.update(UserOrganization)
            .where(
                UserOrganization.user_id == user_id,
                UserOrganization.organization_id == organization_id,
            )
            .values(role=role)
        )
        user_org.role = role
        return user_org

    async def remove_member(
        self,
        session: AsyncSession,
        *,
        user_id: UUID,
        organization_id: UUID,
    ) -> None:
        stmt = (
            sql.update(UserOrganization)
            .where(
                UserOrganization.user_id == user_id,
                UserOrganization.organization_id == organization_id,
                UserOrganization.is_deleted.is_(False),
            )
            .values(deleted_at=utc_now())
            .returning(UserOrganization.user_id)
        )
        result = await session.execute(stmt)
        removed_user_id = result.scalar_one_or_none()
        if removed_user_id is not None:
            polar_self_service.enqueue_remove_member(
                external_customer_id=str(organization_id),
                external_id=str(user_id),
            )

    async def remove_member_safe(
        self,
        session: AsyncSession,
        *,
        user_id: UUID,
        organization_id: UUID,
    ) -> None:
        """
        Safely remove a member from an organization.

        Raises:
            OrganizationNotFound: If the organization doesn't exist
            UserNotMemberOfOrganization: If the user is not a member of the organization
            CannotRemoveOrganizationAdmin: If the user is the organization admin
        """
        from polar.organization.repository import OrganizationRepository

        org_repo = OrganizationRepository.from_session(session)
        organization = await org_repo.get_by_id(organization_id)

        if not organization:
            raise OrganizationNotFound(organization_id)

        # Check if user is actually a member
        user_org = await self.get_by_user_and_org(session, user_id, organization_id)
        if not user_org:
            raise UserNotMemberOfOrganization(user_id, organization_id)

        admin_user = await org_repo.get_admin_user(organization)
        if admin_user and admin_user.id == user_id:
            raise CannotRemoveOrganizationAdmin(user_id, organization_id)

        # Remove the member
        await self.remove_member(
            session,
            user_id=user_id,
            organization_id=organization_id,
        )

    def _get_list_by_user_id_query(
        self, user_id: UUID, ordered: bool = True
    ) -> Select[tuple[UserOrganization]]:
        stmt = (
            sql.select(UserOrganization)
            .where(
                UserOrganization.user_id == user_id,
                UserOrganization.is_deleted.is_(False),
            )
            .options(
                joinedload(UserOrganization.user),
                joinedload(UserOrganization.organization),
            )
        )
        if ordered:
            stmt = stmt.order_by(UserOrganization.created_at.asc())

        return stmt


user_organization = UserOrganizationService()
