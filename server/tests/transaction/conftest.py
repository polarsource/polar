from collections.abc import AsyncIterator, Sequence
from datetime import datetime

import pytest_asyncio

from polar.enums import SubscriptionRecurringInterval
from polar.models import (
    Account,
    Customer,
    Dispute,
    IssueReward,
    Order,
    Organization,
    Payout,
    Pledge,
    Refund,
    Transaction,
    User,
)
from polar.models.pledge import PledgeType
from polar.models.transaction import Processor, TransactionType
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
    payment_user: User | None = None,
    type: TransactionType = TransactionType.balance,
    amount: int = 1000,
    tax_amount: int = 0,
    currency: str = "usd",
    account_currency: str = "eur",
    presentment_currency: str = "usd",
    presentment_amount: int = 1000,
    presentment_tax_amount: int = 0,
    pledge: Pledge | None = None,
    issue_reward: IssueReward | None = None,
    order: Order | None = None,
    refund: Refund | None = None,
    dispute: Dispute | None = None,
    payout_transaction: Transaction | None = None,
    payment_transaction: Transaction | None = None,
    payout: Payout | None = None,
    charge_id: str | None = None,
    dispute_id: str | None = None,
    created_at: datetime | None = None,
) -> Transaction:
    transaction = Transaction(
        created_at=created_at,
        type=type,
        processor=Processor.stripe,
        currency=currency,
        amount=amount,
        account_currency=account_currency,
        account_amount=int(amount * 0.9) if account_currency != "usd" else amount,
        tax_amount=tax_amount,
        presentment_currency=presentment_currency,
        presentment_amount=presentment_amount,
        presentment_tax_amount=presentment_tax_amount,
        account=account,
        payment_customer=payment_customer,
        payment_organization=payment_organization,
        payment_user=payment_user,
        pledge=pledge,
        issue_reward=issue_reward,
        order=order,
        refund=refund,
        dispute=dispute,
        payout_transaction=payout_transaction,
        payment_transaction=payment_transaction,
        payout=payout,
        charge_id=charge_id,
        dispute_id=dispute_id,
        incurred_transactions=[],
    )
    await save_fixture(transaction)
    return transaction


@pytest_asyncio.fixture
async def transaction_pledge(
    save_fixture: SaveFixture,
    organization: Organization,
) -> Pledge:
    return await create_pledge(
        save_fixture,
        organization,
        pledging_organization=organization,
        type=PledgeType.pay_on_completion,
    )


@pytest_asyncio.fixture
async def transaction_issue_reward(
    save_fixture: SaveFixture, transaction_pledge: Pledge
) -> IssueReward:
    issue_reward = IssueReward(
        issue_reference=transaction_pledge.issue_reference,
        share_thousands=100,
    )
    await save_fixture(issue_reward)
    return issue_reward


@pytest_asyncio.fixture
async def transaction_order_subscription(
    save_fixture: SaveFixture, organization: Organization, customer: Customer
) -> Order:
    product = await create_product(
        save_fixture,
        organization=organization,
        recurring_interval=SubscriptionRecurringInterval.month,
    )
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


async def create_async_iterator[T](iterable: Sequence[T]) -> AsyncIterator[T]:
    for item in iterable:
        yield item
