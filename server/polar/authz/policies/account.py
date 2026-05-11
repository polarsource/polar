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
    """Can the subject view the org's financial account?"""
    return await _require_permission(
        session,
        auth_subject,
        organization,
        permission=OrganizationPermission.account_read,
        denied_msg="Only an organization admin can access the account",
    )


async def can_write(
    session: AsyncReadSession,
    auth_subject: AuthSubject[User | Organization],
    organization: OrganizationModel,
) -> PolicyResult:
    """Can the subject update the org's financial account?"""
    return await _require_permission(
        session,
        auth_subject,
        organization,
        permission=OrganizationPermission.account_write,
        denied_msg="Only an organization admin can update the account",
    )
