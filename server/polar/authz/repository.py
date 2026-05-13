from typing import Self
from uuid import UUID

from sqlalchemy import Select, select

from polar.auth.models import AuthSubject, User, is_organization, is_user
from polar.auth.permission import OrganizationPermission, roles_with_permission
from polar.models import Organization, UserOrganization
from polar.postgres import AsyncReadSession


def select_user_org_ids(
    user_id: UUID,
    *,
    permission: OrganizationPermission | None = None,
) -> Select[tuple[UUID]]:
    """SQL `SELECT` of organization IDs the user is a member of.

    Joins ``Organization`` so soft-deleted orgs and orgs without
    ``api_access`` are excluded — matching the parity expected of the
    sibling ``AuthzRepository.get_user_org_ids`` helper.

    Intended for use as a subquery inside `Resource.organization_id.in_(...)`
    when building auth-aware repository statements. When ``permission`` is
    provided, results are restricted to organizations where the user's role
    grants that permission.
    """
    stmt = (
        select(UserOrganization.organization_id)
        .join(Organization, UserOrganization.organization_id == Organization.id)
        .where(
            UserOrganization.user_id == user_id,
            UserOrganization.is_deleted.is_(False),
            Organization.can_authenticate,
        )
    )
    if permission is not None:
        stmt = stmt.where(UserOrganization.role.in_(roles_with_permission(permission)))
    return stmt


class AuthzRepository:
    def __init__(self, session: AsyncReadSession) -> None:
        self.session = session

    @classmethod
    def from_session(cls, session: AsyncReadSession) -> Self:
        return cls(session)

    async def get_user_org_ids(
        self,
        user_id: UUID,
        *,
        permission: OrganizationPermission | None = None,
    ) -> set[UUID]:
        """Get accessible organization IDs a user is a member of.

        When ``permission`` is provided, results are further restricted to
        organizations where the user's role grants that permission.
        """
        result = await self.session.scalars(
            select_user_org_ids(user_id, permission=permission)
        )
        return set(result.all())

    async def get_accessible_organization(
        self,
        auth_subject: AuthSubject[User | Organization],
        organization_id: UUID,
    ) -> Organization | None:
        """Fetch an organization by ID, returning it only if the subject can access it.

        Returns ``None`` if the organization does not exist, is blocked/deleted,
        lacks the ``api_access`` capability, or the subject is not a member.
        """
        stmt = select(Organization).where(
            Organization.id == organization_id,
            Organization.can_authenticate,
        )

        if is_user(auth_subject):
            stmt = stmt.where(
                Organization.id.in_(select_user_org_ids(auth_subject.subject.id))
            )
        elif is_organization(auth_subject):
            stmt = stmt.where(Organization.id == auth_subject.subject.id)
        else:
            return None

        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()
