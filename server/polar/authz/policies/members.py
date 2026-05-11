from polar.auth.models import AuthSubject, Organization, User
from polar.auth.permission import OrganizationPermission
from polar.authz.types import PolicyResult
from polar.models import Organization as OrganizationModel
from polar.postgres import AsyncReadSession

from . import _require_permission


async def can_manage(
    session: AsyncReadSession,
    auth_subject: AuthSubject[User | Organization],
    organization: OrganizationModel,
) -> PolicyResult:
    """Can the subject invite or remove members?"""
    return await _require_permission(
        session,
        auth_subject,
        organization,
        permission=OrganizationPermission.members_manage,
        denied_msg="Only an organization admin can manage members",
    )


async def can_set_role(
    session: AsyncReadSession,
    auth_subject: AuthSubject[User | Organization],
    organization: OrganizationModel,
) -> PolicyResult:
    """Can the subject change another member's role?"""
    return await _require_permission(
        session,
        auth_subject,
        organization,
        permission=OrganizationPermission.members_set_role,
        denied_msg="Only an organization admin can change member roles",
    )
