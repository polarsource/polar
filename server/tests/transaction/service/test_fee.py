from unittest.mock import MagicMock

import pytest
import stripe as stripe_lib
from pytest_mock import MockerFixture

from polar.integrations.stripe.service import StripeService
from polar.models import IssueReward, Pledge, Subscription, Transaction
from polar.models.transaction import FeeType, PaymentProcessor, TransactionType
from polar.postgres import AsyncSession
from polar.transaction.service.fee import (
    fee_transaction as fee_transaction_service,
)


@pytest.fixture(autouse=True)
def stripe_service_mock(mocker: MockerFixture) -> MagicMock:
    mock = MagicMock(spec=StripeService)
    mocker.patch("polar.transaction.service.fee.stripe_service", new=mock)
    return mock


async def create_payment_transaction(
    session: AsyncSession,
    *,
    processor: PaymentProcessor = PaymentProcessor.stripe,
    currency: str = "usd",
    amount: int = 1000,
    charge_id: str | None = "STRIPE_CHARGE_ID",
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
class TestCreatePaymentFees:
    async def test_not_stripe(self, session: AsyncSession) -> None:
        payment_transaction = await create_payment_transaction(
            session, processor=PaymentProcessor.open_collective
        )

        # then
        session.expunge_all()

        fee_transactions = await fee_transaction_service.create_payment_fees(
            session, payment_transaction=payment_transaction
        )
        assert len(fee_transactions) == 0

    async def test_stripe_no_charge_id(self, session: AsyncSession) -> None:
        payment_transaction = await create_payment_transaction(session, charge_id=None)

        # then
        session.expunge_all()

        fee_transactions = await fee_transaction_service.create_payment_fees(
            session, payment_transaction=payment_transaction
        )
        assert len(fee_transactions) == 0

    async def test_stripe_subscription(
        self, session: AsyncSession, stripe_service_mock: MagicMock
    ) -> None:
        payment_transaction = await create_payment_transaction(session)

        stripe_service_mock.get_charge.return_value = stripe_lib.Charge.construct_from(
            {
                "id": "STRIPE_CHARGE_ID",
                "balance_transaction": "STRIPE_BALANCE_TRANSACTION_ID",
                "invoice": "STRIPE_INVOICE_ID",
            },
            None,
        )
        stripe_service_mock.get_balance_transaction.return_value = (
            stripe_lib.BalanceTransaction.construct_from(
                {"id": "STRIPE_BALANCE_TRANSACTION_ID", "fee": 100}, None
            )
        )
        stripe_service_mock.get_invoice.return_value = (
            stripe_lib.Invoice.construct_from(
                {"id": "STRIPE_INVOICE_ID", "subscription": "STRIPE_SUBSCRIPTION_ID"},
                None,
            )
        )
        stripe_service_mock.get_subscription.return_value = (
            stripe_lib.Subscription.construct_from(
                {"id": "STRIPE_SUBSCRIPTION_ID", "automatic_tax": {"enabled": True}},
                None,
            )
        )

        # then
        session.expunge_all()

        fee_transactions = await fee_transaction_service.create_payment_fees(
            session, payment_transaction=payment_transaction
        )
        assert len(fee_transactions) == 3

        (
            payment_fee_transaction,
            subscription_fee_transaction,
            tax_fee_transaction,
        ) = fee_transactions

        assert payment_fee_transaction.type == TransactionType.fee
        assert payment_fee_transaction.processor == PaymentProcessor.stripe
        assert payment_fee_transaction.fee_type == FeeType.payment
        assert payment_fee_transaction.amount == -100
        assert (
            payment_fee_transaction.incurred_by_transaction_id == payment_transaction.id
        )

        assert subscription_fee_transaction.type == TransactionType.fee
        assert subscription_fee_transaction.processor == PaymentProcessor.stripe
        assert subscription_fee_transaction.fee_type == FeeType.subscription
        assert subscription_fee_transaction.amount == -5
        assert (
            subscription_fee_transaction.incurred_by_transaction_id
            == payment_transaction.id
        )

        assert tax_fee_transaction.type == TransactionType.fee
        assert tax_fee_transaction.processor == PaymentProcessor.stripe
        assert tax_fee_transaction.fee_type == FeeType.tax
        assert tax_fee_transaction.amount == -5
        assert tax_fee_transaction.incurred_by_transaction_id == payment_transaction.id
