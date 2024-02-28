import pytest_asyncio

from polar.enums import AccountType
from polar.models import (
    Account,
    Issue,
    IssueReward,
    Organization,
    Pledge,
    Repository,
    Subscription,
    Transaction,
    User,
)
from polar.models.pledge import PledgeType
from polar.models.transaction import PaymentProcessor, TransactionType
from polar.postgres import AsyncSession
from tests.fixtures.random_objects import (
    create_pledge,
    create_subscription,
    create_subscription_tier,
)


async def create_transaction(
    session: AsyncSession,
    *,
    account: Account | None = None,
    payment_user: User | None = None,
    payment_organization: Organization | None = None,
    type: TransactionType = TransactionType.balance,
    amount: int = 1000,
    account_currency: str = "eur",
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
        account_currency=account_currency,
        account_amount=int(amount * 0.9) if account_currency != "usd" else amount,
        tax_amount=0,
        account=account,
        payment_user=payment_user,
        payment_organization=payment_organization,
        pledge=pledge,
        issue_reward=issue_reward,
        subscription=subscription,
        payout_transaction=payout_transaction,
    )
    session.add(transaction)
    await session.commit()
    return transaction


async def create_account(
    session: AsyncSession,
    organization: Organization,
    user: User,
    *,
    processor_fees_applicable: bool = False,
) -> Account:
    account = Account(
        status=Account.Status.ACTIVE,
        account_type=AccountType.stripe,
        admin_id=user.id,
        country="US",
        currency="usd",
        is_details_submitted=True,
        is_charges_enabled=True,
        is_payouts_enabled=True,
        processor_fees_applicable=processor_fees_applicable,
    )
    session.add(account)
    organization.account = account
    session.add(organization)
    await session.commit()
    return account


@pytest_asyncio.fixture
async def account(
    session: AsyncSession, organization: Organization, user: User
) -> Account:
    return await create_account(session, organization, user)


@pytest_asyncio.fixture
async def transaction_pledge(
    session: AsyncSession,
    organization: Organization,
    repository: Repository,
    issue: Issue,
) -> Pledge:
    return await create_pledge(
        session,
        organization,
        repository,
        issue,
        organization,
        type=PledgeType.pay_on_completion,
    )


@pytest_asyncio.fixture
async def transaction_issue_reward(session: AsyncSession, issue: Issue) -> IssueReward:
    issue_reward = IssueReward(
        issue_id=issue.id,
        share_thousands=100,
    )
    session.add(issue_reward)
    await session.commit()
    return issue_reward


@pytest_asyncio.fixture
async def transaction_subscription(
    session: AsyncSession, organization: Organization, user: User
) -> Subscription:
    subscription_tier = await create_subscription_tier(
        session, organization=organization
    )
    return await create_subscription(
        session, subscription_tier=subscription_tier, user=user
    )


@pytest_asyncio.fixture
async def account_transactions(
    session: AsyncSession,
    account: Account,
    transaction_pledge: Pledge,
    transaction_issue_reward: IssueReward,
    transaction_subscription: Subscription,
) -> list[Transaction]:
    return [
        await create_transaction(
            session,
            type=TransactionType.balance,
            account_currency="usd",
            account=account,
            pledge=transaction_pledge,
            issue_reward=transaction_issue_reward,
        ),
        await create_transaction(
            session,
            type=TransactionType.balance,
            account_currency="usd",
            account=account,
            subscription=transaction_subscription,
        ),
        await create_transaction(
            session,
            type=TransactionType.balance,
            account_currency="usd",
            account=account,
        ),
        await create_transaction(
            session,
            type=TransactionType.payout,
            account_currency="eur",
            account=account,
            amount=-3000,
        ),
    ]


@pytest_asyncio.fixture
async def user_transactions(session: AsyncSession, user: User) -> list[Transaction]:
    return [
        await create_transaction(
            session, type=TransactionType.payment, payment_user=user
        ),
    ]


@pytest_asyncio.fixture
async def organization_transactions(
    session: AsyncSession, organization: Organization
) -> list[Transaction]:
    return [
        await create_transaction(
            session, type=TransactionType.payment, payment_organization=organization
        ),
    ]


@pytest_asyncio.fixture
async def readable_user_transactions(
    session: AsyncSession,
    account_transactions: list[Transaction],
    user_transactions: list[Transaction],
    organization_transactions: list[Transaction],
) -> list[Transaction]:
    return [*account_transactions, *user_transactions, *organization_transactions]


@pytest_asyncio.fixture
async def all_transactions(
    session: AsyncSession, readable_user_transactions: list[Transaction]
) -> list[Transaction]:
    return [
        *readable_user_transactions,
        await create_transaction(session),
        await create_transaction(session),
        await create_transaction(session),
    ]
