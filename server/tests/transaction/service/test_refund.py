from unittest.mock import AsyncMock, MagicMock

import pytest
from pytest_mock import MockerFixture

from polar.enums import AccountType
from polar.integrations.stripe.service import StripeService
from polar.models import Account, Customer, Product, Transaction, User
from polar.models.transaction import Processor, TransactionType
from polar.postgres import AsyncSession
from polar.refund.service import refund as refund_service
from polar.transaction.service.balance import BalanceTransactionService
from polar.transaction.service.balance import (
    balance_transaction as balance_transaction_service,
)
from polar.transaction.service.processor_fee import ProcessorFeeTransactionService
from polar.transaction.service.refund import (  # type: ignore[attr-defined]
    processor_fee_transaction_service,
)
from polar.transaction.service.refund import (
    refund_transaction as refund_transaction_service,
)
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import create_order
from tests.fixtures.stripe import (
    build_stripe_balance_transaction,
    build_stripe_charge,
    build_stripe_refund,
)
from tests.transaction.conftest import create_transaction


@pytest.fixture(autouse=True)
def stripe_service_mock(mocker: MockerFixture) -> MagicMock:
    mock = MagicMock(spec=StripeService)
    mocker.patch("polar.refund.service.stripe_service", new=mock)
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
        processor_fee_transaction_service,
        "create_refund_fees",
        spec=ProcessorFeeTransactionService.create_refund_fees,
        return_value=[],
    )


