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
    """Can the subject read sales data (orders, subscriptions, checkouts,
    disputes, refunds, payments) for this organization?

    Enforced at the data-fetch layer for list endpoints (filtering
    `UserOrganization` by roles with `sales:read`). This policy is the
    canonical site to plug into `OrgPolicyGuard` if/when a sales-section
    endpoint exposes a single-org `{id}` path.
    """
    return await _require_permission(
        session,
        auth_subject,
        organization,
        permission=OrganizationPermission.sales_read,
        denied_msg="You don't have permission to view sales data",
    )
