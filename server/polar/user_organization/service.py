from collections.abc import Sequence
from uuid import UUID

from sqlalchemy import Select, func
from sqlalchemy.orm import joinedload

from polar.exceptions import PolarError
from polar.kit.utils import utc_now
from polar.models import UserOrganization
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


class UserOrganizationService:
    async def list_by_org(
        self, session: AsyncReadSession, org_id: UUID
    ) -> Sequence[UserOrganization]:
        stmt = (
            sql.select(UserOrganization)
            .where(
                UserOrganization.organization_id == org_id,
                UserOrganization.deleted_at.is_(None),
            )
            .options(
                joinedload(UserOrganization.user),
                joinedload(UserOrganization.organization),
            )
        )

        res = await session.execute(stmt)
        return res.scalars().unique().all()

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
                UserOrganization.deleted_at.is_(None),
            )
            .options(
                joinedload(UserOrganization.user),
                joinedload(UserOrganization.organization),
            )
        )

        res = await session.execute(stmt)
        return res.scalars().unique().one_or_none()

    async def remove_member(
        self,
        session: AsyncSession,
        user_id: UUID,
        organization_id: UUID,
    ) -> None:
        stmt = (
            sql.update(UserOrganization)
            .where(
                UserOrganization.user_id == user_id,
                UserOrganization.organization_id == organization_id,
                UserOrganization.deleted_at.is_(None),
            )
            .values(deleted_at=utc_now())
        )
        await session.execute(stmt)

    async def remove_member_safe(
        self,
        session: AsyncSession,
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

        # Check if the user is the organization admin
        if organization.account_id:
            admin_user = await org_repo.get_admin_user(session, organization)
            if admin_user and admin_user.id == user_id:
                raise CannotRemoveOrganizationAdmin(user_id, organization_id)

        # Remove the member
        await self.remove_member(session, user_id, organization_id)

    def _get_list_by_user_id_query(
        self, user_id: UUID, ordered: bool = True
    ) -> Select[tuple[UserOrganization]]:
        stmt = (
            sql.select(UserOrganization)
            .where(
                UserOrganization.user_id == user_id,
                UserOrganization.deleted_at.is_(None),
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
