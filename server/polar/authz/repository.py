from uuid import UUID

from sqlalchemy import select

from polar.auth.models import AuthSubject, User, is_organization, is_user
from polar.models import Organization, UserOrganization
from polar.models.organization import OrganizationStatus
from polar.postgres import AsyncReadSession


class AuthzRepository:
    def __init__(self, session: AsyncReadSession) -> None:
        self.session = session

    async def get_user_org_ids(self, user_id: UUID) -> set[UUID]:
        """Get all organization IDs a user is a member of."""
        stmt = (
            select(UserOrganization.organization_id)
            .join(Organization, UserOrganization.organization_id == Organization.id)
            .where(
                UserOrganization.user_id == user_id,
                UserOrganization.is_deleted.is_(False),
                Organization.is_deleted.is_(False),
            )
        )
        result = await self.session.scalars(stmt)
        return set(result.all())

    async def get_accessible_organization(
        self,
        auth_subject: AuthSubject[User | Organization],
        organization_id: UUID,
    ) -> Organization | None:
        """Fetch an organization by ID, returning it only if the subject can access it.

        Returns ``None`` if the organization does not exist, is blocked/deleted,
        or the subject is not a member.
        """
        stmt = select(Organization).where(
            Organization.id == organization_id,
            Organization.is_deleted.is_(False),
            Organization.status != OrganizationStatus.BLOCKED,
        )

        if is_user(auth_subject):
            stmt = stmt.where(
                Organization.id.in_(
                    select(UserOrganization.organization_id).where(
                        UserOrganization.user_id == auth_subject.subject.id,
                        UserOrganization.is_deleted.is_(False),
                    )
                )
            )
        elif is_organization(auth_subject):
            stmt = stmt.where(Organization.id == auth_subject.subject.id)
        else:
            return None

        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()
