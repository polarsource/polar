from typing import Self
from uuid import UUID

from sqlalchemy import Select, select

from polar.auth.models import AuthSubject, User, is_organization, is_user
from polar.auth.permission import OrganizationPermission, roles_with_permission
from polar.models import Organization, UserOrganization
from polar.postgres import AsyncReadSession


def select_user_org_ids_by_id(
    user_id: UUID,
    *,
    permission: OrganizationPermission | None = None,
) -> Select[tuple[UUID]]:
    """SQL `SELECT` of organization IDs a specific user is a member of.

    Joins ``Organization`` so soft-deleted orgs and orgs without ``api_access``
    are excluded. When ``permission`` is provided, results are restricted to
    organizations where the user's role grants that permission.

    Takes a raw ``user_id`` and applies **no** session down-scope. Use it for
    flows that check a particular user's membership (e.g. OAuth consent), not the
    caller's accessible resources — for the latter use ``select_user_org_ids``.
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


def select_user_org_ids(
    auth_subject: AuthSubject[User],
    *,
    permission: OrganizationPermission | None = None,
) -> Select[tuple[UUID]]:
    """SQL `SELECT` of organization IDs the subject can access.

    Intended as a subquery inside ``Resource.organization_id.in_(...)`` when
    building auth-aware statements. Takes the full ``AuthSubject`` so the
    session/token down-scope (``organization_ids``) travels with the subject and
    can't be forgotten or mismatched with a stray ``user_id``: results are the
    user's memberships (optionally narrowed by ``permission``) intersected with
    that scope. An unscoped subject (``organization_ids is None``) is not
    narrowed.
    """
    stmt = select_user_org_ids_by_id(auth_subject.subject.id, permission=permission)
    if auth_subject.organization_ids is not None:
        stmt = stmt.where(
            UserOrganization.organization_id.in_(auth_subject.organization_ids)
        )
    return stmt


class AuthzRepository:
    def __init__(self, session: AsyncReadSession) -> None:
        self.session = session

    @classmethod
    def from_session(cls, session: AsyncReadSession) -> Self:
        return cls(session)

    async def get_user_org_ids(
        self,
        auth_subject: AuthSubject[User],
        *,
        permission: OrganizationPermission | None = None,
    ) -> set[UUID]:
        """Get accessible organization IDs for the subject.

        When ``permission`` is provided, results are restricted to organizations
        where the user's role grants that permission. The subject's session
        down-scope (``organization_ids``) is applied intrinsically.
        """
        result = await self.session.scalars(
            select_user_org_ids(auth_subject, permission=permission)
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
            stmt = stmt.where(Organization.id.in_(select_user_org_ids(auth_subject)))
        elif is_organization(auth_subject):
            stmt = stmt.where(Organization.id == auth_subject.subject.id)
        else:
            return None

        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()
