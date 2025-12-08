import datetime
from typing import Literal
from unittest.mock import MagicMock

import pytest
import pytest_asyncio
import stripe as stripe_lib
from pytest_mock import MockerFixture

from polar.integrations.stripe.service import StripeService
from polar.models import Customer, Order, Organization, Payment, Product, Transaction
from polar.models.transaction import Processor, ProcessorFeeType, TransactionType
from polar.postgres import AsyncSession
from polar.transaction.service.processor_fee import (
    BalanceTransactionNotFound,
)
from polar.transaction.service.processor_fee import (
    processor_fee_transaction as processor_fee_transaction_service,
)
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import (
    create_dispute,
    create_dispute_transaction,
    create_order,
    create_payment,
    create_payment_transaction,
    create_refund,
    create_refund_transaction,
)
from tests.transaction.conftest import create_async_iterator


@pytest.fixture(autouse=True)
def stripe_service_mock(mocker: MockerFixture) -> MagicMock:
    mock = MagicMock(spec=StripeService)
    mocker.patch("polar.transaction.service.processor_fee.stripe_service", new=mock)
    return mock


@pytest_asyncio.fixture
async def order(save_fixture: SaveFixture, customer: Customer) -> Order:
    return await create_order(save_fixture, customer=customer)


@pytest_asyncio.fixture
async def payment(
    save_fixture: SaveFixture, order: Order, organization: Organization
) -> Payment:
    return await create_payment(save_fixture, organization, order=order)


@pytest.mark.asyncio
class TestCreatePaymentFees:
    async def test_not_stripe(
        self, session: AsyncSession, save_fixture: SaveFixture
    ) -> None:
        payment_transaction = await create_payment_transaction(
            save_fixture, processor=Processor.open_collective
        )

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

        fee_transactions = await processor_fee_transaction_service.create_payment_fees(
            session, payment_transaction=payment_transaction
        )
        assert len(fee_transactions) == 0

    async def test_stripe_no_balance_transaction(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        stripe_service_mock: MagicMock,
    ) -> None:
        payment_transaction = await create_payment_transaction(save_fixture)

        stripe_service_mock.get_charge.return_value = stripe_lib.Charge.construct_from(
            {
                "id": "STRIPE_CHARGE_ID",
                "balance_transaction": None,
                "invoice": "STRIPE_INVOICE_ID",
            },
            None,
        )

        with pytest.raises(BalanceTransactionNotFound):
            await processor_fee_transaction_service.create_payment_fees(
                session, payment_transaction=payment_transaction
            )

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

        fee_transactions = await processor_fee_transaction_service.create_payment_fees(
            session, payment_transaction=payment_transaction
        )
        assert len(fee_transactions) == 1

        payment_fee_transaction = fee_transactions[0]

        assert payment_fee_transaction.type == TransactionType.processor_fee
        assert payment_fee_transaction.processor == Processor.stripe
        assert payment_fee_transaction.processor_fee_type == ProcessorFeeType.payment
        assert payment_fee_transaction.amount == -100
        assert payment_fee_transaction.incurred_by_transaction == payment_transaction


