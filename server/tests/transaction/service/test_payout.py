import uuid
from unittest.mock import MagicMock

import pytest
import pytest_asyncio
import stripe as stripe_lib
from pytest_mock import MockerFixture
from sqlalchemy import select

from polar.enums import AccountType
from polar.integrations.stripe.service import StripeService
from polar.models import Account, Transaction, User
from polar.models.transaction import PaymentProcessor, TransactionType
from polar.postgres import AsyncSession
from polar.transaction.service.payout import (
    StripePayoutNotPaid,
    UnknownAccount,
    UnknownTransaction,
)
from polar.transaction.service.payout import (
    payout_transaction as payout_transaction_service,
)


def build_stripe_balance_transaction(
    *, fee: int | None = 100, source_transfer: str | None = None
) -> stripe_lib.BalanceTransaction:
    return stripe_lib.BalanceTransaction.construct_from(
        {
            "id": "STRIPE_BALANCE_TRANSACTION_ID",
            "fee": fee,
            "source": {"source_transfer": source_transfer}
            if source_transfer is not None
            else None,
        },
        None,
    )


def build_stripe_payout(
    *,
    status: str = "paid",
    currency: str = "usd",
    amount: int = 1000,
    balance_transaction: str | None = None,
) -> stripe_lib.Payout:
    return stripe_lib.Payout.construct_from(
        {
            "id": "STRIPE_PAYOUT_ID",
            "status": status,
            "currency": currency,
            "amount": amount,
            "balance_transaction": balance_transaction,
        },
        None,
    )


@pytest.fixture(autouse=True)
def stripe_service_mock(mocker: MockerFixture) -> MagicMock:
    mock = MagicMock(spec=StripeService)
    mocker.patch("polar.transaction.service.payout.stripe_service", new=mock)
    return mock


async def create_account(
    session: AsyncSession, user: User, *, currency: str = "usd"
) -> Account:
    account = Account(
        account_type=AccountType.stripe,
        admin_id=user.id,
        country="US",
        currency=currency,
        is_details_submitted=True,
        is_charges_enabled=True,
        is_payouts_enabled=True,
        stripe_id="STRIPE_ACCOUNT_ID",
    )
    session.add(account)
    await session.commit()
    return account


@pytest_asyncio.fixture
async def account_usd(session: AsyncSession, user: User) -> Account:
    return await create_account(session, user)


@pytest_asyncio.fixture
async def account_eur(session: AsyncSession, user: User) -> Account:
    return await create_account(session, user, currency="eur")


@pytest.mark.asyncio
class TestCreatePayoutFromStripe:
    async def test_not_paid_payout(self, session: AsyncSession) -> None:
        stripe_payout = build_stripe_payout(status="pending")

        # then
        session.expunge_all()

        with pytest.raises(StripePayoutNotPaid):
            await payout_transaction_service.create_payout_from_stripe(
                session, payout=stripe_payout, stripe_account_id="STRIPE_ACCOUNT_ID"
            )

    async def test_unknown_account(self, session: AsyncSession) -> None:
        stripe_payout = build_stripe_payout()

        # then
        session.expunge_all()

        with pytest.raises(UnknownAccount):
            await payout_transaction_service.create_payout_from_stripe(
                session, payout=stripe_payout, stripe_account_id="STRIPE_ACCOUNT_ID"
            )

    async def test_valid(
        self,
        session: AsyncSession,
        account_usd: Account,
        stripe_service_mock: MagicMock,
    ) -> None:
        transaction_params = {
            "type": TransactionType.balance,
            "processor": PaymentProcessor.stripe,
            "currency": "usd",
            "amount": 1000,
            "account_currency": "usd",
            "account_amount": 1000,
            "tax_amount": 0,
            "account": account_usd,
        }
        transactions: list[Transaction] = []
        balance_transactions: list[stripe_lib.BalanceTransaction] = []
        for i in range(0, 3):
            transfer_id = f"STRIPE_TRANSFER_{i}"
            transaction = Transaction(**transaction_params, transfer_id=transfer_id)
            balance_transaction = build_stripe_balance_transaction(
                source_transfer=transfer_id
            )

            session.add(transaction)
            transactions.append(transaction)
            balance_transactions.append(balance_transaction)
        await session.commit()

        stripe_service_mock.list_balance_transactions.return_value = (
            balance_transactions
        )

        stripe_payout = build_stripe_payout(
            amount=sum(transaction.amount for transaction in transactions)
        )

        # then
        session.expunge_all()

        transaction = await payout_transaction_service.create_payout_from_stripe(
            session, payout=stripe_payout, stripe_account_id="STRIPE_ACCOUNT_ID"
        )

        assert transaction.type == TransactionType.payout
        assert transaction.processor == PaymentProcessor.stripe
        assert transaction.currency == stripe_payout.currency
        assert transaction.amount == -stripe_payout.amount
        assert transaction.tax_amount == 0
        assert transaction.payout_id == stripe_payout.id
        assert transaction.account_id == account_usd.id

        paid_transactions_statement = select(Transaction).where(
            Transaction.payout_transaction_id == transaction.id
        )
        result = await session.execute(paid_transactions_statement)
        paid_transactions = result.scalars().all()
        assert len(paid_transactions) == len(transactions)

    async def test_valid_different_currencies(
        self,
        session: AsyncSession,
        account_eur: Account,
        stripe_service_mock: MagicMock,
    ) -> None:
        transaction_params = {
            "type": TransactionType.balance,
            "processor": PaymentProcessor.stripe,
            "currency": "usd",
            "amount": 1000,
            "account_currency": "eur",
            "account_amount": 900,
            "tax_amount": 0,
            "account": account_eur,
        }
        transactions: list[Transaction] = []
        balance_transactions: list[stripe_lib.BalanceTransaction] = []
        for i in range(0, 3):
            transfer_id = f"STRIPE_TRANSFER_{i}"
            transaction = Transaction(**transaction_params, transfer_id=transfer_id)
            balance_transaction = build_stripe_balance_transaction(
                source_transfer=transfer_id
            )

            session.add(transaction)
            transactions.append(transaction)
            balance_transactions.append(balance_transaction)
        await session.commit()

        stripe_service_mock.list_balance_transactions.return_value = (
            balance_transactions
        )

        stripe_payout = build_stripe_payout(
            amount=sum(transaction.account_amount for transaction in transactions),
            currency="eur",
        )

        # then
        session.expunge_all()

        transaction = await payout_transaction_service.create_payout_from_stripe(
            session, payout=stripe_payout, stripe_account_id="STRIPE_ACCOUNT_ID"
        )

        assert transaction.type == TransactionType.payout
        assert transaction.processor == PaymentProcessor.stripe
        assert transaction.currency == "usd"
        assert transaction.amount == -sum(
            transaction.amount for transaction in transactions
        )
        assert transaction.account_currency == "eur"
        assert transaction.account_amount == -stripe_payout.amount
        assert transaction.tax_amount == 0
        assert transaction.payout_id == stripe_payout.id
        assert transaction.account_id == account_eur.id

        paid_transactions_statement = select(Transaction).where(
            Transaction.payout_transaction_id == transaction.id
        )
        result = await session.execute(paid_transactions_statement)
        paid_transactions = result.scalars().all()
        assert len(paid_transactions) == len(transactions)


