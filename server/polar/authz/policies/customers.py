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
    """Can the subject view customers in this organization?"""
    return await _require_permission(
        session,
        auth_subject,
        organization,
        permission=OrganizationPermission.customers_read,
        denied_msg="You don't have permission to view customers",
    )


async def can_manage(
    session: AsyncReadSession,
    auth_subject: AuthSubject[User | Organization],
    organization: OrganizationModel,
) -> PolicyResult:
    """Can the subject create, update, or delete customers in this organization?"""
    return await _require_permission(
        session,
        auth_subject,
        organization,
        permission=OrganizationPermission.customers_manage,
        denied_msg="You don't have permission to manage customers",
    )
