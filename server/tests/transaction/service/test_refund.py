from unittest.mock import AsyncMock, MagicMock

import pytest
import stripe as stripe_lib
from pytest_mock import MockerFixture

from polar.enums import AccountType
from polar.integrations.stripe.service import StripeService
from polar.models import Account, Pledge, Transaction, User
from polar.models.transaction import PaymentProcessor, TransactionType
from polar.postgres import AsyncSession
from polar.transaction.service.balance import BalanceTransactionService
from polar.transaction.service.fee import FeeTransactionService
from polar.transaction.service.refund import (  # type: ignore[attr-defined]
    RefundUnknownPaymentTransaction,
    fee_transaction_service,
)
from polar.transaction.service.refund import (
    refund_transaction as refund_transaction_service,
)


def build_stripe_balance_transaction(
    *,
    fee: int | None = 100,
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
def balance_transaction_service_mock(mocker: MockerFixture) -> MagicMock:
    mock = MagicMock(spec=BalanceTransactionService)
    mocker.patch(
        "polar.transaction.service.refund.balance_transaction_service", new=mock
    )
    return mock


@pytest.fixture(autouse=True)
def create_refund_fees_mock(mocker: MockerFixture) -> AsyncMock:
    return mocker.patch.object(
        fee_transaction_service,
        "create_refund_fees",
        spec=FeeTransactionService.create_refund_fees,
        return_value=[],
    )


@pytest.mark.asyncio
class TestCreateRefunds:
    async def test_refund_unknown_payment_transaction(
        self, session: AsyncSession
    ) -> None:
        charge = build_stripe_charge()

        # then
        session.expunge_all()

        with pytest.raises(RefundUnknownPaymentTransaction):
            await refund_transaction_service.create_refunds(session, charge=charge)

    async def test_valid(
        self,
        session: AsyncSession,
        user: User,
        pledge: Pledge,
        stripe_service_mock: MagicMock,
        balance_transaction_service_mock: MagicMock,
        create_refund_fees_mock: AsyncMock,
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
            account_currency=charge.currency,
            account_amount=charge.amount,
            tax_amount=0,
            charge_id=charge.id,
            pledge=pledge,
        )
        session.add(payment_transaction)

        outgoing_balance_1 = Transaction(
            type=TransactionType.balance,
            processor=PaymentProcessor.stripe,
            currency=charge.currency,
            amount=-charge.amount * 0.75,
            account_currency=charge.currency,
            account_amount=-charge.amount * 0.75,
            tax_amount=0,
            pledge=pledge,
            payment_transaction=payment_transaction,
            transfer_id="STRIPE_TRANSFER_ID",
            balance_correlation_key="BALANCE_1",
        )
        incoming_balance_1 = Transaction(
            type=TransactionType.balance,
            processor=PaymentProcessor.stripe,
            account=account,
            currency=charge.currency,
            amount=charge.amount * 0.75,
            account_currency=charge.currency,
            account_amount=charge.amount * 0.75,
            tax_amount=0,
            pledge=pledge,
            payment_transaction=payment_transaction,
            transfer_id="STRIPE_TRANSFER_ID",
            balance_correlation_key="BALANCE_1",
        )
        session.add(outgoing_balance_1)
        session.add(incoming_balance_1)

        outgoing_balance_2 = Transaction(
            type=TransactionType.balance,
            processor=PaymentProcessor.stripe,
            currency=charge.currency,
            amount=-charge.amount * 0.25,
            account_currency=charge.currency,
            account_amount=-charge.amount * 0.25,
            tax_amount=0,
            pledge=pledge,
            payment_transaction=payment_transaction,
            transfer_id="STRIPE_TRANSFER_ID",
            balance_correlation_key="BALANCE_2",
        )
        incoming_balance_2 = Transaction(
            type=TransactionType.balance,
            processor=PaymentProcessor.stripe,
            account=account,
            currency=charge.currency,
            amount=charge.amount * 0.25,
            account_currency=charge.currency,
            account_amount=charge.amount * 0.25,
            tax_amount=0,
            pledge=pledge,
            payment_transaction=payment_transaction,
            transfer_id="STRIPE_TRANSFER_ID",
            balance_correlation_key="BALANCE_2",
        )
        session.add(outgoing_balance_2)
        session.add(incoming_balance_2)

        handled_refund_transaction = Transaction(
            type=TransactionType.refund,
            processor=PaymentProcessor.stripe,
            currency=handled_refund.currency,
            amount=-handled_refund.amount,
            account_currency=handled_refund.currency,
            account_amount=-handled_refund.amount,
            tax_amount=0,
            refund_id=handled_refund.id,
        )
        session.add(handled_refund_transaction)

        await session.commit()

        # then
        session.expunge_all()

        refund_transactions = await refund_transaction_service.create_refunds(
            session, charge=charge
        )

        assert len(refund_transactions) == 1
        refund_transaction = refund_transactions[0]

        assert refund_transaction.type == TransactionType.refund
        assert refund_transaction.processor == PaymentProcessor.stripe
        assert refund_transaction.amount == -new_refund.amount

        assert balance_transaction_service_mock.create_reversal_balance.call_count == 2

        first_call = (
            balance_transaction_service_mock.create_reversal_balance.call_args_list[0]
        )
        assert [t.id for t in first_call[1]["balance_transactions"]] == [
            outgoing_balance_1.id,
            incoming_balance_1.id,
        ]
        assert first_call[1]["amount"] == new_refund.amount * 0.75

        second_call = (
            balance_transaction_service_mock.create_reversal_balance.call_args_list[1]
        )
        assert [t.id for t in second_call[1]["balance_transactions"]] == [
            outgoing_balance_2.id,
            incoming_balance_2.id,
        ]
        assert second_call[1]["amount"] == new_refund.amount * 0.25

        create_refund_fees_mock.assert_awaited_once()
