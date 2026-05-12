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
    """Can the subject view the org's financial data (account, transactions, payouts)?"""
    return await _require_permission(
        session,
        auth_subject,
        organization,
        permission=OrganizationPermission.finance_read,
        denied_msg="You don't have permission to access financial data",
    )


async def can_manage(
    session: AsyncReadSession,
    auth_subject: AuthSubject[User | Organization],
    organization: OrganizationModel,
) -> PolicyResult:
    """Can the subject update the org's financial data (account, payouts)?"""
    return await _require_permission(
        session,
        auth_subject,
        organization,
        permission=OrganizationPermission.finance_manage,
        denied_msg="You don't have permission to manage financial data",
    )
