from types import SimpleNamespace
from unittest.mock import MagicMock

import pytest
from pytest_mock import MockerFixture

from polar.enums import AccountType
from polar.integrations.stripe.service import StripeService
from polar.models import Account, Transaction, User
from polar.models.transaction import PaymentProcessor, TransactionType
from polar.postgres import AsyncSession
from polar.transaction.service.payout import (
    InsufficientBalance,
    NotReadyAccount,
    UnderReviewAccount,
)
from polar.transaction.service.payout import (
    payout_transaction as payout_transaction_service,
)


@pytest.fixture(autouse=True)
def stripe_service_mock(mocker: MockerFixture) -> MagicMock:
    mock = MagicMock(spec=StripeService)
    mocker.patch("polar.transaction.service.payout.stripe_service", new=mock)
    return mock


async def create_balance_transaction(
    session: AsyncSession,
    *,
    account: Account,
    currency: str = "usd",
    amount: int = 1000,
    charge_id: str = "STRIPE_CHARGE_ID",
) -> Transaction:
    transaction = Transaction(
        type=TransactionType.balance,
        account=account,
        processor=None,
        currency=currency,
        amount=amount,
        account_currency=currency,
        account_amount=amount,
        tax_amount=0,
        charge_id=charge_id,
    )
    session.add(transaction)
    await session.commit()
    return transaction