@pytest.mark.asyncio
class TestCreateManualPayout:
    async def test_unknown_transaction(
        self, session: AsyncSession, account_usd: Account
    ) -> None:
        # then
        session.expunge_all()

        with pytest.raises(UnknownTransaction):
            await payout_transaction_service.create_manual_payout(
                session,
                processor=PaymentProcessor.open_collective,
                account=account_usd,
                paid_transaction_ids=[uuid.uuid4()],
            )

    async def test_valid(self, session: AsyncSession, account_usd: Account) -> None:
        transaction_params = {
            "type": TransactionType.balance,
            "processor": PaymentProcessor.open_collective,
            "currency": "usd",
            "amount": 1000,
            "account_currency": "usd",
            "account_amount": 1000,
            "tax_amount": 0,
            "account": account_usd,
        }
        transactions: list[Transaction] = []
        for _ in range(0, 3):
            transaction = Transaction(**transaction_params)
            session.add(transaction)
            transactions.append(transaction)
        await session.commit()

        # then
        session.expunge_all()

        transaction = await payout_transaction_service.create_manual_payout(
            session,
            processor=PaymentProcessor.open_collective,
            account=account_usd,
            paid_transaction_ids=[transaction.id for transaction in transactions],
        )

        assert transaction.type == TransactionType.payout
        assert transaction.processor == PaymentProcessor.open_collective
        assert transaction.currency == account_usd.currency
        assert transaction.amount == -sum(
            transaction.amount for transaction in transactions
        )
        assert transaction.tax_amount == 0
        assert transaction.account_id == account_usd.id

        paid_transactions_statement = select(Transaction).where(
            Transaction.payout_transaction_id == transaction.id
        )
        result = await session.execute(paid_transactions_statement)
        paid_transactions = result.scalars().all()
        assert len(paid_transactions) == len(transactions)

    async def test_valid_different_currencies(
        self, session: AsyncSession, account_eur: Account
    ) -> None:
        transaction_params = {
            "type": TransactionType.balance,
            "processor": PaymentProcessor.open_collective,
            "currency": "usd",
            "amount": 1000,
            "account_currency": "eur",
            "account_amount": 900,
            "tax_amount": 0,
            "account": account_eur,
        }
        transactions: list[Transaction] = []
        for _ in range(0, 3):
            transaction = Transaction(**transaction_params)
            session.add(transaction)
            transactions.append(transaction)
        await session.commit()

        # then
        session.expunge_all()

        transaction = await payout_transaction_service.create_manual_payout(
            session,
            processor=PaymentProcessor.open_collective,
            account=account_eur,
            paid_transaction_ids=[transaction.id for transaction in transactions],
        )

        assert transaction.type == TransactionType.payout
        assert transaction.processor == PaymentProcessor.open_collective
        assert transaction.currency == "usd"
        assert transaction.amount == -sum(
            transaction.amount for transaction in transactions
        )
        assert transaction.account_currency == "eur"
        assert transaction.account_amount == -sum(
            transaction.account_amount for transaction in transactions
        )
        assert transaction.tax_amount == 0
        assert transaction.account_id == account_eur.id

        paid_transactions_statement = select(Transaction).where(
            Transaction.payout_transaction_id == transaction.id
        )
        result = await session.execute(paid_transactions_statement)
        paid_transactions = result.scalars().all()
        assert len(paid_transactions) == len(transactions)
