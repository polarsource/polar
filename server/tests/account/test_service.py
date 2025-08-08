from polar.models import Account, Transaction
from polar.models.transaction import Processor, TransactionType
from tests.fixtures.database import SaveFixture


async def create_transaction(
    save_fixture: SaveFixture, *, account: Account | None = None, amount: int = 1000
) -> Transaction:
    transaction = Transaction(
        type=TransactionType.balance,
        processor=Processor.stripe,
        currency="usd",
        amount=amount,
        account_currency="eur",
        account_amount=int(amount * 0.9),
        tax_amount=0,
        account=account,
    )
    await save_fixture(transaction)
    return transaction
