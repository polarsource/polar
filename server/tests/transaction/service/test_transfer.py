from types import SimpleNamespace
from unittest.mock import MagicMock

import pytest
from pytest_mock import MockerFixture

from polar.enums import AccountType
from polar.integrations.stripe.service import StripeService
from polar.models import (
    Account,
    IssueReward,
    Organization,
    Pledge,
    Subscription,
    Transaction,
    User,
)
from polar.models.transaction import PaymentProcessor, TransactionType
from polar.postgres import AsyncSession
from polar.transaction.service.transfer import (
    PaymentTransactionForChargeDoesNotExist,
    StripeNotConfiguredOnAccount,
    UnsetAccountCurrency,
    UnsupportedAccountType,
)
from polar.transaction.service.transfer import (
    transfer_transaction as transfer_transaction_service,
)


@pytest.fixture(autouse=True)
def stripe_service_mock(mocker: MockerFixture) -> MagicMock:
    mock = MagicMock(spec=StripeService)
    mocker.patch("polar.transaction.service.transfer.stripe_service", new=mock)
    return mock


async def create_payment_transaction(
    session: AsyncSession,
    *,
    processor: PaymentProcessor = PaymentProcessor.stripe,
    currency: str = "usd",
    amount: int = 1000,
    charge_id: str = "STRIPE_CHARGE_ID",
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
        processor_fee_amount=0,
        charge_id=charge_id,
        pledge=pledge,
        subscription=subscription,
        issue_reward=issue_reward,
    )
    session.add(transaction)
    await session.commit()
    return transaction


