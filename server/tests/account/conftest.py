from polar.enums import AccountType
from polar.models import Account, User
from tests.fixtures.database import SaveFixture


async def create_account(
    save_fixture: SaveFixture, *, admin: User, status: Account.Status
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
    await save_fixture(account)
    return account
