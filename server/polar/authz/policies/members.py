from polar.account.service import account as account_service
from polar.auth.models import (
    AuthSubject,
    Organization,
    User,
    is_organization,
    is_user,
)
from polar.authz.types import PolicyResult
from polar.models import Organization as OrganizationModel
from polar.postgres import AsyncReadSession


async def can_manage(
    session: AsyncReadSession,
    auth_subject: AuthSubject[User | Organization],
    organization: OrganizationModel,
) -> PolicyResult:
    """Can the subject invite/remove/change members?

    - Organization tokens: always allowed (the org is the subject)
    - Users: if the org has an account, only the account admin can manage.
      If no account, any member can manage.
    """
    if is_organization(auth_subject):
        return True
    if is_user(auth_subject):
        if organization.account_id is None:
            return True
        if await account_service.is_user_admin(
            session, organization.account_id, auth_subject.subject
        ):
            return True
        return "Only organization admins can manage members"
    return "Not permitted"
