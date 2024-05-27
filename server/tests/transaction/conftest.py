import pytest_asyncio

from polar.enums import AccountType
from polar.models import (
    Account,
    Issue,
    IssueReward,
    Order,
    Organization,
    Pledge,
    Repository,
    Transaction,
    User,
)
from polar.models.donation import Donation
from polar.models.pledge import PledgeType
from polar.models.transaction import PaymentProcessor, TransactionType
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import (
    create_donation,
    create_order,
    create_pledge,
    create_product,
    create_subscription,
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
    order: Order | None = None,
    payout_transaction: Transaction | None = None,
    donation: Donation | None = None,
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
        order=order,
        donation=donation,
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
async def transaction_order_subscription(
    save_fixture: SaveFixture, organization: Organization, user: User
) -> Order:
    product = await create_product(save_fixture, organization=organization)
    subscription = await create_subscription(save_fixture, product=product, user=user)
    return await create_order(
        save_fixture, product=product, user=user, subscription=subscription
    )


@pytest_asyncio.fixture
async def transaction_donation_by_user(
    save_fixture: SaveFixture, organization: Organization, user: User
) -> Donation:
    return await create_donation(
        save_fixture,
        organization,
        by_user=user,
    )


@pytest_asyncio.fixture
async def transaction_donation_by_organization(
    save_fixture: SaveFixture, organization: Organization
) -> Donation:
    return await create_donation(
        save_fixture,
        organization,
        by_organization=organization,
    )


@pytest_asyncio.fixture
async def transaction_donation_on_behalf_of_organization(
    save_fixture: SaveFixture, organization: Organization
) -> Donation:
    return await create_donation(
        save_fixture,
        organization,
        on_behalf_of_organization=organization,
    )


@pytest_asyncio.fixture
async def account_transactions(
    save_fixture: SaveFixture,
    account: Account,
    transaction_pledge: Pledge,
    transaction_issue_reward: IssueReward,
    transaction_order_subscription: Order,
    transaction_donation_by_user: Donation,
    transaction_donation_by_organization: Donation,
    transaction_donation_on_behalf_of_organization: Donation,
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
            order=transaction_order_subscription,
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
        await create_transaction(
            save_fixture,
            type=TransactionType.balance,
            account_currency="usd",
            account=account,
            donation=transaction_donation_by_user,
        ),
        await create_transaction(
            save_fixture,
            type=TransactionType.balance,
            account_currency="usd",
            account=account,
            donation=transaction_donation_by_organization,
        ),
        await create_transaction(
            save_fixture,
            type=TransactionType.balance,
            account_currency="usd",
            account=account,
            donation=transaction_donation_on_behalf_of_organization,
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
