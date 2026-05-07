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
    """Can the subject invite/remove/change members?

    `members:invite` is used as a representative permission — admin and
    owner share the full member-management set, so checking any one of
    `members:invite`, `members:remove`, `members:set_role` gives the
    same answer in this iteration.
    """
    return await _require_permission(
        session,
        auth_subject,
        organization,
        permission=OrganizationPermission.members_invite,
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