@pytest.mark.asyncio
class TestCreateRefundFees:
    async def test_not_stripe(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        customer: Customer,
        product: Product,
    ) -> None:
        order = await create_order(
            save_fixture,
            product=product,
            customer=customer,
        )
        payment = await create_payment(save_fixture, customer.organization, order=order)
        refund = await create_refund(save_fixture, order, payment)
        refund_transaction = await create_refund_transaction(
            save_fixture, processor=Processor.open_collective
        )

        # then
        session.expunge_all()

        fee_transactions = await processor_fee_transaction_service.create_refund_fees(
            session, refund=refund, refund_transaction=refund_transaction
        )
        assert len(fee_transactions) == 0

    async def test_stripe_refund(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        stripe_service_mock: MagicMock,
        customer: Customer,
        product: Product,
    ) -> None:
        order = await create_order(
            save_fixture,
            product=product,
            customer=customer,
        )
        payment = await create_payment(save_fixture, customer.organization, order=order)
        refund = await create_refund(save_fixture, order, payment)
        refund_transaction = await create_refund_transaction(save_fixture)
        stripe_service_mock.get_balance_transaction.return_value = (
            stripe_lib.BalanceTransaction.construct_from(
                {"id": "STRIPE_BALANCE_TRANSACTION_ID", "fee": 100}, None
            )
        )

        # then
        session.expunge_all()

        fee_transactions = await processor_fee_transaction_service.create_refund_fees(
            session, refund=refund, refund_transaction=refund_transaction
        )
        assert len(fee_transactions) == 1

        refund_fee_transaction = fee_transactions[0]

        assert refund_fee_transaction.type == TransactionType.processor_fee
        assert refund_fee_transaction.processor == Processor.stripe
        assert refund_fee_transaction.processor_fee_type == ProcessorFeeType.refund
        assert refund_fee_transaction.amount == -100
        assert (
            refund_fee_transaction.incurred_by_transaction_id == refund_transaction.id
        )


