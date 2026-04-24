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


async def _require_account_admin(
    session: AsyncReadSession,
    auth_subject: AuthSubject[User | Organization],
    organization: OrganizationModel,
    denied_msg: str,
) -> PolicyResult:
    """Check that the subject is the account admin of the organization.

    Organizations always have a billing account. Only the account admin
    (the user whose ``admin_id`` matches the account) is allowed.
    Organization-token subjects are always permitted.
    """
    if is_organization(auth_subject):
        return True
    if is_user(auth_subject):
        if await account_service.is_user_admin(
            session, organization.account_id, auth_subject.subject
        ):
            return True
        return denied_msg
    return "Not permitted"


async def can_delete(
    session: AsyncReadSession,
    auth_subject: AuthSubject[User | Organization],
    organization: OrganizationModel,
) -> PolicyResult:
    """Can the subject delete this organization?"""
    return await _require_account_admin(
        session,
        auth_subject,
        organization,
        "Only the account admin can delete the organization",
    )


async def can_manage_payout_account(
    session: AsyncReadSession,
    auth_subject: AuthSubject[User | Organization],
    organization: OrganizationModel,
) -> PolicyResult:
    """Can the subject set or change the payout account for this organization?"""
    return await _require_account_admin(
        session,
        auth_subject,
        organization,
        "Only the account admin can manage the payout account",
    )
