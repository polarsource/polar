from polar.auth.models import AuthSubject, Organization, User
from polar.auth.permission import OrganizationPermission
from polar.authz.types import PolicyResult
from polar.models import Organization as OrganizationModel
from polar.postgres import AsyncReadSession

from . import _require_permission


async def can_read(
    session: AsyncReadSession,
    auth_subject: AuthSubject[User | Organization],
    organization: OrganizationModel,
) -> PolicyResult:
    """Can the subject view analytics (metrics, events, event types) for this organization?"""
    return await _require_permission(
        session,
        auth_subject,
        organization,
        permission=OrganizationPermission.analytics_read,
        denied_msg="You don't have permission to view analytics",
    )


async def can_manage(
    session: AsyncReadSession,
    auth_subject: AuthSubject[User | Organization],
    organization: OrganizationModel,
) -> PolicyResult:
    """Can the subject create, update, or delete analytics resources
    (e.g. metric dashboards) for this organization?"""
    return await _require_permission(
        session,
        auth_subject,
        organization,
        permission=OrganizationPermission.analytics_manage,
        denied_msg="Only an organization admin can manage analytics",
    )