@pytest.mark.asyncio
class TestCreateTransfer:
    async def test_unsupported_account_type(
        self, session: AsyncSession, organization: Organization, user: User
    ) -> None:
        account = Account(
            account_type="UNKNOWN",
            organization_id=organization.id,
            admin_id=user.id,
            country="US",
            currency="usd",
        )
        payment_transaction = await create_payment_transaction(session)

        with pytest.raises(UnsupportedAccountType):
            await transfer_transaction_service.create_transfer(
                session,
                destination_account=account,
                payment_transaction=payment_transaction,
                amount=1000,
            )

    async def test_unset_account_currency(
        self, session: AsyncSession, organization: Organization, user: User
    ) -> None:
        account = Account(
            account_type=AccountType.stripe,
            organization_id=organization.id,
            admin_id=user.id,
            country="US",
            currency=None,
        )
        payment_transaction = await create_payment_transaction(session)

        with pytest.raises(UnsetAccountCurrency):
            await transfer_transaction_service.create_transfer(
                session,
                destination_account=account,
                payment_transaction=payment_transaction,
                amount=1000,
            )

    async def test_stripe_not_configured_on_destination_account(
        self, session: AsyncSession, organization: Organization, user: User
    ) -> None:
        account = Account(
            account_type=AccountType.stripe,
            organization_id=organization.id,
            admin_id=user.id,
            country="US",
            currency="usd",
            is_details_submitted=False,
            is_charges_enabled=False,
            is_payouts_enabled=False,
            stripe_id=None,
        )
        payment_transaction = await create_payment_transaction(session)

        with pytest.raises(StripeNotConfiguredOnAccount):
            await transfer_transaction_service.create_transfer(
                session,
                destination_account=account,
                payment_transaction=payment_transaction,
                amount=1000,
            )

    async def test_stripe(
        self,
        session: AsyncSession,
        organization: Organization,
        user: User,
        stripe_service_mock: MagicMock,
    ) -> None:
        account = Account(
            account_type=AccountType.stripe,
            organization_id=organization.id,
            admin_id=user.id,
            country="US",
            currency="usd",
            is_details_submitted=True,
            is_charges_enabled=True,
            is_payouts_enabled=True,
            stripe_id="STRIPE_ACCOUNT_ID",
        )
        session.add(account)
        await session.commit()
        payment_transaction = await create_payment_transaction(session)

        stripe_service_mock.transfer.return_value = SimpleNamespace(
            id="STRIPE_TRANSFER_ID", balance_transaction="STRIPE_BALANCE_TRANSACTION_ID"
        )

        outgoing, incoming = await transfer_transaction_service.create_transfer(
            session,
            destination_account=account,
            payment_transaction=payment_transaction,
            amount=1000,
        )

        assert outgoing.account_id is None
        assert outgoing.type == TransactionType.transfer
        assert outgoing.processor == PaymentProcessor.stripe
        assert outgoing.amount == -1000
        assert outgoing.transfer_id == "STRIPE_TRANSFER_ID"
        assert outgoing.payment_transaction == payment_transaction

        assert incoming.account_id == account.id
        assert incoming.type == TransactionType.transfer
        assert incoming.processor == PaymentProcessor.stripe
        assert incoming.amount == 1000
        assert incoming.transfer_id == "STRIPE_TRANSFER_ID"
        assert incoming.payment_transaction == payment_transaction

        assert outgoing.transfer_correlation_key == incoming.transfer_correlation_key

        assert outgoing.id is not None
        assert incoming.id is not None

        stripe_service_mock.transfer.assert_called_once()
        assert stripe_service_mock.transfer.call_args[1]["metadata"][
            "outgoing_transaction_id"
        ] == str(outgoing.id)
        assert stripe_service_mock.transfer.call_args[1]["metadata"][
            "incoming_transaction_id"
        ] == str(incoming.id)

    async def test_stripe_different_currencies(
        self,
        session: AsyncSession,
        organization: Organization,
        user: User,
        stripe_service_mock: MagicMock,
    ) -> None:
        account = Account(
            account_type=AccountType.stripe,
            organization_id=organization.id,
            admin_id=user.id,
            country="FR",
            currency="eur",
            is_details_submitted=True,
            is_charges_enabled=True,
            is_payouts_enabled=True,
            stripe_id="STRIPE_ACCOUNT_ID",
        )
        session.add(account)
        await session.commit()
        payment_transaction = await create_payment_transaction(session)

        stripe_service_mock.transfer.return_value = SimpleNamespace(
            id="STRIPE_TRANSFER_ID",
            balance_transaction="STRIPE_BALANCE_TRANSACTION_ID",
            destination_payment="STRIPE_DESTINATION_CHARGE_ID",
        )
        stripe_service_mock.get_charge.return_value = SimpleNamespace(
            id="STRIPE_DESTINATION_CHARGE_ID",
            balance_transaction=SimpleNamespace(
                amount=900, currency="eur", exchange_rate=0.9
            ),
        )

        outgoing, incoming = await transfer_transaction_service.create_transfer(
            session,
            destination_account=account,
            payment_transaction=payment_transaction,
            amount=1000,
        )

        assert outgoing.account_id is None
        assert outgoing.type == TransactionType.transfer
        assert outgoing.processor == PaymentProcessor.stripe
        assert outgoing.currency == "usd"
        assert outgoing.amount == -1000
        assert outgoing.transfer_id == "STRIPE_TRANSFER_ID"
        assert outgoing.payment_transaction == payment_transaction

        assert incoming.account_id == account.id
        assert incoming.type == TransactionType.transfer
        assert incoming.processor == PaymentProcessor.stripe
        assert incoming.currency == "usd"
        assert incoming.amount == 1000
        assert incoming.account_currency == "eur"
        assert incoming.account_amount == 900
        assert incoming.transfer_id == "STRIPE_TRANSFER_ID"
        assert incoming.payment_transaction == payment_transaction

        assert outgoing.transfer_correlation_key == incoming.transfer_correlation_key

    async def test_open_collective(
        self, session: AsyncSession, organization: Organization, user: User
    ) -> None:
        account = Account(
            account_type=AccountType.open_collective,
            organization_id=organization.id,
            admin_id=user.id,
            country="US",
            currency="usd",
            is_details_submitted=False,
            is_charges_enabled=False,
            is_payouts_enabled=False,
            open_collective_slug="polarsource",
        )
        session.add(account)
        await session.commit()
        payment_transaction = await create_payment_transaction(session)

        outgoing, incoming = await transfer_transaction_service.create_transfer(
            session,
            destination_account=account,
            payment_transaction=payment_transaction,
            amount=1000,
        )

        assert outgoing.account_id is None
        assert outgoing.type == TransactionType.transfer
        assert outgoing.processor == PaymentProcessor.open_collective
        assert outgoing.amount == -1000
        assert outgoing.payment_transaction == payment_transaction

        assert outgoing.transfer_correlation_key == incoming.transfer_correlation_key

        assert incoming.account_id == account.id
        assert incoming.type == TransactionType.transfer
        assert incoming.processor == PaymentProcessor.open_collective
        assert incoming.amount == 1000
        assert incoming.payment_transaction == payment_transaction

        assert outgoing.transfer_correlation_key == incoming.transfer_correlation_key