@pytest.mark.asyncio
class TestCreateRefunds:
    async def test_valid(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        user: User,
        product: Product,
        customer: Customer,
        stripe_service_mock: MagicMock,
        balance_transaction_service_mock: MagicMock,
        create_refund_fees_mock: AsyncMock,
    ) -> None:
        charge = build_stripe_charge()
        order = await create_order(
            save_fixture,
            product=product,
            customer=customer,
            amount=charge.amount,
        )
        balance_transaction = build_stripe_balance_transaction()
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
        await save_fixture(account)

        payment_transaction = Transaction(
            type=TransactionType.payment,
            processor=Processor.stripe,
            currency=charge.currency,
            amount=charge.amount,
            account_currency=charge.currency,
            account_amount=charge.amount,
            tax_amount=0,
            charge_id=charge.id,
            order=order,
        )
        await save_fixture(payment_transaction)

        outgoing_balance_1 = Transaction(
            type=TransactionType.balance,
            processor=Processor.stripe,
            currency=charge.currency,
            amount=-charge.amount * 0.75,
            account_currency=charge.currency,
            account_amount=-charge.amount * 0.75,
            tax_amount=0,
            order=order,
            payment_transaction=payment_transaction,
            transfer_id="STRIPE_TRANSFER_ID",
            balance_correlation_key="BALANCE_1",
        )
        incoming_balance_1 = Transaction(
            type=TransactionType.balance,
            processor=Processor.stripe,
            account=account,
            currency=charge.currency,
            amount=charge.amount * 0.75,
            account_currency=charge.currency,
            account_amount=charge.amount * 0.75,
            tax_amount=0,
            order=order,
            payment_transaction=payment_transaction,
            transfer_id="STRIPE_TRANSFER_ID",
            balance_correlation_key="BALANCE_1",
        )
        await save_fixture(outgoing_balance_1)
        await save_fixture(incoming_balance_1)

        outgoing_balance_2 = Transaction(
            type=TransactionType.balance,
            processor=Processor.stripe,
            currency=charge.currency,
            amount=-charge.amount * 0.25,
            account_currency=charge.currency,
            account_amount=-charge.amount * 0.25,
            tax_amount=0,
            order=order,
            payment_transaction=payment_transaction,
            transfer_id="STRIPE_TRANSFER_ID",
            balance_correlation_key="BALANCE_2",
        )
        incoming_balance_2 = Transaction(
            type=TransactionType.balance,
            processor=Processor.stripe,
            account=account,
            currency=charge.currency,
            amount=charge.amount * 0.25,
            account_currency=charge.currency,
            account_amount=charge.amount * 0.25,
            tax_amount=0,
            order=order,
            payment_transaction=payment_transaction,
            transfer_id="STRIPE_TRANSFER_ID",
            balance_correlation_key="BALANCE_2",
        )
        await save_fixture(outgoing_balance_2)
        await save_fixture(incoming_balance_2)

        # then
        session.expunge_all()

        charge_id = charge["id"]
        refund_transaction = await refund_transaction_service.get_by(
            session, type=TransactionType.refund, charge_id=charge_id
        )
        assert refund_transaction is None
        pending_refund = refund_service.build_instance_from_stripe(
            build_stripe_refund(
                id="PENDING_REFUND",
                status="pending",
                charge_id=charge.id,
                balance_transaction=balance_transaction.id,
            ),
            order=order,
        )

        pending_refund_transaction = await refund_transaction_service.create(
            session,
            charge_id=charge_id,
            payment_transaction=payment_transaction,
            refund=pending_refund,
        )
        assert pending_refund_transaction is None
        refund_transaction = await refund_transaction_service.get_by(
            session, type=TransactionType.refund, charge_id=charge_id
        )
        assert refund_transaction is None

        failed_refund = refund_service.build_instance_from_stripe(
            build_stripe_refund(
                id="FAILED_REFUND",
                status="failed",
                charge_id=charge.id,
                balance_transaction=balance_transaction.id,
            ),
            order=order,
        )

        failed_refund_transaction = await refund_transaction_service.create(
            session,
            charge_id=charge_id,
            payment_transaction=payment_transaction,
            refund=failed_refund,
        )
        assert failed_refund_transaction is None
        refund_transaction = await refund_transaction_service.get_by(
            session, type=TransactionType.refund, charge_id=charge_id
        )
        assert refund_transaction is None

        new_refund = refund_service.build_instance_from_stripe(
            build_stripe_refund(
                id="NEW_REFUND",
                charge_id=charge.id,
                balance_transaction=balance_transaction.id,
            ),
            order=order,
        )

        new_refund_transaction = await refund_transaction_service.create(
            session,
            charge_id=charge_id,
            payment_transaction=payment_transaction,
            refund=new_refund,
        )
        assert new_refund_transaction
        assert new_refund_transaction.id

        existing_refund = refund_service.build_instance_from_stripe(
            build_stripe_refund(
                id="NEW_REFUND",
                charge_id=charge.id,
                balance_transaction=balance_transaction.id,
            ),
            order=order,
        )

        existing_refund_transaction = await refund_transaction_service.create(
            session,
            charge_id=charge_id,
            payment_transaction=payment_transaction,
            refund=existing_refund,
        )
        assert existing_refund_transaction is None

        charge_id = charge["id"]
        # By using `get_by` we ensure multiple records would raise too via `one_or_none()`
        refund_transaction = await refund_transaction_service.get_by(
            session, type=TransactionType.refund, charge_id=charge_id
        )
        assert refund_transaction
        assert refund_transaction.type == TransactionType.refund
        assert refund_transaction.processor == Processor.stripe
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


@pytest.mark.asyncio
class TestCreateReversalBalancesForPayment:
    async def test_valid(
        self, save_fixture: SaveFixture, session: AsyncSession, account: Account
    ) -> None:
        payment_transaction = await create_transaction(
            save_fixture, type=TransactionType.payment, charge_id="STRIPE_CHARGE_ID"
        )
        await balance_transaction_service.create_balance(
            session,
            source_account=None,
            amount=payment_transaction.amount,
            destination_account=account,
            payment_transaction=payment_transaction,
        )
        await create_transaction(
            save_fixture,
            type=TransactionType.refund,
            amount=-payment_transaction.amount,
            payment_transaction=payment_transaction,
            charge_id="STRIPE_CHARGE_ID",
        )

        reversal_balances = (
            await refund_transaction_service.create_reversal_balances_for_payment(
                session, payment_transaction=payment_transaction
            )
        )

        assert len(reversal_balances) == 1
