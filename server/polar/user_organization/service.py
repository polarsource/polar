from collections.abc import Sequence
from uuid import UUID

import structlog
from sqlalchemy import Select, func
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import joinedload

from polar.exceptions import PolarError
from polar.integrations.polar.service import polar_self as polar_self_service
from polar.kit.utils import utc_now
from polar.models import User, UserOrganization
from polar.models.user import IdentityVerificationStatus
from polar.models.user_organization import (
    OrganizationNotificationSettings,
    OrganizationRole,
)
from polar.postgres import AsyncReadSession, AsyncSession, sql

from .repository import UserOrganizationRepository

log = structlog.get_logger()


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


class CannotRemoveOrganizationOwner(UserOrganizationError):
    def __init__(self, user_id: UUID, organization_id: UUID) -> None:
        self.user_id = user_id
        self.organization_id = organization_id
        message = f"Cannot remove user {user_id} - they are the owner of organization {organization_id}."
        super().__init__(message, 403)


class OrganizationWouldHaveNoAdmins(UserOrganizationError):
    def __init__(self, organization_id: UUID) -> None:
        self.organization_id = organization_id
        message = (
            f"Operation rejected: organization {organization_id} would be left "
            f"with no users holding admin or owner role."
        )
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


class NewOwnerNotVerified(UserOrganizationError):
    def __init__(self, user_id: UUID, status: IdentityVerificationStatus) -> None:
        self.user_id = user_id
        message = (
            f"User {user_id} cannot be promoted to 'owner': "
            f"identity verification status is {status.get_display_name()}, "
            f"must be {IdentityVerificationStatus.verified.get_display_name()}."
        )
        super().__init__(message, 400)


