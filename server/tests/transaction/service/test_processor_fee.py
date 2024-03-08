import datetime
from typing import Literal
from unittest.mock import MagicMock

import pytest
import stripe as stripe_lib
from pytest_mock import MockerFixture

from polar.integrations.stripe.service import StripeService
from polar.models import IssueReward, Pledge, Subscription, Transaction
from polar.models.transaction import PaymentProcessor, ProcessorFeeType, TransactionType
from polar.postgres import AsyncSession
from polar.transaction.service.processor_fee import (
    processor_fee_transaction as processor_fee_transaction_service,
)
from tests.fixtures.database import SaveFixture


@pytest.fixture(autouse=True)
def stripe_service_mock(mocker: MockerFixture) -> MagicMock:
    mock = MagicMock(spec=StripeService)
    mocker.patch("polar.transaction.service.processor_fee.stripe_service", new=mock)
    return mock


async def create_payment_transaction(
    save_fixture: SaveFixture,
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
    await save_fixture(transaction)
    return transaction


async def create_refund_transaction(
    save_fixture: SaveFixture,
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
    await save_fixture(transaction)
    return transaction


async def create_dispute_transaction(
    save_fixture: SaveFixture,
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
    await save_fixture(transaction)
    return transaction


@pytest.mark.asyncio
class TestCreatePaymentFees:
    async def test_not_stripe(
        self, session: AsyncSession, save_fixture: SaveFixture
    ) -> None:
        payment_transaction = await create_payment_transaction(
            save_fixture, processor=PaymentProcessor.open_collective
        )

        # then
        session.expunge_all()

        fee_transactions = await processor_fee_transaction_service.create_payment_fees(
            session, payment_transaction=payment_transaction
        )
        assert len(fee_transactions) == 0

    async def test_stripe_no_charge_id(
        self, session: AsyncSession, save_fixture: SaveFixture
    ) -> None:
        payment_transaction = await create_payment_transaction(
            save_fixture, charge_id=None
        )

        # then
        session.expunge_all()

        fee_transactions = await processor_fee_transaction_service.create_payment_fees(
            session, payment_transaction=payment_transaction
        )
        assert len(fee_transactions) == 0

    async def test_stripe_subscription(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        stripe_service_mock: MagicMock,
    ) -> None:
        payment_transaction = await create_payment_transaction(save_fixture)

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

        # then
        session.expunge_all()

        fee_transactions = await processor_fee_transaction_service.create_payment_fees(
            session, payment_transaction=payment_transaction
        )
        assert len(fee_transactions) == 1

        payment_fee_transaction = fee_transactions[0]

        assert payment_fee_transaction.type == TransactionType.processor_fee
        assert payment_fee_transaction.processor == PaymentProcessor.stripe
        assert payment_fee_transaction.processor_fee_type == ProcessorFeeType.payment
        assert payment_fee_transaction.amount == -100
        assert (
            payment_fee_transaction.incurred_by_transaction_id == payment_transaction.id
        )


@pytest.mark.asyncio
class TestCreateRefundFees:
    async def test_not_stripe(
        self, session: AsyncSession, save_fixture: SaveFixture
    ) -> None:
        refund_transaction = await create_refund_transaction(
            save_fixture, processor=PaymentProcessor.open_collective
        )

        # then
        session.expunge_all()

        fee_transactions = await processor_fee_transaction_service.create_refund_fees(
            session, refund_transaction=refund_transaction
        )
        assert len(fee_transactions) == 0

    async def test_stripe_no_refund_id(
        self, session: AsyncSession, save_fixture: SaveFixture
    ) -> None:
        refund_transaction = await create_refund_transaction(
            save_fixture, refund_id=None
        )

        # then
        session.expunge_all()

        fee_transactions = await processor_fee_transaction_service.create_refund_fees(
            session, refund_transaction=refund_transaction
        )
        assert len(fee_transactions) == 0

    async def test_stripe_refund(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        stripe_service_mock: MagicMock,
    ) -> None:
        refund_transaction = await create_refund_transaction(save_fixture)

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

        fee_transactions = await processor_fee_transaction_service.create_refund_fees(
            session, refund_transaction=refund_transaction
        )
        assert len(fee_transactions) == 1

        refund_fee_transaction = fee_transactions[0]

        assert refund_fee_transaction.type == TransactionType.processor_fee
        assert refund_fee_transaction.processor == PaymentProcessor.stripe
        assert refund_fee_transaction.processor_fee_type == ProcessorFeeType.refund
        assert refund_fee_transaction.amount == -100
        assert (
            refund_fee_transaction.incurred_by_transaction_id == refund_transaction.id
        )


@pytest.mark.asyncio
class TestCreateDisputeFees:
    async def test_not_stripe(
        self, session: AsyncSession, save_fixture: SaveFixture
    ) -> None:
        dispute_transaction = await create_dispute_transaction(
            save_fixture, processor=PaymentProcessor.open_collective
        )

        # then
        session.expunge_all()

        fee_transactions = await processor_fee_transaction_service.create_dispute_fees(
            session, dispute_transaction=dispute_transaction, category="dispute"
        )
        assert len(fee_transactions) == 0

    async def test_stripe_no_dispute_id(
        self, session: AsyncSession, save_fixture: SaveFixture
    ) -> None:
        dispute_transaction = await create_dispute_transaction(
            save_fixture, dispute_id=None
        )

        # then
        session.expunge_all()

        fee_transactions = await processor_fee_transaction_service.create_dispute_fees(
            session, dispute_transaction=dispute_transaction, category="dispute"
        )
        assert len(fee_transactions) == 0

    @pytest.mark.parametrize("category", ["dispute", "dispute_reversal"])
    async def test_stripe_dispute(
        self,
        category: Literal["dispute", "dispute_reversal"],
        session: AsyncSession,
        save_fixture: SaveFixture,
        stripe_service_mock: MagicMock,
    ) -> None:
        dispute_transaction = await create_dispute_transaction(save_fixture)

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

        fee_transactions = await processor_fee_transaction_service.create_dispute_fees(
            session, dispute_transaction=dispute_transaction, category=category
        )
        assert len(fee_transactions) == 1

        dispute_fee_transaction = fee_transactions[0]

        assert dispute_fee_transaction.type == TransactionType.processor_fee
        assert dispute_fee_transaction.processor == PaymentProcessor.stripe
        assert dispute_fee_transaction.processor_fee_type == ProcessorFeeType.dispute
        assert dispute_fee_transaction.amount == -100
        assert (
            dispute_fee_transaction.incurred_by_transaction_id == dispute_transaction.id
        )


@pytest.mark.asyncio
class TestSyncStripeFees:
    async def test_sync_stripe_fees(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        stripe_service_mock: MagicMock,
    ) -> None:
        now_timestamp = int(datetime.datetime.now().timestamp())
        balance_transactions = [
            stripe_lib.BalanceTransaction.construct_from(
                {
                    "created": now_timestamp,
                    "id": "STRIPE_BALANCE_TRANSACTION_ID_1",
                    "net": -100,
                    "currency": "usd",
                    "description": "Connect (2024-01-01 - 2024-01-31): Payout Fee",
                },
                None,
            ),
            stripe_lib.BalanceTransaction.construct_from(
                {
                    "created": now_timestamp,
                    "id": "STRIPE_BALANCE_TRANSACTION_ID_2",
                    "net": -200,
                    "currency": "usd",
                    "description": "Connect (2024-01-01 - 2024-01-31): Account Volume Billing",
                },
                None,
            ),
            stripe_lib.BalanceTransaction.construct_from(
                {
                    "created": now_timestamp,
                    "id": "STRIPE_BALANCE_TRANSACTION_ID_3",
                    "net": -300,
                    "currency": "usd",
                    "description": "Connect (2024-01-01 - 2024-01-31): Active Account Billing",
                },
                None,
            ),
            stripe_lib.BalanceTransaction.construct_from(
                {
                    "created": now_timestamp,
                    "id": "STRIPE_BALANCE_TRANSACTION_ID_4",
                    "net": -400,
                    "currency": "usd",
                    "description": "Connect (2024-01-01 - 2024-01-31): Cross-Border Transfers",
                },
                None,
            ),
            stripe_lib.BalanceTransaction.construct_from(
                {
                    "created": now_timestamp,
                    "id": "STRIPE_BALANCE_TRANSACTION_ID_5",
                    "net": -500,
                    "currency": "usd",
                    "description": "Billing (2024-01-03): Subscriptions",
                },
                None,
            ),
            stripe_lib.BalanceTransaction.construct_from(
                {
                    "created": now_timestamp,
                    "id": "STRIPE_BALANCE_TRANSACTION_ID_6",
                    "net": -600,
                    "currency": "usd",
                    "description": "Automatic Taxes (2024-01-03): Automatic tax",
                },
                None,
            ),
            stripe_lib.BalanceTransaction.construct_from(
                {
                    "created": now_timestamp,
                    "id": "STRIPE_BALANCE_TRANSACTION_ID_7",
                    "net": -700,
                    "currency": "usd",
                    "description": "Invoicing (2024-01-03): Invoicing Plus",
                },
                None,
            ),
            stripe_lib.BalanceTransaction.construct_from(
                {
                    "created": now_timestamp,
                    "id": "STRIPE_BALANCE_TRANSACTION_ID_8",
                    "net": -100,
                    "currency": "usd",
                    "description": "Connect (2024-01-01 - 2024-01-31): Payout Fee",
                },
                None,
            ),
            stripe_lib.BalanceTransaction.construct_from(
                {
                    "created": now_timestamp,
                    "id": "STRIPE_BALANCE_TRANSACTION_ID_9",
                    "net": -200,
                    "currency": "usd",
                    "description": "Connect (2024-01-01 - 2024-01-31): Account Volume Billing",
                },
                None,
            ),
        ]

        stripe_service_mock.list_balance_transactions.return_value = (
            balance_transactions
        )

        fee_transaction_9 = Transaction(
            type=TransactionType.processor_fee,
            processor=PaymentProcessor.stripe,
            processor_fee_type=ProcessorFeeType.payout,
            currency="usd",
            amount=-200,
            account_currency="usd",
            account_amount=-200,
            tax_amount=0,
            fee_balance_transaction_id="STRIPE_BALANCE_TRANSACTION_ID_9",
        )
        fee_transaction_8 = Transaction(
            type=TransactionType.processor_fee,
            processor=PaymentProcessor.stripe,
            processor_fee_type=ProcessorFeeType.payout,
            currency="usd",
            amount=-100,
            account_currency="usd",
            account_amount=-100,
            tax_amount=0,
            fee_balance_transaction_id="STRIPE_BALANCE_TRANSACTION_ID_8",
        )
        await save_fixture(fee_transaction_9)
        await save_fixture(fee_transaction_8)

        # then
        session.expunge_all()

        fee_transactions = await processor_fee_transaction_service.sync_stripe_fees(
            session
        )

        assert len(fee_transactions) == 7

        (
            fee_transaction_1,
            fee_transaction_2,
            fee_transaction_3,
            fee_transaction_4,
            fee_transaction_5,
            fee_transaction_6,
            fee_transaction_7,
        ) = fee_transactions

        assert fee_transaction_1.type == TransactionType.processor_fee
        assert fee_transaction_1.processor_fee_type == ProcessorFeeType.payout
        assert fee_transaction_1.amount == -100

        assert fee_transaction_2.type == TransactionType.processor_fee
        assert fee_transaction_2.processor_fee_type == ProcessorFeeType.payout
        assert fee_transaction_2.amount == -200

        assert fee_transaction_3.type == TransactionType.processor_fee
        assert fee_transaction_3.processor_fee_type == ProcessorFeeType.account
        assert fee_transaction_3.amount == -300

        assert fee_transaction_4.type == TransactionType.processor_fee
        assert (
            fee_transaction_4.processor_fee_type
            == ProcessorFeeType.cross_border_transfer
        )
        assert fee_transaction_4.amount == -400

        assert fee_transaction_5.type == TransactionType.processor_fee
        assert fee_transaction_5.processor_fee_type == ProcessorFeeType.subscription
        assert fee_transaction_5.amount == -500

        assert fee_transaction_6.type == TransactionType.processor_fee
        assert fee_transaction_6.processor_fee_type == ProcessorFeeType.tax
        assert fee_transaction_6.amount == -600

        assert fee_transaction_7.type == TransactionType.processor_fee
        assert fee_transaction_7.processor_fee_type == ProcessorFeeType.invoice
        assert fee_transaction_7.amount == -700
