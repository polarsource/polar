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
    """Can the subject view accounts, transactions, payouts for this org?"""
    return await _require_permission(
        session,
        auth_subject,
        organization,
        permission=OrganizationPermission.transactions_read,
        denied_msg="Only an organization admin can access financial information",
    )


async def can_write(
    session: AsyncReadSession,
    auth_subject: AuthSubject[User | Organization],
    organization: OrganizationModel,
) -> PolicyResult:
    """Can the subject manage payouts, update billing info for this org?"""
    return await _require_permission(
        session,
        auth_subject,
        organization,
        permission=OrganizationPermission.transactions_write,
        denied_msg="Only an organization admin can manage financial information",
    )
