from collections.abc import AsyncIterator, Sequence
from datetime import datetime
from typing import TypeVar

import pytest_asyncio

from polar.enums import AccountType
from polar.models import (
    Account,
    Customer,
    ExternalOrganization,
    Issue,
    IssueReward,
    Order,
    Organization,
    Pledge,
    Repository,
    Transaction,
    User,
)
from polar.models.pledge import PledgeType
from polar.models.transaction import PaymentProcessor, TransactionType
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import (
    create_order,
    create_pledge,
    create_product,
    create_subscription,
)


async def create_transaction(
    save_fixture: SaveFixture,
    *,
    account: Account | None = None,
    payment_customer: Customer | None = None,
    payment_organization: Organization | None = None,
    type: TransactionType = TransactionType.balance,
    amount: int = 1000,
    account_currency: str = "eur",
    pledge: Pledge | None = None,
    issue_reward: IssueReward | None = None,
    order: Order | None = None,
    payout_transaction: Transaction | None = None,
    payment_transaction: Transaction | None = None,
    charge_id: str | None = None,
    dispute_id: str | None = None,
    created_at: datetime | None = None,
) -> Transaction:
    transaction = Transaction(
        created_at=created_at,
        type=type,
        processor=PaymentProcessor.stripe,
        currency="usd",
        amount=amount,
        account_currency=account_currency,
        account_amount=int(amount * 0.9) if account_currency != "usd" else amount,
        tax_amount=0,
        account=account,
        payment_customer=payment_customer,
        payment_organization=payment_organization,
        pledge=pledge,
        issue_reward=issue_reward,
        order=order,
        payout_transaction=payout_transaction,
        payment_transaction=payment_transaction,
        charge_id=charge_id,
        dispute_id=dispute_id,
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
    fee_basis_points: int | None = None,
    fee_fixed: int | None = None,
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
        _platform_fee_percent=fee_basis_points,
        _platform_fee_fixed=fee_fixed,
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
    external_organization_linked: ExternalOrganization,
    repository_linked: Repository,
    issue_linked: Issue,
) -> Pledge:
    return await create_pledge(
        save_fixture,
        external_organization_linked,
        repository_linked,
        issue_linked,
        pledging_organization=organization,
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
    save_fixture: SaveFixture, organization: Organization, customer: Customer
) -> Order:
    product = await create_product(save_fixture, organization=organization)
    subscription = await create_subscription(
        save_fixture, product=product, customer=customer
    )
    return await create_order(
        save_fixture, product=product, customer=customer, subscription=subscription
    )


@pytest_asyncio.fixture
async def account_transactions(
    save_fixture: SaveFixture,
    account: Account,
    transaction_pledge: Pledge,
    transaction_issue_reward: IssueReward,
    transaction_order_subscription: Order,
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
    ]


@pytest_asyncio.fixture
async def user_transactions(
    save_fixture: SaveFixture, customer: Customer
) -> list[Transaction]:
    return [
        await create_transaction(
            save_fixture, type=TransactionType.payment, customer=customer
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


T = TypeVar("T")


async def create_async_iterator(iterable: Sequence[T]) -> AsyncIterator[T]:
    for item in iterable:
        yield item
