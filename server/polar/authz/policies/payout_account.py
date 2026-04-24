from polar.auth.models import AuthSubject, User
from polar.models import PayoutAccount as PayoutAccountModel


async def can_read(
    auth_subject: AuthSubject[User], payout_account: PayoutAccountModel
) -> bool:
    """Can the subject view this payout account?"""
    return payout_account.admin_id == auth_subject.subject.id


async def can_write(
    auth_subject: AuthSubject[User], payout_account: PayoutAccountModel
) -> bool:
    """Can the subject manage this payout account?"""
    return await can_read(auth_subject, payout_account)
