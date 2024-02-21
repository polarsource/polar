from unittest.mock import AsyncMock, MagicMock

import pytest
import stripe as stripe_lib
from pytest_mock import MockerFixture

from polar.enums import AccountType
from polar.models import Account, Pledge, Transaction, User
from polar.models.transaction import PaymentProcessor, TransactionType
from polar.postgres import AsyncSession
from polar.transaction.service.balance import BalanceTransactionService
from polar.transaction.service.dispute import (  # type: ignore[attr-defined]
    DisputeUnknownPaymentTransaction,
    fee_transaction_service,
)
from polar.transaction.service.dispute import (
    dispute_transaction as dispute_transaction_service,
)
from polar.transaction.service.fee import FeeTransactionService


def build_stripe_balance_transaction(
    *, reporting_category: str, fee: int | None = 100
) -> stripe_lib.BalanceTransaction:
    return stripe_lib.BalanceTransaction.construct_from(
        {
            "id": "STRIPE_BALANCE_TRANSACTION_ID",
            "reporting_category": reporting_category,
            "fee": fee,
        },
        None,
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


def build_stripe_dispute(
    *,
    id: str = "STRIPE_DISPUTE_ID",
    charge_id: str = "STRIPE_CHARGE_ID",
    amount: int = 100,
    balance_transactions: list[stripe_lib.BalanceTransaction],
) -> stripe_lib.Dispute:
    return stripe_lib.Dispute.construct_from(
        {
            "id": id,
            "charge": charge_id,
            "currency": "usd",
            "amount": amount,
            "balance_transactions": balance_transactions,
        },
        None,
    )


@pytest.fixture(autouse=True)
def balance_transaction_service_mock(mocker: MockerFixture) -> MagicMock:
    mock = MagicMock(spec=BalanceTransactionService)
    mocker.patch(
        "polar.transaction.service.dispute.balance_transaction_service", new=mock
    )
    return mock


@pytest.fixture(autouse=True)
def create_dispute_fees_mock(mocker: MockerFixture) -> AsyncMock:
    return mocker.patch.object(
        fee_transaction_service,
        "create_dispute_fees",
        spec=FeeTransactionService.create_dispute_fees,
        return_value=[],
    )


@pytest.mark.asyncio
class TestCreateDispute:
    async def test_refund_unknown_payment_transaction(
        self, session: AsyncSession
    ) -> None:
        dispute = build_stripe_dispute(balance_transactions=[])

        # then
        session.expunge_all()

        with pytest.raises(DisputeUnknownPaymentTransaction):
            await dispute_transaction_service.create_dispute(session, dispute=dispute)

    async def test_valid(
        self,
        session: AsyncSession,
        user: User,
        pledge: Pledge,
        balance_transaction_service_mock: MagicMock,
        create_dispute_fees_mock: AsyncMock,
    ) -> None:
        charge = build_stripe_charge()
        dispute = build_stripe_dispute(
            charge_id=charge.id,
            balance_transactions=[
                build_stripe_balance_transaction(reporting_category="dispute")
            ],
        )

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

        await session.commit()

        # then
        session.expunge_all()

        dispute_transaction = await dispute_transaction_service.create_dispute(
            session, dispute=dispute
        )

        assert dispute_transaction.type == TransactionType.dispute
        assert dispute_transaction.processor == PaymentProcessor.stripe
        assert dispute_transaction.amount == -dispute.amount

        assert balance_transaction_service_mock.create_reversal_balance.call_count == 2

        first_call = (
            balance_transaction_service_mock.create_reversal_balance.call_args_list[0]
        )
        assert [t.id for t in first_call[1]["balance_transactions"]] == [
            outgoing_balance_1.id,
            incoming_balance_1.id,
        ]
        assert first_call[1]["amount"] == dispute.amount * 0.75

        second_call = (
            balance_transaction_service_mock.create_reversal_balance.call_args_list[1]
        )
        assert [t.id for t in second_call[1]["balance_transactions"]] == [
            outgoing_balance_2.id,
            incoming_balance_2.id,
        ]
        assert second_call[1]["amount"] == dispute.amount * 0.25

        create_dispute_fees_mock.assert_awaited_once()


@pytest.mark.asyncio
class TestCreateDisputeReversal:
    async def test_refund_unknown_payment_transaction(
        self, session: AsyncSession
    ) -> None:
        dispute = build_stripe_dispute(balance_transactions=[])

        # then
        session.expunge_all()

        with pytest.raises(DisputeUnknownPaymentTransaction):
            await dispute_transaction_service.create_dispute_reversal(
                session, dispute=dispute
            )

    async def test_valid(
        self,
        session: AsyncSession,
        user: User,
        pledge: Pledge,
        balance_transaction_service_mock: MagicMock,
        create_dispute_fees_mock: AsyncMock,
    ) -> None:
        charge = build_stripe_charge()
        dispute = build_stripe_dispute(
            charge_id=charge.id,
            balance_transactions=[
                build_stripe_balance_transaction(
                    reporting_category="dispute", fee=1500
                ),
                build_stripe_balance_transaction(
                    reporting_category="dispute_reversal", fee=0
                ),
            ],
        )

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

        dispute_transaction = Transaction(
            type=TransactionType.dispute,
            processor=PaymentProcessor.stripe,
            currency=charge.currency,
            amount=-charge.amount,
            account_currency=charge.currency,
            account_amount=-charge.amount,
            tax_amount=0,
            charge_id=charge.id,
            pledge=pledge,
        )
        session.add(dispute_transaction)

        # First balance
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

        # First balance reversal
        outgoing_reversal_balance_1 = Transaction(
            type=TransactionType.balance,
            processor=PaymentProcessor.stripe,
            account=account,
            currency=charge.currency,
            amount=-charge.amount * 0.75,
            account_currency=charge.currency,
            account_amount=-charge.amount * 0.75,
            tax_amount=0,
            pledge=pledge,
            transfer_id="STRIPE_TRANSFER_ID",
            balance_correlation_key="BALANCE_REVERSAL_1",
            balance_reversal_transaction=incoming_balance_1,
        )
        incoming_reversal_balance_1 = Transaction(
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
            balance_correlation_key="BALANCE_REVERSAL_1",
            balance_reversal_transaction=outgoing_balance_1,
        )
        session.add(outgoing_reversal_balance_1)
        session.add(incoming_reversal_balance_1)

        # Second balance
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

        # Second balance reversal
        outgoing_reversal_balance_2 = Transaction(
            type=TransactionType.balance,
            processor=PaymentProcessor.stripe,
            account=account,
            currency=charge.currency,
            amount=-charge.amount * 0.25,
            account_currency=charge.currency,
            account_amount=-charge.amount * 0.25,
            tax_amount=0,
            pledge=pledge,
            transfer_id="STRIPE_TRANSFER_ID",
            balance_correlation_key="BALANCE_REVERSAL_2",
            balance_reversal_transaction=incoming_balance_2,
        )
        incoming_reversal_balance_2 = Transaction(
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
            balance_correlation_key="BALANCE_REVERSAL_2",
            balance_reversal_transaction=outgoing_balance_2,
        )
        session.add(outgoing_reversal_balance_2)
        session.add(incoming_reversal_balance_2)

        await session.commit()

        # then
        session.expunge_all()

        dispute_transaction = await dispute_transaction_service.create_dispute_reversal(
            session, dispute=dispute
        )

        assert dispute_transaction.type == TransactionType.dispute
        assert dispute_transaction.processor == PaymentProcessor.stripe
        assert dispute_transaction.amount == dispute.amount

        assert balance_transaction_service_mock.create_balance.call_count == 2

        first_call = balance_transaction_service_mock.create_balance.call_args_list[0]
        assert first_call[1]["destination_account"].id == account.id
        assert first_call[1]["amount"] == incoming_balance_1.amount

        second_call = balance_transaction_service_mock.create_balance.call_args_list[1]
        assert second_call[1]["destination_account"].id == account.id
        assert second_call[1]["amount"] == incoming_balance_2.amount

        create_dispute_fees_mock.assert_awaited_once()
