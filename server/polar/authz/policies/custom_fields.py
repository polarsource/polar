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
    """Can the subject view custom fields in this organization?"""
    return await _require_permission(
        session,
        auth_subject,
        organization,
        permission=OrganizationPermission.custom_fields_read,
        denied_msg="You don't have permission to view custom fields",
    )


async def can_manage(
    session: AsyncReadSession,
    auth_subject: AuthSubject[User | Organization],
    organization: OrganizationModel,
) -> PolicyResult:
    """Can the subject create, update, or delete custom fields in this organization?"""
    return await _require_permission(
        session,
        auth_subject,
        organization,
        permission=OrganizationPermission.custom_fields_manage,
        denied_msg="You don't have permission to manage custom fields",
    )
