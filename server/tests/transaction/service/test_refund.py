from unittest.mock import MagicMock

import pytest
import stripe as stripe_lib
from pytest_mock import MockerFixture

from polar.enums import AccountType
from polar.integrations.stripe.service import StripeService
from polar.models import Account, Organization, Pledge, Transaction, User
from polar.models.transaction import PaymentProcessor, TransactionType
from polar.postgres import AsyncSession
from polar.transaction.service.refund import RefundUnknownPaymentTransaction
from polar.transaction.service.refund import (
    refund_transaction as refund_transaction_service,
)
from polar.transaction.service.transfer import TransferTransactionService


def build_stripe_balance_transaction(
    *, fee: int | None = 100
) -> stripe_lib.BalanceTransaction:
    return stripe_lib.BalanceTransaction.construct_from(
        {"id": "STRIPE_BALANCE_TRANSACTION_ID", "fee": fee}, None
    )


def build_stripe_charge(
    *,
    amount: int = 1000,
    customer: str | None = None,
    invoice: str | None = None,
    payment_intent: str | None = None,
    balance_transaction: str | None = None,
) -> stripe_lib.Charge:
    return stripe_lib.Charge.construct_from(
        {
            "id": "STRIPE_CHARGE_ID",
            "customer": customer,
            "currency": "usd",
            "amount": amount,
            "invoice": invoice,
            "payment_intent": payment_intent,
            "balance_transaction": balance_transaction,
        },
        None,
    )


def build_stripe_refund(
    *,
    id: str = "STRIPE_REFUND_ID",
    status: str = "succeeded",
    amount: int = 100,
    balance_transaction: str | None = None,
) -> stripe_lib.Refund:
    return stripe_lib.Refund.construct_from(
        {
            "id": id,
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
    mocker.patch("polar.transaction.service.refund.stripe_service", new=mock)
    return mock


@pytest.fixture(autouse=True)
def transfer_transaction_service_mock(mocker: MockerFixture) -> MagicMock:
    mock = MagicMock(spec=TransferTransactionService)
    mocker.patch(
        "polar.transaction.service.refund.transfer_transaction_service", new=mock
    )
    return mock


@pytest.mark.asyncio
class TestCreateRefunds:
    async def test_refund_unknown_payment_transaction(
        self, session: AsyncSession
    ) -> None:
        charge = build_stripe_charge()

        with pytest.raises(RefundUnknownPaymentTransaction):
            await refund_transaction_service.create_refunds(session, charge=charge)

    async def test_valid(
        self,
        session: AsyncSession,
        organization: Organization,
        user: User,
        pledge: Pledge,
        stripe_service_mock: MagicMock,
        transfer_transaction_service_mock: MagicMock,
    ) -> None:
        charge = build_stripe_charge()
        balance_transaction = build_stripe_balance_transaction()
        new_refund = build_stripe_refund(
            id="NEW_REFUND", balance_transaction=balance_transaction.id
        )
        handled_refund = build_stripe_refund(
            id="HANDLED_REFUND", balance_transaction=balance_transaction.id
        )
        failed_refund = build_stripe_refund(
            id="FAILED_REFUND",
            status="failed",
            balance_transaction=balance_transaction.id,
        )

        stripe_service_mock.list_refunds.return_value = [
            new_refund,
            handled_refund,
            failed_refund,
        ]
        stripe_service_mock.get_balance_transaction.return_value = balance_transaction

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

        payment_transaction = Transaction(
            type=TransactionType.payment,
            processor=PaymentProcessor.stripe,
            currency=charge.currency,
            amount=charge.amount,
            tax_amount=0,
            processor_fee_amount=0,
            charge_id=charge.id,
            pledge=pledge,
        )
        session.add(payment_transaction)

        outgoing_transfer = Transaction(
            type=TransactionType.transfer,
            processor=PaymentProcessor.stripe,
            currency=charge.currency,
            amount=-charge.amount,
            tax_amount=0,
            processor_fee_amount=0,
            pledge=pledge,
            transfer_id="STRIPE_TRANSFER_ID",
        )
        incoming_transfer = Transaction(
            type=TransactionType.transfer,
            processor=PaymentProcessor.stripe,
            account=account,
            currency=charge.currency,
            amount=charge.amount,
            tax_amount=0,
            processor_fee_amount=0,
            pledge=pledge,
            transfer_id="STRIPE_TRANSFER_ID",
        )
        session.add(outgoing_transfer)
        session.add(incoming_transfer)

        handled_refund_transaction = Transaction(
            type=TransactionType.refund,
            processor=PaymentProcessor.stripe,
            currency=handled_refund.currency,
            amount=-handled_refund.amount,
            tax_amount=0,
            processor_fee_amount=0,
            refund_id=handled_refund.id,
        )
        session.add(handled_refund_transaction)

        await session.commit()

        refund_transactions = await refund_transaction_service.create_refunds(
            session, charge=charge
        )

        assert len(refund_transactions) == 1
        refund_transaction = refund_transactions[0]

        assert refund_transaction.type == TransactionType.refund
        assert refund_transaction.processor == PaymentProcessor.stripe
        assert refund_transaction.amount == -new_refund.amount

        transfer_transaction_service_mock.create_reversal_transfer.assert_called_once()
        assert transfer_transaction_service_mock.create_reversal_transfer.call_args[1][
            "transfer_transactions"
        ] == (outgoing_transfer, incoming_transfer)
        assert (
            transfer_transaction_service_mock.create_reversal_transfer.call_args[1][
                "amount"
            ]
            == new_refund.amount
        )
