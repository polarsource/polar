from collections.abc import Sequence
from typing import Self
from uuid import UUID

from sqlalchemy import select

from polar.models import Organization, UserOrganization
from polar.models.user_organization import OrganizationRole
from polar.postgres import AsyncReadSession


class UserOrganizationRepository:
    """Lightweight repository for `UserOrganization`.

    The model has a composite primary key (user_id, organization_id) so
    it doesn't fit `RepositoryBase`. Methods here cover the queries that
    don't already live on `UserOrganizationService`.
    """

    def __init__(self, session: AsyncReadSession) -> None:
        self.session = session

    @classmethod
    def from_session(cls, session: AsyncReadSession) -> Self:
        return cls(session)

    async def get_roles_by_org_ids(
        self, user_id: UUID, organization_ids: Sequence[UUID]
    ) -> dict[UUID, OrganizationRole]:
        """Return a `{organization_id: role}` map for the user's memberships
        in the given organizations. Organizations the user isn't a member of
        are absent from the result.
        """
        if not organization_ids:
            return {}
        statement = select(
            UserOrganization.organization_id, UserOrganization.role
        ).where(
            UserOrganization.user_id == user_id,
            UserOrganization.organization_id.in_(organization_ids),
            UserOrganization.is_deleted.is_(False),
        )
        result = await self.session.execute(statement)
        return {row.organization_id: row.role for row in result}

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
                UserOrganization.is_deleted.is_(False),
                Organization.deleted_at.is_(None),
            )
            .order_by(Organization.name)
        )
        result = await self.session.execute(statement)
        return [(row[0], row[1]) for row in result.all()]
