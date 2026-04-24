from polar.auth.models import AuthSubject, User
from polar.models import PayoutAccount as PayoutAccountModel


async def can_read(
    auth_subject: AuthSubject[User], payout_account: PayoutAccountModel
) -> bool:
    return payout_account.admin_id == auth_subject.subject.id


async def can_write(
    auth_subject: AuthSubject[User], payout_account: PayoutAccountModel
) -> bool:
    return payout_account.admin_id == auth_subject.subject.id
