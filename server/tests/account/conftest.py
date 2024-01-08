from polar.enums import AccountType
from polar.models import Account, User
from polar.postgres import AsyncSession


async def create_account(
    session: AsyncSession, *, admin: User, status: Account.Status
) -> Account:
    account = Account(
        account_type=AccountType.stripe,
        status=status,
        admin_id=admin.id,
        country="US",
        currency="usd",
        is_details_submitted=True,
        is_charges_enabled=True,
        is_payouts_enabled=True,
    )
    session.add(account)
    await session.commit()
    session.expunge_all()
    return account
