from types import SimpleNamespace
from unittest.mock import MagicMock

import pytest
from pytest_mock import MockerFixture

from polar.enums import AccountType
from polar.integrations.stripe.service import StripeService
from polar.models import Account, IssueReward, Pledge, Subscription, Transaction, User
from polar.models.transaction import PaymentProcessor, TransactionType
from polar.postgres import AsyncSession
from polar.transaction.service.balance import PaymentTransactionForChargeDoesNotExist
from polar.transaction.service.balance import (
    balance_transaction as balance_transaction_service,
)


@pytest.fixture(autouse=True)
def stripe_service_mock(mocker: MockerFixture) -> MagicMock:
    mock = MagicMock(spec=StripeService)
    mocker.patch("polar.transaction.service.balance.stripe_service", new=mock)
    return mock


async def create_payment_transaction(
    session: AsyncSession,
    *,
    processor: PaymentProcessor = PaymentProcessor.stripe,
    currency: str = "usd",
    amount: int = 1000,
    charge_id: str = "STRIPE_CHARGE_ID",
    pledge: Pledge | None = None,
    subscription: Subscription | None = None,
    issue_reward: IssueReward | None = None,
) -> Transaction:
    transaction = Transaction(
        type=TransactionType.payment,
        processor=processor,
        currency=currency,
        amount=amount,
        account_currency=currency,
        account_amount=amount,
        tax_amount=0,
        charge_id=charge_id,
        pledge=pledge,
        subscription=subscription,
        issue_reward=issue_reward,
    )
    session.add(transaction)
    await session.commit()
    return transaction


@pytest.mark.asyncio
class TestCreateBalance:
    async def test_valid(self, session: AsyncSession, user: User) -> None:
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
        session.add(account)
        await session.commit()
        payment_transaction = await create_payment_transaction(session)

        # then
        session.expunge_all()

        outgoing, incoming = await balance_transaction_service.create_balance(
            session,
            destination_account=account,
            payment_transaction=payment_transaction,
            amount=1000,
        )

        assert outgoing.account_id is None
        assert outgoing.type == TransactionType.balance
        assert outgoing.processor is None
        assert outgoing.amount == -1000
        assert outgoing.payment_transaction == payment_transaction

        assert incoming.account_id == account.id
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
                destination_account=account,
                charge_id="STRIPE_CHARGE_ID",
                amount=1000,
            )

    async def test_valid(
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
            stripe_id="STRIPE_ACCOUNT_ID",
        )
        payment_transaction = await create_payment_transaction(session)

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
            stripe_id="STRIPE_ACCOUNT_ID",
        )
        payment_transaction = await create_payment_transaction(session)

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
            destination_account=account,
            payment_intent_id="STRIPE_PAYMENT_INTENT_ID",
            amount=1000,
        )

        assert incoming.payment_transaction
        assert incoming.payment_transaction.id == payment_transaction.id

        assert outgoing.payment_transaction
        assert outgoing.payment_transaction.id == payment_transaction.id


async def create_balance_transactions(
    session: AsyncSession,
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

    session.add(outgoing_transaction)
    session.add(incoming_transaction)
    await session.commit()

    return outgoing_transaction, incoming_transaction


@pytest.mark.asyncio
class TestCreateReversalBalance:
    async def test_valid(self, session: AsyncSession, user: User) -> None:
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

        # then?
        session.expunge_all()

        balance_transactions = await create_balance_transactions(
            session, destination_account=account
        )

        (
            outgoing,
            incoming,
        ) = await balance_transaction_service.create_reversal_balance(
            session,
            balance_transactions=balance_transactions,
            destination_currency="usd",
            amount=1000,
        )

        assert outgoing.account_id == account.id
        assert outgoing.type == TransactionType.balance
        assert outgoing.processor is None
        assert outgoing.amount == -1000
        assert incoming.account_id is None
        assert incoming.type == TransactionType.balance
        assert incoming.processor is None
        assert incoming.amount == 1000

        assert outgoing.balance_correlation_key == incoming.balance_correlation_key
