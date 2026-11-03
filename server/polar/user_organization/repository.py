from collections.abc import Collection, Sequence
from typing import Self
from uuid import UUID

from sqlalchemy import Exists, SQLColumnExpression, select, update

from polar.models import Organization, UserOrganization
from polar.models.organization import OrganizationStatus
from polar.models.user_organization import OrganizationRole
from polar.postgres import AsyncReadSession, AsyncSession


class UserOrganizationRepository:
    """Lightweight repository for `UserOrganization`.

    The model has a composite primary key (user_id, organization_id) so
    it doesn't fit `RepositoryBase`. Methods here cover the queries that
    don't already live on `UserOrganizationService`.
    """

    def __init__(self, session: AsyncSession | AsyncReadSession) -> None:
        self.session = session

    @classmethod
    def from_session(cls, session: AsyncSession | AsyncReadSession) -> Self:
        return cls(session)

    async def get_by_user_and_organization(
        self, user_id: UUID, organization_id: UUID
    ) -> UserOrganization | None:
        statement = select(UserOrganization).where(
            UserOrganization.user_id == user_id,
            UserOrganization.organization_id == organization_id,
            ~UserOrganization.is_deleted,
        )
        result = await self.session.execute(statement)
        return result.scalar_one_or_none()

    async def get_organizations_with_role(
        self, user_id: UUID
    ) -> Sequence[tuple[Organization, OrganizationRole]]:
        """Return the user's active organizations with their role, ordered
        by organization name.
        """
        statement = (
            select(Organization, UserOrganization.role)
            .join(
                UserOrganization,
                UserOrganization.organization_id == Organization.id,
            )
            .where(
                UserOrganization.user_id == user_id,
                ~UserOrganization.is_deleted,
                Organization.can_authenticate,
            )
            .order_by(Organization.name)
        )
        result = await self.session.execute(statement)
        return [(row[0], row[1]) for row in result.all()]

    @classmethod
    def get_has_organization_with_status_clause(
        cls,
        user_id: SQLColumnExpression[UUID] | UUID,
        statuses: Collection[OrganizationStatus],
    ) -> Exists:
        return (
            select(UserOrganization.user_id)
            .join(Organization, Organization.id == UserOrganization.organization_id)
            .where(
                UserOrganization.user_id == user_id,
                ~UserOrganization.is_deleted,
                ~Organization.is_deleted,
                Organization.status.in_(statuses),
            )
            .exists()
        )

    async def has_organization_with_status(
        self, user_id: UUID, statuses: Collection[OrganizationStatus]
    ) -> bool:
        result = await self.session.execute(
            select(self.get_has_organization_with_status_clause(user_id, statuses))
        )
        return result.scalar_one()

    async def get_member_user_ids(self, organization_id: UUID) -> Sequence[UUID]:
        result = await self.session.scalars(
            select(UserOrganization.user_id).where(
                UserOrganization.organization_id == organization_id,
                ~UserOrganization.is_deleted,
            )
        )
        return result.all()

    async def lock_members_for_update(self, organization_id: UUID) -> None:
        await self.session.execute(
            select(UserOrganization.user_id)
            .where(
                UserOrganization.organization_id == organization_id,
                ~UserOrganization.is_deleted,
            )
            .order_by(UserOrganization.user_id)
            .with_for_update()
        )

    async def demote_current_owner(self, organization_id: UUID) -> UUID | None:
        """Demote whoever currently holds `owner` on the org to `admin`.

        Returns the demoted user's id, or `None` if the org had no owner.
        """
        result = await self.session.execute(
            update(UserOrganization)
            .where(
                UserOrganization.organization_id == organization_id,
                UserOrganization.role == OrganizationRole.owner,
                ~UserOrganization.is_deleted,
            )
            .values(role=OrganizationRole.admin)
            .returning(UserOrganization.user_id)
        )
        return result.scalar_one_or_none()

    async def promote_to_owner(self, organization_id: UUID, user_id: UUID) -> None:
        """Promote `user_id` on the org to `owner`."""
        await self.session.execute(
            update(UserOrganization)
            .where(
                UserOrganization.organization_id == organization_id,
                UserOrganization.user_id == user_id,
            )
            .values(role=OrganizationRole.owner)
        )
