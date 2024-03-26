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
from polar.subscription.schemas import SubscriptionTierPrice
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import (
    create_pledge,
    create_subscription,
    create_subscription_tier,
)


async def create_transaction(
    save_fixture: SaveFixture,
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
    subscription_tier_price: SubscriptionTierPrice | None = None,
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
        subscription_tier_price=subscription_tier_price
        if subscription_tier_price is not None
        else subscription.price
        if subscription is not None
        else None,
        donation=None,
        payout_transaction=payout_transaction,
    )
    await save_fixture(transaction)
    return transaction


async def create_account(
    save_fixture: SaveFixture,
    organization: Organization,
    user: User,
    *,
    country: str = "US",
    currency: str = "usd",
    account_type: AccountType = AccountType.stripe,
    processor_fees_applicable: bool = False,
) -> Account:
    account = Account(
        status=Account.Status.ACTIVE,
        account_type=account_type,
        admin_id=user.id,
        country=country,
        currency=currency,
        is_details_submitted=True,
        is_charges_enabled=True,
        is_payouts_enabled=True,
        processor_fees_applicable=processor_fees_applicable,
    )
    await save_fixture(account)
    organization.account = account
    await save_fixture(organization)
    return account


@pytest_asyncio.fixture
async def account(
    save_fixture: SaveFixture, organization: Organization, user: User
) -> Account:
    return await create_account(save_fixture, organization, user)


@pytest_asyncio.fixture
async def transaction_pledge(
    save_fixture: SaveFixture,
    organization: Organization,
    repository: Repository,
    issue: Issue,
) -> Pledge:
    return await create_pledge(
        save_fixture,
        organization,
        repository,
        issue,
        organization,
        type=PledgeType.pay_on_completion,
    )


@pytest_asyncio.fixture
async def transaction_issue_reward(
    save_fixture: SaveFixture, issue: Issue
) -> IssueReward:
    issue_reward = IssueReward(
        issue_id=issue.id,
        share_thousands=100,
    )
    await save_fixture(issue_reward)
    return issue_reward


@pytest_asyncio.fixture
async def transaction_subscription(
    save_fixture: SaveFixture, organization: Organization, user: User
) -> Subscription:
    subscription_tier = await create_subscription_tier(
        save_fixture, organization=organization
    )
    return await create_subscription(
        save_fixture, subscription_tier=subscription_tier, user=user
    )


@pytest_asyncio.fixture
async def account_transactions(
    save_fixture: SaveFixture,
    account: Account,
    transaction_pledge: Pledge,
    transaction_issue_reward: IssueReward,
    transaction_subscription: Subscription,
) -> list[Transaction]:
    return [
        await create_transaction(
            save_fixture,
            type=TransactionType.balance,
            account_currency="usd",
            account=account,
            pledge=transaction_pledge,
            issue_reward=transaction_issue_reward,
        ),
        await create_transaction(
            save_fixture,
            type=TransactionType.balance,
            account_currency="usd",
            account=account,
            subscription=transaction_subscription,
        ),
        await create_transaction(
            save_fixture,
            type=TransactionType.balance,
            account_currency="usd",
            account=account,
        ),
        await create_transaction(
            save_fixture,
            type=TransactionType.payout,
            account_currency="eur",
            account=account,
            amount=-3000,
        ),
    ]


@pytest_asyncio.fixture
async def user_transactions(save_fixture: SaveFixture, user: User) -> list[Transaction]:
    return [
        await create_transaction(
            save_fixture, type=TransactionType.payment, payment_user=user
        ),
    ]


@pytest_asyncio.fixture
async def organization_transactions(
    save_fixture: SaveFixture, organization: Organization
) -> list[Transaction]:
    return [
        await create_transaction(
            save_fixture,
            type=TransactionType.payment,
            payment_organization=organization,
        ),
    ]


@pytest_asyncio.fixture
async def readable_user_transactions(
    account_transactions: list[Transaction],
    user_transactions: list[Transaction],
    organization_transactions: list[Transaction],
) -> list[Transaction]:
    return [*account_transactions, *user_transactions, *organization_transactions]


@pytest_asyncio.fixture
async def all_transactions(
    save_fixture: SaveFixture, readable_user_transactions: list[Transaction]
) -> list[Transaction]:
    return [
        *readable_user_transactions,
        await create_transaction(save_fixture),
        await create_transaction(save_fixture),
        await create_transaction(save_fixture),
    ]
