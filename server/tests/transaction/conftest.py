import pytest_asyncio

from polar.enums import AccountType
from polar.models import (
    Account,
    IssueReward,
    Organization,
    Pledge,
    Subscription,
    Transaction,
    User,
)
from polar.models.transaction import PaymentProcessor, TransactionType
from polar.postgres import AsyncSession


async def create_transaction(
    session: AsyncSession,
    *,
    account: Account | None = None,
    type: TransactionType = TransactionType.transfer,
    amount: int = 1000,
    pledge: Pledge | None = None,
    issue_reward: IssueReward | None = None,
    subscription: Subscription | None = None,
    payout_transaction: Transaction | None = None,
) -> Transaction:
    transaction = Transaction(
        type=type,
        processor=PaymentProcessor.stripe,
        currency="usd",
        amount=amount,
        account_currency="eur",
        account_amount=int(amount * 0.9),
        tax_amount=0,
        processor_fee_amount=0,
        account=account,
        pledge=pledge,
        issue_reward=issue_reward,
        subscription=subscription,
        payout_transaction=payout_transaction,
    )
    session.add(transaction)
    await session.commit()
    return transaction


@pytest_asyncio.fixture
async def account(
    session: AsyncSession, organization: Organization, user: User
) -> Account:
    account = Account(
        status=Account.Status.ACTIVE,
        account_type=AccountType.stripe,
        organization_id=organization.id,
        admin_id=user.id,
        country="US",
        currency="usd",
        is_details_submitted=True,
        is_charges_enabled=True,
        is_payouts_enabled=True,
    )
    session.add(account)
    await session.commit()
    return account


@pytest_asyncio.fixture
async def account_transactions(
    session: AsyncSession, account: Account
) -> list[Transaction]:
    return [
        await create_transaction(session, account=account),
        await create_transaction(session, account=account),
        await create_transaction(session, account=account),
        await create_transaction(
            session, account=account, type=TransactionType.payout, amount=-3000
        ),
    ]
