from unittest.mock import AsyncMock, MagicMock

import pytest
from pytest_mock import MockerFixture
from sqlalchemy.orm import joinedload

from polar.enums import AccountType
from polar.integrations.stripe.service import StripeService
from polar.models import (
    Account,
    Customer,
    Order,
    Payment,
    Product,
    Refund,
    Transaction,
    User,
)
from polar.models.refund import RefundStatus
from polar.models.transaction import Processor, TransactionType
from polar.postgres import AsyncSession
from polar.transaction.repository import BalanceTransactionRepository
from polar.transaction.service.balance import BalanceTransactionService
from polar.transaction.service.balance import (
    balance_transaction as balance_transaction_service,
)
from polar.transaction.service.processor_fee import ProcessorFeeTransactionService
from polar.transaction.service.refund import (  # type: ignore[attr-defined]
    NotCanceledRefundError,
    NotSucceededRefundError,
    RefundTransactionAlreadyExistsError,
    RefundTransactionDoesNotExistError,
    processor_fee_transaction_service,
)
from polar.transaction.service.refund import (
    refund_transaction as refund_transaction_service,
)
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import create_order, create_payment, create_refund
from tests.fixtures.stripe import (
    build_stripe_balance_transaction,
    build_stripe_charge,
)
from tests.transaction.conftest import create_transaction


@pytest.fixture(autouse=True)
def stripe_service_mock(mocker: MockerFixture) -> MagicMock:
    mock = MagicMock(spec=StripeService)
    mocker.patch("polar.refund.service.stripe_service", new=mock)
    mocker.patch("polar.transaction.service.refund.stripe_service", new=mock)
    return mock


@pytest.fixture
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


async def create_order_and_refund(
    save_fixture: SaveFixture,
    customer: Customer,
    *,
    processor_id: str = "STRIPE_CHARGE_ID",
    status: RefundStatus = RefundStatus.succeeded,
    subtotal_amount: int = 1000,
    tax_amount: int = 0,
    currency: str = "usd",
    refund_subtotal_amount: int | None = None,
    refund_tax_amount: int | None = None,
) -> tuple[Refund, Order, Payment]:
    order = await create_order(
        save_fixture,
        customer=customer,
        subtotal_amount=subtotal_amount,
        tax_amount=tax_amount,
        currency=currency,
    )
    payment = await create_payment(
        save_fixture,
        customer.organization,
        amount=subtotal_amount + tax_amount,
        currency=currency,
        order=order,
        processor_id=processor_id,
    )
    refund = await create_refund(
        save_fixture,
        order,
        payment,
        status=status,
        amount=subtotal_amount
        if refund_subtotal_amount is None
        else refund_subtotal_amount,
        tax_amount=tax_amount if refund_tax_amount is None else refund_tax_amount,
        currency=currency,
    )
    return refund, order, payment


