from types import SimpleNamespace
from unittest.mock import MagicMock

import pytest
from pytest_mock import MockerFixture
from sqlalchemy.orm import joinedload

from polar.enums import AccountType
from polar.integrations.stripe.service import StripeService
from polar.models import Account, Transaction, User
from polar.models.transaction import TransactionType
from polar.postgres import AsyncSession
from polar.transaction.service.balance import PaymentTransactionForChargeDoesNotExist
from polar.transaction.service.balance import (
    balance_transaction as balance_transaction_service,
)
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import create_payment_transaction


@pytest.fixture(autouse=True)
def stripe_service_mock(mocker: MockerFixture) -> MagicMock:
    mock = MagicMock(spec=StripeService)
    mocker.patch("polar.transaction.service.balance.stripe_service", new=mock)
    return mock


@pytest.mark.asyncio
class TestCreateBalance:
    async def test_valid(
        self, session: AsyncSession, save_fixture: SaveFixture, user: User
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
            stripe_id="STRIPE_ACCOUNT_ID",
        )
        await save_fixture(account)
        payment_transaction = await create_payment_transaction(save_fixture)

        # then
        session.expunge_all()

        outgoing, incoming = await balance_transaction_service.create_balance(
            session,
            source_account=None,
            destination_account=account,
            payment_transaction=payment_transaction,
            amount=1000,
        )

        assert outgoing.account is None
        assert outgoing.type == TransactionType.balance
        assert outgoing.processor is None
        assert outgoing.amount == -1000
        assert outgoing.payment_transaction == payment_transaction

        assert incoming.account == account
        assert incoming.type == TransactionType.balance
        assert incoming.processor is None
        assert incoming.amount == 1000
        assert incoming.payment_transaction == payment_transaction

        assert outgoing.balance_correlation_key == incoming.balance_correlation_key


@pytest.mark.asyncio
class TestCreateBalanceFromCharge:
    async def test_not_existing_charge(self, session: AsyncSession, user: User) -> None:
        account = Account(
            status=Account.Status.ACTIVE,
            account_type=AccountType.stripe,
            admin_id=user.id,
            country="FR",
            currency="eur",
            is_details_submitted=True,
            is_charges_enabled=True,
            is_payouts_enabled=True,
            stripe_id="STRIPE_ACCOUNT_ID",
        )

        # then
        session.expunge_all()

        with pytest.raises(PaymentTransactionForChargeDoesNotExist):
            await balance_transaction_service.create_balance_from_charge(
                session,
                source_account=None,
                destination_account=account,
                charge_id="STRIPE_CHARGE_ID",
                amount=1000,
            )

    async def test_valid(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        user: User,
        stripe_service_mock: MagicMock,
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
            stripe_id="STRIPE_ACCOUNT_ID",
        )
        await save_fixture(account)
        payment_transaction = await create_payment_transaction(save_fixture)

        stripe_service_mock.get_charge.return_value = SimpleNamespace(
            id="STRIPE_DESTINATION_CHARGE_ID",
            balance_transaction=SimpleNamespace(
                amount=900, currency="eur", exchange_rate=0.9
            ),
        )

        # then
        session.expunge_all()

        (
            incoming,
            outgoing,
        ) = await balance_transaction_service.create_balance_from_charge(
            session,
            source_account=None,
            destination_account=account,
            charge_id="STRIPE_CHARGE_ID",
            amount=1000,
        )

        assert incoming.payment_transaction
        assert incoming.payment_transaction.id == payment_transaction.id

        assert outgoing.payment_transaction
        assert outgoing.payment_transaction.id == payment_transaction.id


@pytest.mark.asyncio
class TestCreateBalanceFromPaymentIntent:
    async def test_valid(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        user: User,
        stripe_service_mock: MagicMock,
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
            stripe_id="STRIPE_ACCOUNT_ID",
        )
        await save_fixture(account)
        payment_transaction = await create_payment_transaction(save_fixture)

        stripe_service_mock.get_charge.return_value = SimpleNamespace(
            id="STRIPE_DESTINATION_CHARGE_ID",
            balance_transaction=SimpleNamespace(
                amount=900, currency="eur", exchange_rate=0.9
            ),
        )
        stripe_service_mock.retrieve_intent.return_value = SimpleNamespace(
            id="STRIPE_PAYMENT_INTENT_ID", latest_charge="STRIPE_CHARGE_ID"
        )

        # then
        session.expunge_all()

        (
            incoming,
            outgoing,
        ) = await balance_transaction_service.create_balance_from_payment_intent(
            session,
            source_account=None,
            destination_account=account,
            payment_intent_id="STRIPE_PAYMENT_INTENT_ID",
            amount=1000,
        )

        assert incoming.payment_transaction
        assert incoming.payment_transaction.id == payment_transaction.id

        assert outgoing.payment_transaction
        assert outgoing.payment_transaction.id == payment_transaction.id


async def create_balance_transactions(
    save_fixture: SaveFixture,
    *,
    destination_account: Account,
    currency: str = "usd",
    amount: int = 1000,
) -> tuple[Transaction, Transaction]:
    outgoing_transaction = Transaction(
        account=None,  # Polar account
        type=TransactionType.balance,
        currency=currency,
        amount=-amount,  # Subtract the amount
        account_currency=currency,
        account_amount=-amount,  # Subtract the amount
        tax_amount=0,
    )
    incoming_transaction = Transaction(
        account=destination_account,  # User account
        type=TransactionType.balance,
        currency=currency,
        amount=amount,  # Add the amount
        account_currency=currency,
        account_amount=amount,  # Add the amount
        tax_amount=0,
    )

    await save_fixture(outgoing_transaction)
    await save_fixture(incoming_transaction)

    return outgoing_transaction, incoming_transaction


async def load_balance_transactions(
    session: AsyncSession,
    balance_transactions: tuple[Transaction, Transaction],
) -> tuple[Transaction, Transaction]:
    outgoing, incoming = balance_transactions

    load_options = (
        joinedload(Transaction.account),
        joinedload(Transaction.pledge),
        joinedload(Transaction.issue_reward),
        joinedload(Transaction.order),
    )

    loaded_outgoing = await session.get(Transaction, outgoing.id, options=load_options)
    loaded_incoming = await session.get(Transaction, incoming.id, options=load_options)

    assert loaded_outgoing is not None
    assert loaded_incoming is not None

    return loaded_outgoing, loaded_incoming


@pytest.mark.asyncio
class TestCreateReversalBalance:
    async def test_valid(
        self, session: AsyncSession, save_fixture: SaveFixture, user: User
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
        await save_fixture(account)

        balance_transactions = await create_balance_transactions(
            save_fixture, destination_account=account
        )

        # then
        session.expunge_all()

        balance_transactions = await load_balance_transactions(
            session, balance_transactions
        )

        (
            outgoing,
            incoming,
        ) = await balance_transaction_service.create_reversal_balance(
            session, balance_transactions=balance_transactions, amount=1000
        )

        assert outgoing.account == account
        assert outgoing.type == TransactionType.balance
        assert outgoing.processor is None
        assert outgoing.amount == -1000
        assert incoming.account is None
        assert incoming.type == TransactionType.balance
        assert incoming.processor is None
        assert incoming.amount == 1000

        assert outgoing.balance_correlation_key == incoming.balance_correlation_key
