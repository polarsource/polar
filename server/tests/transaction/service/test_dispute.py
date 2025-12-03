from unittest.mock import AsyncMock, MagicMock

import pytest
import pytest_asyncio
from pytest_mock import MockerFixture

from polar.enums import AccountType
from polar.integrations.stripe.service import StripeService
from polar.models import (
    Account,
    Customer,
    Order,
    Organization,
    Payment,
    Transaction,
    User,
)
from polar.models.dispute import DisputeStatus
from polar.models.transaction import Processor, TransactionType
from polar.postgres import AsyncSession
from polar.transaction.service.balance import BalanceTransactionService
from polar.transaction.service.balance import (
    balance_transaction as balance_transaction_service,
)
from polar.transaction.service.dispute import (  # type: ignore[attr-defined]
    DisputeNotResolved,
    DisputeTransactionAlreadyExistsError,
    platform_fee_transaction_service,
    processor_fee_transaction_service,
)
from polar.transaction.service.dispute import (
    dispute_transaction as dispute_transaction_service,
)
from polar.transaction.service.platform_fee import PlatformFeeTransactionService
from polar.transaction.service.processor_fee import ProcessorFeeTransactionService
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import create_dispute, create_order, create_payment
from tests.fixtures.stripe import (
    build_stripe_balance_transaction,
    build_stripe_charge,
    build_stripe_dispute,
)
from tests.transaction.conftest import create_transaction


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
        processor_fee_transaction_service,
        "create_dispute_fees",
        spec=ProcessorFeeTransactionService.create_dispute_fees,
        return_value=[],
    )


@pytest.fixture(autouse=True)
def create_dispute_fees_balances_mock(mocker: MockerFixture) -> AsyncMock:
    return mocker.patch.object(
        platform_fee_transaction_service,
        "create_dispute_fees_balances",
        spec=PlatformFeeTransactionService.create_dispute_fees_balances,
        return_value=[],
    )


@pytest.fixture(autouse=True)
def stripe_service_mock(mocker: MockerFixture) -> MagicMock:
    return mocker.patch(
        "polar.transaction.service.dispute.stripe_service", spec=StripeService
    )


@pytest_asyncio.fixture
async def order(save_fixture: SaveFixture, customer: Customer) -> Order:
    return await create_order(save_fixture, customer=customer)


@pytest_asyncio.fixture
async def payment(
    save_fixture: SaveFixture, order: Order, organization: Organization
) -> Payment:
    return await create_payment(save_fixture, organization, order=order)


