from polar.account.service import account as account_service
from polar.auth.models import AuthSubject, Organization, User, is_organization, is_user
from polar.authz.types import PolicyResult
from polar.models import Organization as OrganizationModel
from polar.postgres import AsyncReadSession


async def can_read(
    session: AsyncReadSession,
    auth_subject: AuthSubject[User | Organization],
    organization: OrganizationModel,
) -> PolicyResult:
    """Can the subject view accounts, transactions, payouts for this org?"""
    if is_organization(auth_subject):
        return True
    if is_user(auth_subject):
        if organization.account_id is None:
            return "Organization has no account"
        if await account_service.is_user_admin(
            session, organization.account_id, auth_subject.subject
        ):
            return True
        return "Only the account admin can access financial information"
    return "Not permitted"


async def can_write(
    session: AsyncReadSession,
    auth_subject: AuthSubject[User | Organization],
    organization: OrganizationModel,
) -> PolicyResult:
    """Can the subject manage payouts, update billing info for this org?"""
    return await can_read(session, auth_subject, organization)
