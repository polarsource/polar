from typing import Literal
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


async def create_refund_transaction(
    session: AsyncSession,
    *,
    processor: PaymentProcessor = PaymentProcessor.stripe,
    currency: str = "usd",
    amount: int = 1000,
    charge_id: str | None = "STRIPE_CHARGE_ID",
    refund_id: str | None = "STRIPE_REFUND_ID",
    pledge: Pledge | None = None,
    subscription: Subscription | None = None,
    issue_reward: IssueReward | None = None,
) -> Transaction:
    transaction = Transaction(
        type=TransactionType.dispute,
        processor=processor,
        currency=currency,
        amount=amount,
        account_currency=currency,
        account_amount=amount,
        tax_amount=0,
        charge_id=charge_id,
        refund_id=refund_id,
        pledge=pledge,
        subscription=subscription,
        issue_reward=issue_reward,
    )
    session.add(transaction)
    await session.commit()
    return transaction


async def create_dispute_transaction(
    session: AsyncSession,
    *,
    processor: PaymentProcessor = PaymentProcessor.stripe,
    currency: str = "usd",
    amount: int = 1000,
    charge_id: str | None = "STRIPE_CHARGE_ID",
    dispute_id: str | None = "STRIPE_DISPUTE_ID",
    pledge: Pledge | None = None,
    subscription: Subscription | None = None,
    issue_reward: IssueReward | None = None,
) -> Transaction:
    transaction = Transaction(
        type=TransactionType.dispute,
        processor=processor,
        currency=currency,
        amount=amount,
        account_currency=currency,
        account_amount=amount,
        tax_amount=0,
        charge_id=charge_id,
        dispute_id=dispute_id,
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


@pytest.mark.asyncio
class TestCreateRefundFees:
    async def test_not_stripe(self, session: AsyncSession) -> None:
        refund_transaction = await create_refund_transaction(
            session, processor=PaymentProcessor.open_collective
        )

        # then
        session.expunge_all()

        fee_transactions = await fee_transaction_service.create_refund_fees(
            session, refund_transaction=refund_transaction
        )
        assert len(fee_transactions) == 0

    async def test_stripe_no_refund_id(self, session: AsyncSession) -> None:
        refund_transaction = await create_refund_transaction(session, refund_id=None)

        # then
        session.expunge_all()

        fee_transactions = await fee_transaction_service.create_refund_fees(
            session, refund_transaction=refund_transaction
        )
        assert len(fee_transactions) == 0

    async def test_stripe_refund(
        self,
        session: AsyncSession,
        stripe_service_mock: MagicMock,
    ) -> None:
        refund_transaction = await create_refund_transaction(session)

        stripe_service_mock.get_refund.return_value = stripe_lib.Refund.construct_from(
            {
                "id": "STRIPE_REFUND_ID",
                "charge": "STRIPE_CHARGE_ID",
                "currency": "usd",
                "amount": 100,
                "balance_transaction": "STRIPE_BALANCE_TRANSACTION_ID",
            },
            None,
        )
        stripe_service_mock.get_balance_transaction.return_value = (
            stripe_lib.BalanceTransaction.construct_from(
                {"id": "STRIPE_BALANCE_TRANSACTION_ID", "fee": 100}, None
            )
        )

        # then
        session.expunge_all()

        fee_transactions = await fee_transaction_service.create_refund_fees(
            session, refund_transaction=refund_transaction
        )
        assert len(fee_transactions) == 1

        refund_fee_transaction = fee_transactions[0]

        assert refund_fee_transaction.type == TransactionType.fee
        assert refund_fee_transaction.processor == PaymentProcessor.stripe
        assert refund_fee_transaction.fee_type == FeeType.refund
        assert refund_fee_transaction.amount == -100
        assert (
            refund_fee_transaction.incurred_by_transaction_id == refund_transaction.id
        )


@pytest.mark.asyncio
class TestCreateDisputeFees:
    async def test_not_stripe(self, session: AsyncSession) -> None:
        dispute_transaction = await create_dispute_transaction(
            session, processor=PaymentProcessor.open_collective
        )

        # then
        session.expunge_all()

        fee_transactions = await fee_transaction_service.create_dispute_fees(
            session, dispute_transaction=dispute_transaction, category="dispute"
        )
        assert len(fee_transactions) == 0

    async def test_stripe_no_dispute_id(self, session: AsyncSession) -> None:
        dispute_transaction = await create_dispute_transaction(session, dispute_id=None)

        # then
        session.expunge_all()

        fee_transactions = await fee_transaction_service.create_dispute_fees(
            session, dispute_transaction=dispute_transaction, category="dispute"
        )
        assert len(fee_transactions) == 0

    @pytest.mark.parametrize("category", ["dispute", "dispute_reversal"])
    async def test_stripe_dispute(
        self,
        category: Literal["dispute", "dispute_reversal"],
        session: AsyncSession,
        stripe_service_mock: MagicMock,
    ) -> None:
        dispute_transaction = await create_dispute_transaction(session)

        stripe_service_mock.get_dispute.return_value = (
            stripe_lib.Dispute.construct_from(
                {
                    "id": "STRIPE_DISPUTE_ID",
                    "charge": "STRIPE_CHARGE_ID",
                    "currency": "usd",
                    "amount": 100,
                    "balance_transactions": [
                        {
                            "id": "STRIPE_BALANCE_TRANSACTION_ID",
                            "fee": 100,
                            "reporting_category": category,
                        }
                    ],
                },
                None,
            )
        )

        # then
        session.expunge_all()

        fee_transactions = await fee_transaction_service.create_dispute_fees(
            session, dispute_transaction=dispute_transaction, category=category
        )
        assert len(fee_transactions) == 1

        dispute_fee_transaction = fee_transactions[0]

        assert dispute_fee_transaction.type == TransactionType.fee
        assert dispute_fee_transaction.processor == PaymentProcessor.stripe
        assert dispute_fee_transaction.fee_type == FeeType.dispute
        assert dispute_fee_transaction.amount == -100
        assert (
            dispute_fee_transaction.incurred_by_transaction_id == dispute_transaction.id
        )


@pytest.mark.asyncio
class TestSyncStripeFees:
    async def test_sync_stripe_fees(
        self,
        session: AsyncSession,
        stripe_service_mock: MagicMock,
    ) -> None:
        balance_transactions = [
            stripe_lib.BalanceTransaction.construct_from(
                {
                    "id": "STRIPE_BALANCE_TRANSACTION_ID_1",
                    "net": 100,
                    "currency": "usd",
                    "description": "Connect (2024-01-01 - 2024-01-31): Payout Fee",
                },
                None,
            ),
            stripe_lib.BalanceTransaction.construct_from(
                {
                    "id": "STRIPE_BALANCE_TRANSACTION_ID_2",
                    "net": 200,
                    "currency": "usd",
                    "description": "Connect (2024-01-01 - 2024-01-31): Account Volume Billing",
                },
                None,
            ),
            stripe_lib.BalanceTransaction.construct_from(
                {
                    "id": "STRIPE_BALANCE_TRANSACTION_ID_3",
                    "net": 300,
                    "currency": "usd",
                    "description": "Connect (2024-01-01 - 2024-01-31): Active Account Billing",
                },
                None,
            ),
            stripe_lib.BalanceTransaction.construct_from(
                {
                    "id": "STRIPE_BALANCE_TRANSACTION_ID_4",
                    "net": 400,
                    "currency": "usd",
                    "description": "Connect (2024-01-01 - 2024-01-31): Cross-Border Transfers",
                },
                None,
            ),
            stripe_lib.BalanceTransaction.construct_from(
                {
                    "id": "STRIPE_BALANCE_TRANSACTION_ID_5",
                    "net": 100,
                    "currency": "usd",
                    "description": "Connect (2024-01-01 - 2024-01-31): Payout Fee",
                },
                None,
            ),
            stripe_lib.BalanceTransaction.construct_from(
                {
                    "id": "STRIPE_BALANCE_TRANSACTION_ID_6",
                    "net": 200,
                    "currency": "usd",
                    "description": "Connect (2024-01-01 - 2024-01-31): Account Volume Billing",
                },
                None,
            ),
        ]

        stripe_service_mock.list_balance_transactions.return_value = (
            balance_transactions
        )

        fee_transaction_6 = Transaction(
            type=TransactionType.fee,
            processor=PaymentProcessor.stripe,
            fee_type=FeeType.payout,
            currency="usd",
            amount=-200,
            account_currency="usd",
            account_amount=-200,
            tax_amount=0,
            fee_balance_transaction_id="STRIPE_BALANCE_TRANSACTION_ID_6",
        )
        fee_transaction_5 = Transaction(
            type=TransactionType.fee,
            processor=PaymentProcessor.stripe,
            fee_type=FeeType.payout,
            currency="usd",
            amount=-100,
            account_currency="usd",
            account_amount=-100,
            tax_amount=0,
            fee_balance_transaction_id="STRIPE_BALANCE_TRANSACTION_ID_5",
        )
        session.add(fee_transaction_6)
        session.add(fee_transaction_5)
        await session.commit()

        # then
        session.expunge_all()

        fee_transactions = await fee_transaction_service.sync_stripe_fees(session)

        assert len(fee_transactions) == 4

        (
            fee_transaction_1,
            fee_transaction_2,
            fee_transaction_3,
            fee_transaction_4,
        ) = fee_transactions

        assert fee_transaction_1.type == TransactionType.fee
        assert fee_transaction_1.fee_type == FeeType.payout
        assert fee_transaction_1.amount == -100

        assert fee_transaction_2.type == TransactionType.fee
        assert fee_transaction_2.fee_type == FeeType.payout
        assert fee_transaction_2.amount == -200

        assert fee_transaction_3.type == TransactionType.fee
        assert fee_transaction_3.fee_type == FeeType.account
        assert fee_transaction_3.amount == -300

        assert fee_transaction_4.type == TransactionType.fee
        assert fee_transaction_4.fee_type == FeeType.cross_border_transfer
        assert fee_transaction_4.amount == -400
