from polar.auth.models import AuthSubject, User
from polar.authz.types import PolicyResult
from polar.models import PayoutAccount as PayoutAccountModel


async def can_read(
    auth_subject: AuthSubject[User], payout_account: PayoutAccountModel
) -> PolicyResult:
    """Can the subject view this payout account?"""
    if payout_account.admin_id == auth_subject.subject.id:
        return True
    return "Only the payout account admin can access this resource"


async def can_write(
    auth_subject: AuthSubject[User], payout_account: PayoutAccountModel
) -> PolicyResult:
    """Can the subject manage this payout account?"""
    return await can_read(auth_subject, payout_account)