@pytest.mark.asyncio
class TestCreateTransferFromCharge:
    async def test_not_existing_charge(
        self, session: AsyncSession, organization: Organization, user: User
    ) -> None:
        account = Account(
            account_type=AccountType.stripe,
            organization_id=organization.id,
            admin_id=user.id,
            country="FR",
            currency="eur",
            is_details_submitted=True,
            is_charges_enabled=True,
            is_payouts_enabled=True,
            stripe_id="STRIPE_ACCOUNT_ID",
        )

        with pytest.raises(PaymentTransactionForChargeDoesNotExist):
            await transfer_transaction_service.create_transfer_from_charge(
                session,
                destination_account=account,
                charge_id="STRIPE_CHARGE_ID",
                amount=1000,
            )

    async def test_valid(
        self,
        session: AsyncSession,
        organization: Organization,
        user: User,
        stripe_service_mock: MagicMock,
    ) -> None:
        account = Account(
            account_type=AccountType.stripe,
            organization_id=organization.id,
            admin_id=user.id,
            country="FR",
            currency="eur",
            is_details_submitted=True,
            is_charges_enabled=True,
            is_payouts_enabled=True,
            stripe_id="STRIPE_ACCOUNT_ID",
        )
        payment_transaction = await create_payment_transaction(session)

        stripe_service_mock.transfer.return_value = SimpleNamespace(
            id="STRIPE_TRANSFER_ID",
            balance_transaction="STRIPE_BALANCE_TRANSACTION_ID",
            destination_payment="STRIPE_DESTINATION_CHARGE_ID",
        )
        stripe_service_mock.get_charge.return_value = SimpleNamespace(
            id="STRIPE_DESTINATION_CHARGE_ID",
            balance_transaction=SimpleNamespace(
                amount=900, currency="eur", exchange_rate=0.9
            ),
        )

        (
            incoming,
            outgoing,
        ) = await transfer_transaction_service.create_transfer_from_charge(
            session,
            destination_account=account,
            charge_id="STRIPE_CHARGE_ID",
            amount=1000,
        )

        assert incoming.payment_transaction == payment_transaction
        assert outgoing.payment_transaction == payment_transaction


async def create_transfer_transactions(
    session: AsyncSession,
    *,
    destination_account: Account,
    currency: str = "usd",
    amount: int = 1000,
) -> tuple[Transaction, Transaction]:
    if destination_account.account_type == AccountType.stripe:
        processor = PaymentProcessor.stripe
    elif destination_account.account_type == AccountType.open_collective:
        processor = PaymentProcessor.open_collective
    else:
        raise ValueError("Unsupported account type")

    outgoing_transaction = Transaction(
        account=None,  # Polar account
        type=TransactionType.transfer,
        processor=processor,
        currency=currency,
        amount=-amount,  # Subtract the amount
        account_currency=currency,
        account_amount=-amount,  # Subtract the amount
        tax_amount=0,
        processor_fee_amount=0,
    )
    incoming_transaction = Transaction(
        account=destination_account,  # User account
        type=TransactionType.transfer,
        processor=processor,
        currency=currency,
        amount=amount,  # Add the amount
        account_currency=currency,
        account_amount=amount,  # Add the amount
        tax_amount=0,
        processor_fee_amount=0,
    )

    session.add(outgoing_transaction)
    session.add(incoming_transaction)
    await session.commit()

    return outgoing_transaction, incoming_transaction