@pytest.mark.asyncio
class TestCreateDisputeFees:
    async def test_stripe_no_processor_id(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        order: Order,
        payment: Payment,
    ) -> None:
        dispute = await create_dispute(
            save_fixture, order, payment, payment_processor_id=None
        )
        dispute_transaction = await create_dispute_transaction(save_fixture, dispute)

        fee_transactions = await processor_fee_transaction_service.create_dispute_fees(
            session,
            dispute=dispute,
            dispute_transaction=dispute_transaction,
            category="dispute",
        )
        assert len(fee_transactions) == 0

    @pytest.mark.parametrize("category", ["dispute", "dispute_reversal"])
    async def test_stripe_dispute(
        self,
        category: Literal["dispute", "dispute_reversal"],
        session: AsyncSession,
        save_fixture: SaveFixture,
        stripe_service_mock: MagicMock,
        order: Order,
        payment: Payment,
    ) -> None:
        dispute = await create_dispute(save_fixture, order, payment)
        dispute_transaction = await create_dispute_transaction(save_fixture, dispute)

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

        fee_transactions = await processor_fee_transaction_service.create_dispute_fees(
            session,
            dispute=dispute,
            dispute_transaction=dispute_transaction,
            category=category,
        )
        assert len(fee_transactions) == 1

        dispute_fee_transaction = fee_transactions[0]

        assert dispute_fee_transaction.type == TransactionType.processor_fee
        assert dispute_fee_transaction.processor == Processor.stripe
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
                    "description": "Billing - Usage Fee (2024-07-11)",
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
                    "description": "Tax Api Calculation (2024-10-09)",
                },
                None,
            ),
            stripe_lib.BalanceTransaction.construct_from(
                {
                    "created": now_timestamp,
                    "id": "STRIPE_BALANCE_TRANSACTION_ID_8",
                    "net": -800,
                    "currency": "usd",
                    "description": "Invoicing (2024-01-03): Invoicing Plus",
                },
                None,
            ),
            stripe_lib.BalanceTransaction.construct_from(
                {
                    "created": now_timestamp,
                    "id": "STRIPE_BALANCE_TRANSACTION_ID_9",
                    "net": -900,
                    "currency": "usd",
                    "description": "Post Payment Invoices (2024-06-05)",
                },
                None,
            ),
            stripe_lib.BalanceTransaction.construct_from(
                {
                    "created": now_timestamp,
                    "id": "STRIPE_BALANCE_TRANSACTION_ID_10",
                    "net": -150,
                    "currency": "usd",
                    "description": "Connections Verification (2024-08-01 - 2024-08-31)",
                },
                None,
            ),
            stripe_lib.BalanceTransaction.construct_from(
                {
                    "created": now_timestamp,
                    "id": "STRIPE_BALANCE_TRANSACTION_ID_11",
                    "net": -100,
                    "currency": "usd",
                    "description": "Radar (2024-10-28): Radar for Fraud Teams",
                },
                None,
            ),
            stripe_lib.BalanceTransaction.construct_from(
                {
                    "created": now_timestamp,
                    "id": "STRIPE_BALANCE_TRANSACTION_ID_12",
                    "net": -100,
                    "currency": "usd",
                    "description": "3D Secure (2024-12-31): Lookup",
                },
                None,
            ),
            stripe_lib.BalanceTransaction.construct_from(
                {
                    "created": now_timestamp,
                    "id": "STRIPE_BALANCE_TRANSACTION_ID_13",
                    "net": -100,
                    "currency": "usd",
                    "description": "Connect (2024-01-01 - 2024-01-31): Payout Fee",
                },
                None,
            ),
            stripe_lib.BalanceTransaction.construct_from(
                {
                    "created": now_timestamp,
                    "id": "STRIPE_BALANCE_TRANSACTION_ID_14",
                    "net": -200,
                    "currency": "usd",
                    "description": "Connect (2024-01-01 - 2024-01-31): Account Volume Billing",
                },
                None,
            ),
        ]

        stripe_service_mock.list_balance_transactions.return_value = (
            create_async_iterator(balance_transactions)
        )

        fee_transaction_13 = Transaction(
            type=TransactionType.processor_fee,
            processor=Processor.stripe,
            processor_fee_type=ProcessorFeeType.payout,
            currency="usd",
            amount=-200,
            account_currency="usd",
            account_amount=-200,
            tax_amount=0,
            fee_balance_transaction_id="STRIPE_BALANCE_TRANSACTION_ID_13",
        )
        fee_transaction_14 = Transaction(
            type=TransactionType.processor_fee,
            processor=Processor.stripe,
            processor_fee_type=ProcessorFeeType.payout,
            currency="usd",
            amount=-100,
            account_currency="usd",
            account_amount=-100,
            tax_amount=0,
            fee_balance_transaction_id="STRIPE_BALANCE_TRANSACTION_ID_14",
        )
        await save_fixture(fee_transaction_13)
        await save_fixture(fee_transaction_14)

        # then
        session.expunge_all()

        fee_transactions = await processor_fee_transaction_service.sync_stripe_fees(
            session
        )

        assert len(fee_transactions) == 12

        (
            fee_transaction_1,
            fee_transaction_2,
            fee_transaction_3,
            fee_transaction_4,
            fee_transaction_5,
            fee_transaction_6,
            fee_transaction_7,
            fee_transaction_8,
            fee_transaction_9,
            fee_transaction_10,
            fee_transaction_11,
            fee_transaction_12,
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
        assert fee_transaction_7.processor_fee_type == ProcessorFeeType.tax
        assert fee_transaction_7.amount == -700

        assert fee_transaction_8.type == TransactionType.processor_fee
        assert fee_transaction_8.processor_fee_type == ProcessorFeeType.invoice
        assert fee_transaction_8.amount == -800

        assert fee_transaction_9.type == TransactionType.processor_fee
        assert fee_transaction_9.processor_fee_type == ProcessorFeeType.invoice
        assert fee_transaction_9.amount == -900

        assert fee_transaction_10.type == TransactionType.processor_fee
        assert fee_transaction_10.processor_fee_type == ProcessorFeeType.payment
        assert fee_transaction_10.amount == -150

        assert fee_transaction_11.type == TransactionType.processor_fee
        assert fee_transaction_11.processor_fee_type == ProcessorFeeType.security
        assert fee_transaction_11.amount == -100

        assert fee_transaction_12.type == TransactionType.processor_fee
        assert fee_transaction_12.processor_fee_type == ProcessorFeeType.payment
        assert fee_transaction_12.amount == -100
