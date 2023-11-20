import uuid
from unittest.mock import MagicMock

import pytest
import pytest_asyncio
import stripe as stripe_lib
from pytest_mock import MockerFixture
from sqlalchemy import select

from polar.enums import AccountType
from polar.integrations.stripe.service import StripeService
from polar.models import Account, Organization, Transaction, User
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
    *, status: str = "paid", amount: int = 1000, balance_transaction: str | None = None
) -> stripe_lib.Payout:
    return stripe_lib.Payout.construct_from(
        {
            "id": "STRIPE_PAYOUT_ID",
            "status": status,
            "currency": "usd",
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


@pytest_asyncio.fixture
async def organization_account(
    session: AsyncSession,
    organization: Organization,
    user: User,
) -> Account:
    account = Account(
        account_type=AccountType.stripe,
        organization_id=organization.id,
        admin_id=user.id,
        country="US",
        currency="USD",
        is_details_submitted=True,
        is_charges_enabled=True,
        is_payouts_enabled=True,
        stripe_id="STRIPE_ACCOUNT_ID",
    )
    session.add(account)
    await session.commit()
    return account


@pytest.mark.asyncio
class TestCreatePayoutFromStripe:
    async def test_not_paid_payout(self, session: AsyncSession) -> None:
        stripe_payout = build_stripe_payout(status="pending")

        with pytest.raises(StripePayoutNotPaid):
            await payout_transaction_service.create_payout_from_stripe(
                session, payout=stripe_payout, stripe_account_id="STRIPE_ACCOUNT_ID"
            )

    async def test_unknown_account(self, session: AsyncSession) -> None:
        stripe_payout = build_stripe_payout()

        with pytest.raises(UnknownAccount):
            await payout_transaction_service.create_payout_from_stripe(
                session, payout=stripe_payout, stripe_account_id="STRIPE_ACCOUNT_ID"
            )

    async def test_valid(
        self,
        session: AsyncSession,
        organization_account: Account,
        stripe_service_mock: MagicMock,
    ) -> None:
        transaction_params = {
            "type": TransactionType.transfer,
            "processor": PaymentProcessor.stripe,
            "currency": "usd",
            "amount": 1000,
            "tax_amount": 0,
            "processor_fee_amount": 0,
            "account": organization_account,
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

        payout_balance_transaction = build_stripe_balance_transaction()
        stripe_service_mock.get_balance_transaction.return_value = (
            payout_balance_transaction
        )

        stripe_payout = build_stripe_payout(
            amount=sum(transaction.amount for transaction in transactions),
            balance_transaction=payout_balance_transaction.id,
        )

        transaction = await payout_transaction_service.create_payout_from_stripe(
            session, payout=stripe_payout, stripe_account_id="STRIPE_ACCOUNT_ID"
        )

        assert transaction.type == TransactionType.payout
        assert transaction.processor == PaymentProcessor.stripe
        assert transaction.currency == stripe_payout.currency
        assert transaction.amount == -stripe_payout.amount
        assert transaction.tax_amount == 0
        assert transaction.processor_fee_amount == payout_balance_transaction.fee
        assert transaction.payout_id == stripe_payout.id
        assert transaction.account_id == organization_account.id

        paid_transactions_statement = select(Transaction).where(
            Transaction.payout_transaction_id == transaction.id
        )
        result = await session.execute(paid_transactions_statement)
        paid_transactions = result.scalars().all()
        assert len(paid_transactions) == len(transactions)


@pytest.mark.asyncio
class TestCreateManualPayout:
    async def test_unknown_transaction(
        self, session: AsyncSession, organization_account: Account
    ) -> None:
        with pytest.raises(UnknownTransaction):
            await payout_transaction_service.create_manual_payout(
                session,
                processor=PaymentProcessor.open_collective,
                account=organization_account,
                paid_transaction_ids=[uuid.uuid4()],
            )

    async def test_valid(
        self, session: AsyncSession, organization_account: Account
    ) -> None:
        transaction_params = {
            "type": TransactionType.transfer,
            "processor": PaymentProcessor.open_collective,
            "currency": "usd",
            "amount": 1000,
            "tax_amount": 0,
            "processor_fee_amount": 0,
            "account": organization_account,
        }
        transactions: list[Transaction] = []
        for _ in range(0, 3):
            transaction = Transaction(**transaction_params)
            session.add(transaction)
            transactions.append(transaction)
        await session.commit()

        transaction = await payout_transaction_service.create_manual_payout(
            session,
            processor=PaymentProcessor.open_collective,
            account=organization_account,
            paid_transaction_ids=[transaction.id for transaction in transactions],
        )

        assert transaction.type == TransactionType.payout
        assert transaction.processor == PaymentProcessor.open_collective
        assert transaction.currency == organization_account.currency
        assert transaction.amount == -sum(
            transaction.amount for transaction in transactions
        )
        assert transaction.tax_amount == 0
        assert transaction.processor_fee_amount == 0
        assert transaction.account_id == organization_account.id

        paid_transactions_statement = select(Transaction).where(
            Transaction.payout_transaction_id == transaction.id
        )
        result = await session.execute(paid_transactions_statement)
        paid_transactions = result.scalars().all()
        assert len(paid_transactions) == len(transactions)