@pytest.mark.asyncio
class TestCreateReversalTransfer:
    async def test_unset_account_currency(
        self, session: AsyncSession, organization: Organization, user: User
    ) -> None:
        account = Account(
            account_type=AccountType.stripe,
            organization_id=organization.id,
            admin_id=user.id,
            country="US",
            currency=None,
            is_details_submitted=False,
            is_charges_enabled=False,
            is_payouts_enabled=False,
            stripe_id=None,
        )

        transfer_transactions = await create_transfer_transactions(
            session, destination_account=account
        )

        with pytest.raises(UnsetAccountCurrency):
            await transfer_transaction_service.create_reversal_transfer(
                session,
                transfer_transactions=transfer_transactions,
                destination_currency="usd",
                amount=1000,
            )

    async def test_stripe_not_configured_on_destination_account(
        self, session: AsyncSession, organization: Organization, user: User
    ) -> None:
        account = Account(
            account_type=AccountType.stripe,
            organization_id=organization.id,
            admin_id=user.id,
            country="US",
            currency="usd",
            is_details_submitted=False,
            is_charges_enabled=False,
            is_payouts_enabled=False,
            stripe_id=None,
        )

        transfer_transactions = await create_transfer_transactions(
            session, destination_account=account
        )

        with pytest.raises(StripeNotConfiguredOnAccount):
            await transfer_transaction_service.create_reversal_transfer(
                session,
                transfer_transactions=transfer_transactions,
                destination_currency="usd",
                amount=1000,
            )

    async def test_stripe(
        self,
        session: AsyncSession,
        organization: Organization,
        user: User,
        stripe_service_mock: MagicMock,
    ) -> None:
        account = Account(
            account_type=AccountType.stripe,
            organization_id=organization.id,
            admin_id=user.id,
            country="US",
            currency="usd",
            is_details_submitted=True,
            is_charges_enabled=True,
            is_payouts_enabled=True,
            stripe_id="STRIPE_ACCOUNT_ID",
        )
        session.add(account)
        await session.commit()

        stripe_service_mock.reverse_transfer.return_value = SimpleNamespace(
            id="STRIPE_REVERSAL_TRANSFER_ID"
        )

        transfer_transactions = await create_transfer_transactions(
            session, destination_account=account
        )
        transfer_outgoing, transfer_incoming = transfer_transactions

        (
            outgoing,
            incoming,
        ) = await transfer_transaction_service.create_reversal_transfer(
            session,
            transfer_transactions=transfer_transactions,
            destination_currency="usd",
            amount=1000,
        )

        assert outgoing.account_id == account.id
        assert outgoing.type == TransactionType.transfer
        assert outgoing.processor == PaymentProcessor.stripe
        assert outgoing.amount == -1000
        assert outgoing.processor_fee_amount == 0
        assert outgoing.transfer_reversal_id == "STRIPE_REVERSAL_TRANSFER_ID"
        assert outgoing.transfer_reversal_transaction_id == transfer_incoming.id

        assert incoming.account_id is None
        assert incoming.type == TransactionType.transfer
        assert incoming.processor == PaymentProcessor.stripe
        assert incoming.amount == 1000
        assert incoming.processor_fee_amount == 0
        assert incoming.transfer_reversal_id == "STRIPE_REVERSAL_TRANSFER_ID"
        assert incoming.transfer_reversal_transaction_id == transfer_outgoing.id

        assert outgoing.transfer_correlation_key == incoming.transfer_correlation_key

        assert outgoing.id is not None
        assert incoming.id is not None

        stripe_service_mock.reverse_transfer.assert_called_once()
        assert stripe_service_mock.reverse_transfer.call_args[1]["metadata"][
            "outgoing_transaction_id"
        ] == str(outgoing.id)
        assert stripe_service_mock.reverse_transfer.call_args[1]["metadata"][
            "incoming_transaction_id"
        ] == str(incoming.id)

    async def test_stripe_different_currencies(
        self,
        session: AsyncSession,
        organization: Organization,
        user: User,
        stripe_service_mock: MagicMock,
    ) -> None:
        account = Account(
            account_type=AccountType.stripe,
            organization_id=organization.id,
            admin_id=user.id,
            country="FR",
            currency="eur",
            is_details_submitted=True,
            is_charges_enabled=True,
            is_payouts_enabled=True,
            stripe_id="STRIPE_ACCOUNT_ID",
        )
        session.add(account)
        await session.commit()

        stripe_service_mock.reverse_transfer.return_value = SimpleNamespace(
            id="STRIPE_REVERSAL_TRANSFER_ID",
            destination_payment_refund="CHARGE_REFUND_ID",
        )
        stripe_service_mock.get_refund.return_value = SimpleNamespace(
            id="CHARGE_REFUND_ID",
            balance_transaction=SimpleNamespace(
                amount=-900, currency="eur", exchange_rate=0.9
            ),
        )

        transfer_transactions = await create_transfer_transactions(
            session, destination_account=account
        )
        transfer_outgoing, transfer_incoming = transfer_transactions

        (
            outgoing,
            incoming,
        ) = await transfer_transaction_service.create_reversal_transfer(
            session,
            transfer_transactions=transfer_transactions,
            destination_currency="usd",
            amount=1000,
        )

        assert outgoing.account_id == account.id
        assert outgoing.type == TransactionType.transfer
        assert outgoing.processor == PaymentProcessor.stripe
        assert outgoing.amount == -1000
        assert outgoing.currency == "usd"
        assert outgoing.account_currency == "eur"
        assert outgoing.account_amount == -900
        assert outgoing.processor_fee_amount == 0
        assert outgoing.transfer_reversal_id == "STRIPE_REVERSAL_TRANSFER_ID"
        assert outgoing.transfer_reversal_transaction_id == transfer_incoming.id

        assert incoming.account_id is None
        assert incoming.type == TransactionType.transfer
        assert incoming.processor == PaymentProcessor.stripe
        assert incoming.amount == 1000
        assert incoming.processor_fee_amount == 0
        assert incoming.transfer_reversal_id == "STRIPE_REVERSAL_TRANSFER_ID"
        assert incoming.transfer_reversal_transaction_id == transfer_outgoing.id

        assert outgoing.transfer_correlation_key == incoming.transfer_correlation_key

        assert outgoing.id is not None
        assert incoming.id is not None

        stripe_service_mock.reverse_transfer.assert_called_once()
        assert stripe_service_mock.reverse_transfer.call_args[1]["metadata"][
            "outgoing_transaction_id"
        ] == str(outgoing.id)
        assert stripe_service_mock.reverse_transfer.call_args[1]["metadata"][
            "incoming_transaction_id"
        ] == str(incoming.id)

    async def test_open_collective(
        self, session: AsyncSession, organization: Organization, user: User
    ) -> None:
        account = Account(
            account_type=AccountType.open_collective,
            organization_id=organization.id,
            admin_id=user.id,
            country="US",
            currency="usd",
            is_details_submitted=False,
            is_charges_enabled=False,
            is_payouts_enabled=False,
            open_collective_slug="polarsource",
        )
        session.add(account)
        await session.commit()

        transfer_transactions = await create_transfer_transactions(
            session, destination_account=account
        )

        (
            outgoing,
            incoming,
        ) = await transfer_transaction_service.create_reversal_transfer(
            session,
            transfer_transactions=transfer_transactions,
            destination_currency="usd",
            amount=1000,
        )

        assert outgoing.account_id == account.id
        assert outgoing.type == TransactionType.transfer
        assert outgoing.processor == PaymentProcessor.open_collective
        assert outgoing.amount == -1000
        assert incoming.account_id is None
        assert incoming.type == TransactionType.transfer
        assert incoming.processor == PaymentProcessor.open_collective
        assert incoming.amount == 1000

        assert outgoing.transfer_correlation_key == incoming.transfer_correlation_key