@pytest.mark.asyncio
class TestCreateDispute:
    async def test_not_resolved(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        order: Order,
        payment: Payment,
    ) -> None:
        dispute = await create_dispute(
            save_fixture, order, payment, status=DisputeStatus.needs_response
        )

        with pytest.raises(DisputeNotResolved):
            await dispute_transaction_service.create_dispute(session, dispute=dispute)

    async def test_transaction_already_exists(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        order: Order,
        payment: Payment,
    ) -> None:
        dispute = await create_dispute(
            save_fixture, order, payment, status=DisputeStatus.won
        )
        await create_transaction(
            save_fixture, type=TransactionType.dispute, dispute=dispute
        )

        with pytest.raises(DisputeTransactionAlreadyExistsError):
            await dispute_transaction_service.create_dispute(session, dispute=dispute)

    async def test_valid_lost(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        user: User,
        order: Order,
        payment: Payment,
        balance_transaction_service_mock: MagicMock,
        create_dispute_fees_mock: AsyncMock,
        create_dispute_fees_balances_mock: AsyncMock,
        stripe_service_mock: MagicMock,
    ) -> None:
        charge = build_stripe_charge(id=payment.processor_id)
        dispute = await create_dispute(
            save_fixture, order, payment, status=DisputeStatus.lost, amount=1000
        )
        stripe_service_mock.get_dispute.return_value = build_stripe_dispute(
            status="lost",
            amount=1000,
            charge_id=charge.id,
            balance_transactions=[
                build_stripe_balance_transaction(
                    reporting_category="dispute", amount=-1000
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
            payment_transaction=payment_transaction,
            transfer_id="STRIPE_TRANSFER_ID",
            balance_correlation_key="BALANCE_2",
        )
        await save_fixture(outgoing_balance_2)
        await save_fixture(incoming_balance_2)

        (
            dispute_transaction,
            dispute_reversal_transaction,
        ) = await dispute_transaction_service.create_dispute(session, dispute=dispute)

        assert dispute_transaction.type == TransactionType.dispute
        assert dispute_transaction.processor == Processor.stripe
        assert dispute_transaction.amount == -dispute.amount
        assert dispute_transaction.dispute == dispute

        assert dispute_reversal_transaction is None

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
        create_dispute_fees_balances_mock.assert_awaited_once()

    async def test_valid_won(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        user: User,
        order: Order,
        payment: Payment,
        balance_transaction_service_mock: MagicMock,
        create_dispute_fees_mock: AsyncMock,
        create_dispute_fees_balances_mock: AsyncMock,
        stripe_service_mock: MagicMock,
    ) -> None:
        charge = build_stripe_charge(id=payment.processor_id)
        dispute = await create_dispute(
            save_fixture, order, payment, status=DisputeStatus.won, amount=1000
        )
        stripe_service_mock.get_dispute.return_value = build_stripe_dispute(
            status="won",
            amount=1000,
            charge_id=charge.id,
            balance_transactions=[
                build_stripe_balance_transaction(
                    reporting_category="dispute", fee=1500, amount=-1000
                ),
                build_stripe_balance_transaction(
                    reporting_category="dispute_reversal", fee=0, amount=1000
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
        )
        await save_fixture(payment_transaction)

        # First balance
        outgoing_balance_1 = Transaction(
            type=TransactionType.balance,
            processor=Processor.stripe,
            currency=charge.currency,
            amount=-charge.amount * 0.75,
            account_currency=charge.currency,
            account_amount=-charge.amount * 0.75,
            tax_amount=0,
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
            payment_transaction=payment_transaction,
            transfer_id="STRIPE_TRANSFER_ID",
            balance_correlation_key="BALANCE_1",
        )
        await save_fixture(outgoing_balance_1)
        await save_fixture(incoming_balance_1)

        # Second balance
        outgoing_balance_2 = Transaction(
            type=TransactionType.balance,
            processor=Processor.stripe,
            currency=charge.currency,
            amount=-charge.amount * 0.25,
            account_currency=charge.currency,
            account_amount=-charge.amount * 0.25,
            tax_amount=0,
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
            payment_transaction=payment_transaction,
            transfer_id="STRIPE_TRANSFER_ID",
            balance_correlation_key="BALANCE_2",
        )
        await save_fixture(outgoing_balance_2)
        await save_fixture(incoming_balance_2)

        (
            dispute_transaction,
            dispute_reversal_transaction,
        ) = await dispute_transaction_service.create_dispute(session, dispute=dispute)

        assert dispute_transaction.type == TransactionType.dispute
        assert dispute_transaction.processor == Processor.stripe
        assert dispute_transaction.amount == -dispute.amount
        assert dispute_transaction.dispute == dispute

        assert dispute_reversal_transaction is not None
        assert dispute_reversal_transaction.type == TransactionType.dispute_reversal
        assert dispute_reversal_transaction.processor == Processor.stripe
        assert dispute_reversal_transaction.amount == dispute.amount
        assert dispute_reversal_transaction.dispute == dispute

        balance_transaction_service_mock.create_reversal_balance.assert_not_called()

        create_dispute_fees_mock.assert_awaited()
        assert create_dispute_fees_mock.call_count == 2

        create_dispute_fees_balances_mock.assert_awaited_once()

    async def test_valid_won_different_settlement_currency(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        user: User,
        order: Order,
        payment: Payment,
        balance_transaction_service_mock: MagicMock,
        create_dispute_fees_mock: AsyncMock,
        create_dispute_fees_balances_mock: AsyncMock,
        stripe_service_mock: MagicMock,
    ) -> None:
        charge_balance_transaction = build_stripe_balance_transaction(
            amount=1800, currency="usd", exchange_rate=1.5
        )
        charge = build_stripe_charge(
            id=payment.processor_id,
            amount=1200,
            currency="eur",
            balance_transaction=charge_balance_transaction.id,
        )
        dispute = await create_dispute(
            save_fixture,
            order,
            payment,
            status=DisputeStatus.won,
            amount=1000,
            tax_amount=200,
            currency="eur",
        )

        stripe_service_mock.get_dispute.return_value = build_stripe_dispute(
            status="won",
            currency="eur",
            amount=1200,
            charge_id=charge.id,
            balance_transactions=[
                build_stripe_balance_transaction(
                    reporting_category="dispute",
                    fee=1500,
                    amount=-1800,
                    currency="usd",
                ),
                build_stripe_balance_transaction(
                    reporting_category="dispute_reversal",
                    fee=0,
                    amount=1800,
                    currency="usd",
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
        await save_fixture(account)

        payment_transaction = Transaction(
            type=TransactionType.payment,
            processor=Processor.stripe,
            currency="usd",
            amount=1500,
            account_currency="usd",
            account_amount=1500,
            tax_amount=300,
            presentment_currency=charge.currency,
            presentment_amount=1000,
            presentment_tax_amount=200,
            charge_id=charge.id,
        )
        await save_fixture(payment_transaction)

        # First balance
        outgoing_balance_1 = Transaction(
            type=TransactionType.balance,
            processor=Processor.stripe,
            currency=payment_transaction.currency,
            amount=-payment_transaction.amount * 0.75,
            account_currency=payment_transaction.currency,
            account_amount=-payment_transaction.amount * 0.75,
            tax_amount=0,
            payment_transaction=payment_transaction,
            transfer_id="STRIPE_TRANSFER_ID",
            balance_correlation_key="BALANCE_1",
        )
        incoming_balance_1 = Transaction(
            type=TransactionType.balance,
            processor=Processor.stripe,
            account=account,
            currency=payment_transaction.currency,
            amount=payment_transaction.amount * 0.75,
            account_currency=payment_transaction.currency,
            account_amount=payment_transaction.amount * 0.75,
            tax_amount=0,
            payment_transaction=payment_transaction,
            transfer_id="STRIPE_TRANSFER_ID",
            balance_correlation_key="BALANCE_1",
        )
        await save_fixture(outgoing_balance_1)
        await save_fixture(incoming_balance_1)

        # Second balance
        outgoing_balance_2 = Transaction(
            type=TransactionType.balance,
            processor=Processor.stripe,
            currency=payment_transaction.currency,
            amount=-payment_transaction.amount * 0.25,
            account_currency=payment_transaction.currency,
            account_amount=-payment_transaction.amount * 0.25,
            tax_amount=0,
            payment_transaction=payment_transaction,
            transfer_id="STRIPE_TRANSFER_ID",
            balance_correlation_key="BALANCE_2",
        )
        incoming_balance_2 = Transaction(
            type=TransactionType.balance,
            processor=Processor.stripe,
            account=account,
            currency=payment_transaction.currency,
            amount=payment_transaction.amount * 0.25,
            account_currency=payment_transaction.currency,
            account_amount=payment_transaction.amount * 0.25,
            tax_amount=0,
            payment_transaction=payment_transaction,
            transfer_id="STRIPE_TRANSFER_ID",
            balance_correlation_key="BALANCE_2",
        )
        await save_fixture(outgoing_balance_2)
        await save_fixture(incoming_balance_2)

        (
            dispute_transaction,
            dispute_reversal_transaction,
        ) = await dispute_transaction_service.create_dispute(session, dispute=dispute)

        assert dispute_transaction.type == TransactionType.dispute
        assert dispute_transaction.processor == Processor.stripe
        assert dispute_transaction.currency == "usd"
        assert dispute_transaction.amount == -1500
        assert dispute_transaction.tax_amount == -300
        assert dispute_transaction.presentment_currency == "eur"
        assert dispute_transaction.presentment_amount == -1000
        assert dispute_transaction.presentment_tax_amount == -200
        assert dispute_transaction.dispute == dispute

        assert dispute_reversal_transaction is not None
        assert dispute_reversal_transaction.type == TransactionType.dispute_reversal
        assert dispute_reversal_transaction.processor == Processor.stripe
        assert dispute_reversal_transaction.currency == "usd"
        assert dispute_reversal_transaction.amount == 1500
        assert dispute_reversal_transaction.tax_amount == 300
        assert dispute_reversal_transaction.presentment_currency == "eur"
        assert dispute_reversal_transaction.presentment_amount == 1000
        assert dispute_reversal_transaction.presentment_tax_amount == 200
        assert dispute_reversal_transaction.dispute == dispute

        balance_transaction_service_mock.create_reversal_balance.assert_not_called()

        create_dispute_fees_mock.assert_awaited()
        assert create_dispute_fees_mock.call_count == 2

        create_dispute_fees_balances_mock.assert_awaited_once()

    async def test_valid_lost_different_settlement_currency(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        user: User,
        order: Order,
        payment: Payment,
        balance_transaction_service_mock: MagicMock,
        create_dispute_fees_mock: AsyncMock,
        create_dispute_fees_balances_mock: AsyncMock,
        stripe_service_mock: MagicMock,
    ) -> None:
        charge_balance_transaction = build_stripe_balance_transaction(
            amount=1800, currency="usd", exchange_rate=1.5
        )
        charge = build_stripe_charge(
            id=payment.processor_id,
            amount=1200,
            currency="eur",
            balance_transaction=charge_balance_transaction.id,
        )
        dispute = await create_dispute(
            save_fixture,
            order,
            payment,
            status=DisputeStatus.lost,
            amount=1000,
            tax_amount=200,
            currency="eur",
        )
        stripe_service_mock.get_dispute.return_value = build_stripe_dispute(
            status="lost",
            currency="eur",
            amount=1200,
            charge_id=charge.id,
            balance_transactions=[
                build_stripe_balance_transaction(
                    reporting_category="dispute",
                    fee=1500,
                    amount=-1800,
                    currency="usd",
                ),
                build_stripe_balance_transaction(
                    reporting_category="dispute_reversal",
                    fee=0,
                    amount=1800,
                    currency="usd",
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
        await save_fixture(account)

        payment_transaction = Transaction(
            type=TransactionType.payment,
            processor=Processor.stripe,
            currency="usd",
            amount=1500,
            account_currency="usd",
            account_amount=1500,
            tax_amount=300,
            presentment_currency=charge.currency,
            presentment_amount=1000,
            presentment_tax_amount=200,
            charge_id=charge.id,
        )
        await save_fixture(payment_transaction)

        # First balance
        outgoing_balance_1 = Transaction(
            type=TransactionType.balance,
            processor=Processor.stripe,
            currency=payment_transaction.currency,
            amount=-payment_transaction.amount * 0.75,
            account_currency=payment_transaction.currency,
            account_amount=-payment_transaction.amount * 0.75,
            tax_amount=0,
            payment_transaction=payment_transaction,
            transfer_id="STRIPE_TRANSFER_ID",
            balance_correlation_key="BALANCE_1",
        )
        incoming_balance_1 = Transaction(
            type=TransactionType.balance,
            processor=Processor.stripe,
            account=account,
            currency=payment_transaction.currency,
            amount=payment_transaction.amount * 0.75,
            account_currency=payment_transaction.currency,
            account_amount=payment_transaction.amount * 0.75,
            tax_amount=0,
            payment_transaction=payment_transaction,
            transfer_id="STRIPE_TRANSFER_ID",
            balance_correlation_key="BALANCE_1",
        )
        await save_fixture(outgoing_balance_1)
        await save_fixture(incoming_balance_1)

        # Second balance
        outgoing_balance_2 = Transaction(
            type=TransactionType.balance,
            processor=Processor.stripe,
            currency=payment_transaction.currency,
            amount=-payment_transaction.amount * 0.25,
            account_currency=payment_transaction.currency,
            account_amount=-payment_transaction.amount * 0.25,
            tax_amount=0,
            payment_transaction=payment_transaction,
            transfer_id="STRIPE_TRANSFER_ID",
            balance_correlation_key="BALANCE_2",
        )
        incoming_balance_2 = Transaction(
            type=TransactionType.balance,
            processor=Processor.stripe,
            account=account,
            currency=payment_transaction.currency,
            amount=payment_transaction.amount * 0.25,
            account_currency=payment_transaction.currency,
            account_amount=payment_transaction.amount * 0.25,
            tax_amount=0,
            payment_transaction=payment_transaction,
            transfer_id="STRIPE_TRANSFER_ID",
            balance_correlation_key="BALANCE_2",
        )
        await save_fixture(outgoing_balance_2)
        await save_fixture(incoming_balance_2)

        (
            dispute_transaction,
            dispute_reversal_transaction,
        ) = await dispute_transaction_service.create_dispute(session, dispute=dispute)

        assert dispute_transaction.type == TransactionType.dispute
        assert dispute_transaction.processor == Processor.stripe
        assert dispute_transaction.currency == "usd"
        assert dispute_transaction.amount == -1500
        assert dispute_transaction.tax_amount == -300
        assert dispute_transaction.presentment_currency == "eur"
        assert dispute_transaction.presentment_amount == -1000
        assert dispute_transaction.presentment_tax_amount == -200

        assert dispute_reversal_transaction is None

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

        create_dispute_fees_mock.assert_awaited_once()
        create_dispute_fees_balances_mock.assert_awaited_once()


@pytest.mark.asyncio
class TestCreateReversalBalancesForPayment:
    async def test_not_reversed(
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
            type=TransactionType.dispute,
            amount=-payment_transaction.amount,
            charge_id="STRIPE_CHARGE_ID",
            dispute_id="STRIPE_DISPUTE_ID",
        )

        reversal_balances = (
            await dispute_transaction_service.create_reversal_balances_for_payment(
                session, payment_transaction=payment_transaction
            )
        )

        assert len(reversal_balances) == 1

    async def test_reversed(
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
            type=TransactionType.dispute,
            amount=-payment_transaction.amount,
            dispute_id="STRIPE_DISPUTE_ID",
            charge_id="STRIPE_CHARGE_ID",
        )
        await create_transaction(
            save_fixture,
            type=TransactionType.dispute_reversal,
            amount=payment_transaction.amount,
            dispute_id="STRIPE_DISPUTE_ID",
            charge_id="STRIPE_CHARGE_ID",
        )

        reversal_balances = (
            await dispute_transaction_service.create_reversal_balances_for_payment(
                session, payment_transaction=payment_transaction
            )
        )

        assert len(reversal_balances) == 0