class AlreadyOwner(UserOrganizationError):
    def __init__(self, user_id: UUID, organization_id: UUID) -> None:
        self.user_id = user_id
        self.organization_id = organization_id
        message = (
            f"User {user_id} already holds 'owner' on organization {organization_id}."
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
        session: AsyncReadSession,
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

        - `role == owner` is rejected. Ownership transfers flow through
          a dedicated path (today: backoffice `change_owner`), which
          atomically demotes the previous owner.
        - A user that currently carries `owner` cannot be moved off it
          directly; ownership transfer must promote a replacement.
        """
        user_org = await self.get_by_user_and_org(session, user_id, organization_id)
        if user_org is None:
            raise UserNotMemberOfOrganization(user_id, organization_id)

        if role == OrganizationRole.owner:
            raise InvalidOwnerRoleAssignment(user_id, organization_id)

        if user_org.role == OrganizationRole.owner:
            raise OwnerRoleCannotBeRemoved(user_id, organization_id)

        if user_org.role == role:
            return user_org

        previous_role = user_org.role
        await session.execute(
            sql.update(UserOrganization)
            .where(
                UserOrganization.user_id == user_id,
                UserOrganization.organization_id == organization_id,
            )
            .values(role=role)
        )
        user_org.role = role
        log.info(
            "organization.member.role_changed",
            organization_id=organization_id,
            user_id=user_id,
            previous_role=previous_role,
            role=role,
        )
        return user_org

    async def transfer_ownership(
        self,
        session: AsyncSession,
        *,
        new_owner_user_id: UUID,
        organization_id: UUID,
    ) -> User:
        """
        Atomically demote the current `owner` (if any) to `admin` and
        promote `new_owner_user_id` to `owner`.

        Fires the `IdentityVerificationStatus.verified` gate on the new
        owner, since payouts route through whoever holds `owner`.
        """
        new_owner_user_org = await self.get_by_user_and_org(
            session, new_owner_user_id, organization_id
        )
        if new_owner_user_org is None:
            raise UserNotMemberOfOrganization(new_owner_user_id, organization_id)

        new_owner_user = new_owner_user_org.user

        if new_owner_user_org.role == OrganizationRole.owner:
            raise AlreadyOwner(new_owner_user_id, organization_id)

        if (
            new_owner_user.identity_verification_status
            != IdentityVerificationStatus.verified
        ):
            raise NewOwnerNotVerified(
                new_owner_user_id, new_owner_user.identity_verification_status
            )

        repository = UserOrganizationRepository.from_session(session)
        previous_owner_user_id = await repository.demote_current_owner(organization_id)
        try:
            await repository.promote_to_owner(organization_id, new_owner_user_id)
            await session.flush()
        except IntegrityError as e:
            # Partial unique index `ix_user_organizations_owner_per_org`
            # rejected a concurrent transfer that beat us to setting a
            # different user as owner. Surface as `AlreadyOwner` so the
            # caller can refresh state and retry.
            raise AlreadyOwner(new_owner_user_id, organization_id) from e
        log.info(
            "organization.ownership.transferred",
            organization_id=organization_id,
            new_owner_user_id=new_owner_user_id,
            previous_owner_user_id=previous_owner_user_id,
        )
        return new_owner_user

    async def remove_member(
        self,
        session: AsyncSession,
        *,
        user_id: UUID,
        organization_id: UUID,
    ) -> None:
        await self._assert_admin_capability_after_removal(
            session, user_id=user_id, organization_id=organization_id
        )

        existing = await self.get_by_user_and_org(session, user_id, organization_id)

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
            log.info(
                "organization.member.removed",
                organization_id=organization_id,
                user_id=user_id,
                role=existing.role if existing is not None else None,
            )
            polar_self_service.enqueue_remove_member(
                external_customer_id=str(organization_id),
                external_id=str(user_id),
            )

    async def _assert_admin_capability_after_removal(
        self,
        session: AsyncSession,
        *,
        user_id: UUID,
        organization_id: UUID,
    ) -> None:
        """
        Defense-in-depth guard for the admin-capability invariant: an
        organization always has at least one user in `role ∈ {owner, admin}`.

        The owner-non-removable invariant in `remove_member_safe` already
        covers the common case (every org has an owner who counts as
        admin-capable), but raw `remove_member` callers bypass that check
        — so we re-assert here. Rejects only when the removal would
        actually reduce admin-capable count to zero; non-admin-capable
        removals from a degraded organization are still allowed (they
        don't make the state worse).
        """
        target_role = await session.scalar(
            sql.select(UserOrganization.role).where(
                UserOrganization.organization_id == organization_id,
                UserOrganization.user_id == user_id,
                UserOrganization.is_deleted.is_(False),
            )
        )
        if target_role not in {OrganizationRole.owner, OrganizationRole.admin}:
            return

        other_admin_capable = await session.scalar(
            sql.select(func.count(UserOrganization.user_id)).where(
                UserOrganization.organization_id == organization_id,
                UserOrganization.user_id != user_id,
                UserOrganization.role.in_(
                    [OrganizationRole.owner, OrganizationRole.admin]
                ),
                UserOrganization.is_deleted.is_(False),
            )
        )
        if (other_admin_capable or 0) == 0:
            raise OrganizationWouldHaveNoAdmins(organization_id)

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
            CannotRemoveOrganizationOwner: If the user holds the `owner` role
        """
        from polar.organization.repository import OrganizationRepository

        org_repo = OrganizationRepository.from_session(session)
        organization = await org_repo.get_by_id(organization_id)

        if not organization:
            raise OrganizationNotFound(organization_id)

        user_org = await self.get_by_user_and_org(session, user_id, organization_id)
        if not user_org:
            raise UserNotMemberOfOrganization(user_id, organization_id)

        if user_org.role == OrganizationRole.owner:
            raise CannotRemoveOrganizationOwner(user_id, organization_id)

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

    async def update_notification_settings(
        self,
        session: AsyncSession,
        *,
        user_id: UUID,
        organization_id: UUID,
        notification_settings: OrganizationNotificationSettings,
    ) -> UserOrganization:
        """Update the current user's notification settings for an organization."""
        user_org = await self.get_by_user_and_org(session, user_id, organization_id)
        if user_org is None:
            raise UserNotMemberOfOrganization(user_id, organization_id)

        user_org.notification_settings = notification_settings
        return user_org


user_organization = UserOrganizationService()