@pytest.mark.asyncio
class TestCreatePayout:
    async def test_insufficient_balance(
        self, session: AsyncSession, user: User
    ) -> None:
        account = Account(
            status=Account.Status.ACTIVE,
            account_type=AccountType.stripe,
            admin_id=user.id,
            country="US",
            currency="usd",
            is_details_submitted=True,
            is_charges_enabled=True,
            is_payouts_enabled=True,
            stripe_id="STRIPE_ACCOUNT_ID",
        )
        session.add(account)
        await session.commit()

        await create_balance_transaction(session, account=account, amount=-1000)

        # then
        session.expunge_all()

        with pytest.raises(InsufficientBalance):
            await payout_transaction_service.create_payout(session, account=account)

    async def test_under_review_account(
        self, session: AsyncSession, user: User
    ) -> None:
        account = Account(
            status=Account.Status.UNDER_REVIEW,
            account_type=AccountType.stripe,
            admin_id=user.id,
            country="US",
            currency="usd",
        )

        # then
        session.expunge_all()

        with pytest.raises(UnderReviewAccount):
            await payout_transaction_service.create_payout(session, account=account)

    async def test_inactive_account(self, session: AsyncSession, user: User) -> None:
        account = Account(
            status=Account.Status.ONBOARDING_STARTED,
            account_type=AccountType.stripe,
            admin_id=user.id,
            country="US",
            currency="usd",
        )

        # then
        session.expunge_all()

        with pytest.raises(NotReadyAccount):
            await payout_transaction_service.create_payout(session, account=account)

    async def test_stripe(
        self, session: AsyncSession, user: User, stripe_service_mock: MagicMock
    ) -> None:
        account = Account(
            status=Account.Status.ACTIVE,
            account_type=AccountType.stripe,
            admin_id=user.id,
            country="US",
            currency="usd",
            is_details_submitted=True,
            is_charges_enabled=True,
            is_payouts_enabled=True,
            processor_fees_applicable=True,
            stripe_id="STRIPE_ACCOUNT_ID",
        )
        session.add(account)
        await session.commit()

        balance_transaction = await create_balance_transaction(session, account=account)

        stripe_service_mock.transfer.return_value = SimpleNamespace(
            id="STRIPE_TRANSFER_ID", balance_transaction="STRIPE_BALANCE_TRANSACTION_ID"
        )
        stripe_service_mock.create_payout.return_value = SimpleNamespace(
            id="STRIPE_PAYOUT_ID"
        )

        # then
        session.expunge_all()

        payout = await payout_transaction_service.create_payout(
            session, account=account
        )

        assert payout.account_id == account.id
        assert payout.processor == PaymentProcessor.stripe
        assert payout.transfer_id == "STRIPE_TRANSFER_ID"
        assert payout.payout_id == "STRIPE_PAYOUT_ID"
        assert payout.currency == "usd"
        assert payout.amount < 0
        assert payout.account_currency == "usd"
        assert payout.account_amount < 0

        assert len(payout.paid_transactions) == 1 + len(
            [
                t
                for t in payout.incurred_transactions
                if t.account_id == payout.account_id
            ]
        )
        assert payout.paid_transactions[0].id == balance_transaction.id

        assert len(payout.incurred_transactions) > 0
        assert (
            len(payout.account_incurred_transactions)
            == len(payout.incurred_transactions) / 2
        )

        stripe_service_mock.transfer.assert_called_once()
        assert stripe_service_mock.transfer.call_args[1]["metadata"][
            "payout_transaction_id"
        ] == str(payout.id)

        stripe_service_mock.create_payout.assert_called_once()
        assert (
            stripe_service_mock.create_payout.call_args[1]["metadata"][
                "stripe_transfer_id"
            ]
            == "STRIPE_TRANSFER_ID"
        )
        assert stripe_service_mock.create_payout.call_args[1]["metadata"][
            "payout_transaction_id"
        ] == str(payout.id)
        assert stripe_service_mock.create_payout.call_args[1]["amount"] == abs(
            payout.amount
        )

    async def test_stripe_different_currencies(
        self, session: AsyncSession, user: User, stripe_service_mock: MagicMock
    ) -> None:
        account = Account(
            status=Account.Status.ACTIVE,
            account_type=AccountType.stripe,
            admin_id=user.id,
            country="FR",
            currency="eur",
            is_details_submitted=True,
            is_charges_enabled=True,
            is_payouts_enabled=True,
            processor_fees_applicable=True,
            stripe_id="STRIPE_ACCOUNT_ID",
        )
        session.add(account)
        await session.commit()

        balance_transaction = await create_balance_transaction(session, account=account)

        stripe_service_mock.transfer.return_value = SimpleNamespace(
            id="STRIPE_TRANSFER_ID",
            balance_transaction="STRIPE_BALANCE_TRANSACTION_ID",
            destination_payment="STRIPE_DESTINATION_CHARGE_ID",
        )
        stripe_service_mock.get_charge.return_value = SimpleNamespace(
            id="STRIPE_DESTINATION_CHARGE_ID",
            balance_transaction=SimpleNamespace(
                amount=900, currency="eur", exchange_rate=0.9
            ),
        )
        stripe_service_mock.create_payout.return_value = SimpleNamespace(
            id="STRIPE_PAYOUT_ID"
        )

        # then
        session.expunge_all()

        payout = await payout_transaction_service.create_payout(
            session, account=account
        )

        assert payout.account_id == account.id
        assert payout.processor == PaymentProcessor.stripe
        assert payout.transfer_id == "STRIPE_TRANSFER_ID"
        assert payout.payout_id == "STRIPE_PAYOUT_ID"
        assert payout.currency == "usd"
        assert payout.amount < 0
        assert payout.account_currency == "eur"
        assert payout.account_amount < 0

        assert len(payout.paid_transactions) == 1 + len(
            [
                t
                for t in payout.incurred_transactions
                if t.account_id == payout.account_id
            ]
        )
        assert payout.paid_transactions[0].id == balance_transaction.id

        stripe_service_mock.create_payout.assert_called_once()
        assert stripe_service_mock.create_payout.call_args[1]["amount"] == abs(
            payout.account_amount
        )

    async def test_open_collective(self, session: AsyncSession, user: User) -> None:
        account = Account(
            status=Account.Status.ACTIVE,
            account_type=AccountType.open_collective,
            admin_id=user.id,
            country="US",
            currency="usd",
            is_details_submitted=False,
            is_charges_enabled=False,
            is_payouts_enabled=False,
            processor_fees_applicable=True,
            open_collective_slug="polarsource",
        )
        session.add(account)
        await session.commit()

        balance_transaction = await create_balance_transaction(session, account=account)

        # then
        session.expunge_all()

        payout = await payout_transaction_service.create_payout(
            session, account=account
        )

        assert payout.account_id == account.id
        assert payout.processor == PaymentProcessor.open_collective
        assert payout.currency == "usd"
        assert payout.amount == -balance_transaction.amount
        assert payout.account_currency == "usd"
        assert payout.account_amount == -balance_transaction.amount

        assert len(payout.paid_transactions) == 1 + len(
            [
                t
                for t in payout.incurred_transactions
                if t.account_id == payout.account_id
            ]
        )
        assert payout.paid_transactions[0].id == balance_transaction.id

        assert len(payout.incurred_transactions) == 0
        assert len(payout.account_incurred_transactions) == 0
