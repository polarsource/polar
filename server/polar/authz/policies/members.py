from polar.auth.models import AuthSubject, Organization, User, is_user
from polar.authz.dependencies import PolicyResult
from polar.models import Organization as OrganizationModel
from polar.postgres import AsyncReadSession

from . import finance


async def can_manage(
    session: AsyncReadSession,
    auth_subject: AuthSubject[User | Organization],
    organization: OrganizationModel,
) -> PolicyResult:
    """Can the subject invite/remove/change members?"""
    result = await finance.can_read(session, auth_subject, organization)
    if result is not True and is_user(auth_subject):
        return "Only organization admins can manage members"
    return result
