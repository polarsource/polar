from polar.auth.models import AuthSubject, User
from polar.authz.types import PolicyResult
from polar.models import PayoutAccount as PayoutAccountModel


async def can_access(
    auth_subject: AuthSubject[User], payout_account: PayoutAccountModel
) -> PolicyResult:
    """Can the subject view or manage this payout account?

    A payout account is owned by a single user (``admin_id``) and there's no
    role-permission layer above ownership — read and write authorization are
    the same check.
    """
    if payout_account.admin_id == auth_subject.subject.id:
        return True
    return "Only the payout account admin can access this resource"