@pytest.mark.asyncio
class TestCreate:
    @pytest.mark.parametrize("status", [RefundStatus.pending, RefundStatus.failed])
    async def test_not_succeeded_refund(
        self,
        status: RefundStatus,
        save_fixture: SaveFixture,
        session: AsyncSession,
        customer: Customer,
    ) -> None:
        refund, _, _ = await create_order_and_refund(
            save_fixture, customer, status=status
        )

        with pytest.raises(NotSucceededRefundError):
            await refund_transaction_service.create(session, refund)

    async def test_existing_transaction(
        self, save_fixture: SaveFixture, session: AsyncSession, customer: Customer
    ) -> None:
        refund, _, _ = await create_order_and_refund(save_fixture, customer)
        await create_transaction(
            save_fixture, type=TransactionType.refund, refund=refund
        )

        with pytest.raises(RefundTransactionAlreadyExistsError):
            await refund_transaction_service.create(session, refund)

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
        refund, order, _ = await create_order_and_refund(
            save_fixture, customer, subtotal_amount=charge.amount
        )
        balance_transaction = build_stripe_balance_transaction(amount=-charge.amount)
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

        refund_transaction = await refund_transaction_service.create(session, refund)

        assert refund_transaction.type == TransactionType.refund
        assert refund_transaction.processor == Processor.stripe
        assert refund_transaction.amount == -refund.amount

        assert balance_transaction_service_mock.create_reversal_balance.call_count == 2

        first_call = (
            balance_transaction_service_mock.create_reversal_balance.call_args_list[0]
        )
        assert [t.id for t in first_call[1]["balance_transactions"]] == [
            outgoing_balance_1.id,
            incoming_balance_1.id,
        ]
        assert first_call[1]["amount"] == refund.amount * 0.75

        second_call = (
            balance_transaction_service_mock.create_reversal_balance.call_args_list[1]
        )
        assert [t.id for t in second_call[1]["balance_transactions"]] == [
            outgoing_balance_2.id,
            incoming_balance_2.id,
        ]
        assert second_call[1]["amount"] == refund.amount * 0.25

        create_refund_fees_mock.assert_awaited_once()

    async def test_valid_different_settlement_currency(
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
        charge = build_stripe_charge(amount=1200, currency="eur")
        refund, order, _ = await create_order_and_refund(
            save_fixture,
            customer,
            subtotal_amount=1000,
            tax_amount=200,
            currency="eur",
        )

        account = Account(
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

        payment_transaction = Transaction(
            type=TransactionType.payment,
            processor=Processor.stripe,
            currency="usd",
            amount=1000 * 1.5,
            tax_amount=200 * 1.5,
            account_currency="usd",
            account_amount=1000 * 1.5,
            presentment_currency="eur",
            presentment_amount=1000,
            presentment_tax_amount=200,
            charge_id=charge.id,
            order=order,
        )
        await save_fixture(payment_transaction)

        outgoing_balance_1 = Transaction(
            type=TransactionType.balance,
            processor=Processor.stripe,
            currency="usd",
            amount=-payment_transaction.amount * 0.75,
            account_currency="usd",
            account_amount=-payment_transaction.amount * 0.75,
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
            currency="usd",
            amount=payment_transaction.amount * 0.75,
            account_currency="usd",
            account_amount=payment_transaction.amount * 0.75,
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
            currency="usd",
            amount=-payment_transaction.amount * 0.25,
            account_currency="usd",
            account_amount=-payment_transaction.amount * 0.25,
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
            currency="usd",
            amount=-payment_transaction.amount * 0.25,
            account_currency="usd",
            account_amount=-payment_transaction.amount * 0.25,
            tax_amount=0,
            order=order,
            payment_transaction=payment_transaction,
            transfer_id="STRIPE_TRANSFER_ID",
            balance_correlation_key="BALANCE_2",
        )
        await save_fixture(outgoing_balance_2)
        await save_fixture(incoming_balance_2)

        balance_transaction = build_stripe_balance_transaction(
            amount=-1800, currency="usd", exchange_rate=1.5
        )
        stripe_service_mock.get_balance_transaction.return_value = balance_transaction

        refund_transaction = await refund_transaction_service.create(session, refund)

        assert refund_transaction.type == TransactionType.refund
        assert refund_transaction.processor == Processor.stripe
        assert refund_transaction.currency == "usd"
        assert refund_transaction.amount == -1500
        assert refund_transaction.tax_amount == -300
        assert refund_transaction.presentment_currency == "eur"
        assert refund_transaction.presentment_amount == -1000
        assert refund_transaction.presentment_tax_amount == -200

        assert balance_transaction_service_mock.create_reversal_balance.call_count == 2

        first_call = (
            balance_transaction_service_mock.create_reversal_balance.call_args_list[0]
        )
        assert [t.id for t in first_call[1]["balance_transactions"]] == [
            outgoing_balance_1.id,
            incoming_balance_1.id,
        ]
        assert first_call[1]["amount"] == payment_transaction.amount * 0.75

        second_call = (
            balance_transaction_service_mock.create_reversal_balance.call_args_list[1]
        )
        assert [t.id for t in second_call[1]["balance_transactions"]] == [
            outgoing_balance_2.id,
            incoming_balance_2.id,
        ]
        assert second_call[1]["amount"] == payment_transaction.amount * 0.25

        create_refund_fees_mock.assert_awaited_once()


@pytest.mark.asyncio
class TestRevert:
    @pytest.mark.parametrize("status", [RefundStatus.pending, RefundStatus.succeeded])
    async def test_not_canceled_refund(
        self,
        status: RefundStatus,
        save_fixture: SaveFixture,
        session: AsyncSession,
        customer: Customer,
    ) -> None:
        pending_refund, _, _ = await create_order_and_refund(
            save_fixture, customer, status=status
        )

        with pytest.raises(NotCanceledRefundError):
            await refund_transaction_service.revert(session, pending_refund)

    async def test_not_existing_transaction(
        self, save_fixture: SaveFixture, session: AsyncSession, customer: Customer
    ) -> None:
        refund, _, _ = await create_order_and_refund(
            save_fixture, customer, status=RefundStatus.canceled
        )

        with pytest.raises(RefundTransactionDoesNotExistError):
            await refund_transaction_service.revert(session, refund)

    async def test_valid(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        user: User,
        product: Product,
        customer: Customer,
        stripe_service_mock: MagicMock,
    ) -> None:
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

        # Create a charge and order
        charge = build_stripe_charge()
        refund, order, payment = await create_order_and_refund(
            save_fixture,
            customer,
            status=RefundStatus.succeeded,
            subtotal_amount=charge.amount,
        )
        balance_transaction = build_stripe_balance_transaction(amount=-charge.amount)
        stripe_service_mock.get_balance_transaction.return_value = balance_transaction

        # Create the payment transaction
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

        # Balance the money to the organization account
        outgoing_balance = Transaction(
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
        incoming_balance = Transaction(
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
        await save_fixture(outgoing_balance)
        await save_fixture(incoming_balance)

        # Refund this transaction
        refund_transaction = await create_transaction(
            save_fixture,
            type=TransactionType.refund,
            refund=refund,
            amount=-refund.amount,
        )

        refund_outgoing_balance = Transaction(
            type=TransactionType.balance,
            processor=Processor.stripe,
            account=account,
            currency=charge.currency,
            amount=-charge.amount * 0.75,
            account_currency=charge.currency,
            account_amount=-charge.amount * 0.75,
            tax_amount=0,
            order=order,
            balance_correlation_key="REFUND_BALANCE",
            balance_reversal_transaction=incoming_balance,
        )
        refund_incoming_balance = Transaction(
            type=TransactionType.balance,
            processor=Processor.stripe,
            currency=charge.currency,
            amount=charge.amount * 0.75,
            account_currency=charge.currency,
            account_amount=charge.amount * 0.75,
            tax_amount=0,
            order=order,
            balance_correlation_key="REFUND_BALANCE",
            balance_reversal_transaction=outgoing_balance,
        )
        await save_fixture(refund_outgoing_balance)
        await save_fixture(refund_incoming_balance)

        refund.status = RefundStatus.canceled
        refund_reversal_transaction = await refund_transaction_service.revert(
            session, refund
        )

        assert refund_reversal_transaction.type == TransactionType.refund_reversal
        assert refund_reversal_transaction.processor == Processor.stripe
        assert refund_reversal_transaction.amount == refund.amount

        balance_transaction_repository = BalanceTransactionRepository.from_session(
            session
        )
        balance_transactions = await balance_transaction_repository.get_all(
            balance_transaction_repository.get_base_statement()
            .order_by(Transaction.created_at.asc())
            .options(
                joinedload(Transaction.balance_reversal_transaction),
                joinedload(Transaction.account),
                joinedload(Transaction.payment_transaction),
            )
        )
        assert len(balance_transactions) == 6

        assert balance_transactions[0] == outgoing_balance  # From Polar...
        assert balance_transactions[1] == incoming_balance  # ... to Account
        assert balance_transactions[2] == refund_outgoing_balance  # From Account...
        assert balance_transactions[3] == refund_incoming_balance  # ... to Polar

        reverse_balance_account = balance_transactions[4]  # From Polar...
        assert reverse_balance_account.account is None
        assert reverse_balance_account.balance_reversal_transaction is not None
        assert reverse_balance_account.balance_reversal_transaction == outgoing_balance
        assert (
            reverse_balance_account.balance_reversal_transaction.amount
            == reverse_balance_account.amount
        )
        assert reverse_balance_account.amount < 0
        assert reverse_balance_account.amount == -refund_incoming_balance.amount
        assert reverse_balance_account.payment_transaction is None

        reverse_balance_polar = balance_transactions[5]  # ... to Account
        assert reverse_balance_polar.account is not None
        assert reverse_balance_polar.balance_reversal_transaction is not None
        assert reverse_balance_polar.balance_reversal_transaction == incoming_balance
        assert (
            reverse_balance_polar.balance_reversal_transaction.amount
            == reverse_balance_polar.amount
        )
        assert reverse_balance_polar.amount == -refund_outgoing_balance.amount
        assert reverse_balance_polar.payment_transaction is None

    async def test_valid_different_settlement_currency(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        user: User,
        product: Product,
        customer: Customer,
        stripe_service_mock: MagicMock,
    ) -> None:
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

        # Create a charge and order
        charge = build_stripe_charge(amount=1200, currency="eur")
        refund, order, _ = await create_order_and_refund(
            save_fixture,
            customer,
            status=RefundStatus.succeeded,
            subtotal_amount=1000,
            tax_amount=200,
            currency="eur",
        )

        # Create the payment transaction
        payment_transaction = Transaction(
            type=TransactionType.payment,
            processor=Processor.stripe,
            currency="usd",
            amount=1000 * 1.5,
            tax_amount=200 * 1.5,
            account_currency="usd",
            account_amount=1000 * 1.5,
            presentment_currency="eur",
            presentment_amount=1000,
            presentment_tax_amount=200,
            charge_id=charge.id,
            order=order,
        )
        await save_fixture(payment_transaction)

        # Balance the money to the organization account
        outgoing_balance = Transaction(
            type=TransactionType.balance,
            processor=Processor.stripe,
            currency="usd",
            amount=-payment_transaction.amount * 0.75,
            account_currency="usd",
            account_amount=-payment_transaction.amount * 0.75,
            tax_amount=0,
            order=order,
            payment_transaction=payment_transaction,
            transfer_id="STRIPE_TRANSFER_ID",
            balance_correlation_key="BALANCE_1",
        )
        incoming_balance = Transaction(
            type=TransactionType.balance,
            processor=Processor.stripe,
            account=account,
            currency="usd",
            amount=payment_transaction.amount * 0.75,
            account_currency="usd",
            account_amount=payment_transaction.amount * 0.75,
            tax_amount=0,
            order=order,
            payment_transaction=payment_transaction,
            transfer_id="STRIPE_TRANSFER_ID",
            balance_correlation_key="BALANCE_1",
        )
        await save_fixture(outgoing_balance)
        await save_fixture(incoming_balance)

        # Refund this transaction
        balance_transaction = build_stripe_balance_transaction(
            amount=-1800, currency="usd", exchange_rate=1.5
        )
        stripe_service_mock.get_balance_transaction.return_value = balance_transaction
        refund_transaction = await create_transaction(
            save_fixture,
            type=TransactionType.refund,
            refund=refund,
            currency="usd",
            amount=-1500,
            tax_amount=-300,
            presentment_currency="eur",
            presentment_amount=-1000,
            presentment_tax_amount=-200,
        )

        refund_outgoing_balance = Transaction(
            type=TransactionType.balance,
            processor=Processor.stripe,
            account=account,
            currency="usd",
            amount=-payment_transaction.amount * 0.75,
            account_currency="usd",
            account_amount=-payment_transaction.amount * 0.75,
            tax_amount=0,
            order=order,
            balance_correlation_key="REFUND_BALANCE",
            balance_reversal_transaction=incoming_balance,
        )
        refund_incoming_balance = Transaction(
            type=TransactionType.balance,
            processor=Processor.stripe,
            currency="usd",
            amount=payment_transaction.amount * 0.75,
            account_currency="usd",
            account_amount=payment_transaction.amount * 0.75,
            tax_amount=0,
            order=order,
            balance_correlation_key="REFUND_BALANCE",
            balance_reversal_transaction=outgoing_balance,
        )
        await save_fixture(refund_outgoing_balance)
        await save_fixture(refund_incoming_balance)

        refund.status = RefundStatus.canceled
        refund_reversal_transaction = await refund_transaction_service.revert(
            session, refund
        )

        assert refund_reversal_transaction.type == TransactionType.refund_reversal
        assert refund_reversal_transaction.processor == Processor.stripe
        assert refund_reversal_transaction.currency == "usd"
        assert refund_reversal_transaction.amount == 1500
        assert refund_reversal_transaction.tax_amount == 300
        assert refund_reversal_transaction.presentment_currency == "eur"
        assert refund_reversal_transaction.presentment_amount == 1000
        assert refund_reversal_transaction.presentment_tax_amount == 200

        balance_transaction_repository = BalanceTransactionRepository.from_session(
            session
        )
        balance_transactions = await balance_transaction_repository.get_all(
            balance_transaction_repository.get_base_statement()
            .order_by(Transaction.created_at.asc())
            .options(
                joinedload(Transaction.balance_reversal_transaction),
                joinedload(Transaction.account),
                joinedload(Transaction.payment_transaction),
            )
        )
        assert len(balance_transactions) == 6

        assert balance_transactions[0] == outgoing_balance  # From Polar...
        assert balance_transactions[1] == incoming_balance  # ... to Account
        assert balance_transactions[2] == refund_outgoing_balance  # From Account...
        assert balance_transactions[3] == refund_incoming_balance  # ... to Polar

        reverse_balance_account = balance_transactions[4]  # From Polar...
        assert reverse_balance_account.account is None
        assert reverse_balance_account.balance_reversal_transaction is not None
        assert reverse_balance_account.balance_reversal_transaction == outgoing_balance
        assert (
            reverse_balance_account.balance_reversal_transaction.amount
            == reverse_balance_account.amount
        )
        assert reverse_balance_account.amount < 0
        assert reverse_balance_account.amount == -refund_incoming_balance.amount
        assert reverse_balance_account.payment_transaction is None

        reverse_balance_polar = balance_transactions[5]  # ... to Account
        assert reverse_balance_polar.account is not None
        assert reverse_balance_polar.balance_reversal_transaction is not None
        assert reverse_balance_polar.balance_reversal_transaction == incoming_balance
        assert (
            reverse_balance_polar.balance_reversal_transaction.amount
            == reverse_balance_polar.amount
        )
        assert reverse_balance_polar.amount == -refund_outgoing_balance.amount
        assert reverse_balance_polar.payment_transaction is None


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
