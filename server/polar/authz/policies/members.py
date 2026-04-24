from polar.auth.models import AuthSubject, Organization, User
from polar.authz.types import PolicyResult
from polar.models import Organization as OrganizationModel
from polar.postgres import AsyncReadSession

from .organization import _require_account_admin


async def can_manage(
    session: AsyncReadSession,
    auth_subject: AuthSubject[User | Organization],
    organization: OrganizationModel,
) -> PolicyResult:
    """Can the subject invite/remove/change members?"""
    return await _require_account_admin(
        session,
        auth_subject,
        organization,
        "Only the account admin can manage members",
    )
