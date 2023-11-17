from types import SimpleNamespace
from unittest.mock import MagicMock

import pytest
import stripe as stripe_lib
from pytest_mock import MockerFixture

from polar.enums import AccountType
from polar.integrations.stripe.service import StripeService
from polar.models import Account, Organization, Pledge, User
from polar.models.transaction import PaymentProcessor, TransactionType
from polar.postgres import AsyncSession
from polar.transaction.service import (
    StripeNotConfiguredOnDestinationAccount,
    SubscriptionDoesNotExist,
    UnsupportedAccountType,
)
from polar.transaction.service import transaction as transaction_service
from tests.subscription.conftest import create_subscription, create_subscription_tier


def build_stripe_balance_transaction(
    *, fee: int | None = 100
) -> stripe_lib.BalanceTransaction:
    return stripe_lib.BalanceTransaction.construct_from(
        {"id": "STRIPE_BALANCE_TRANSACTION_ID", "fee": fee}, None
    )


def build_stripe_invoice(
    *, tax: int | None = 100, subscription: str | None = None
) -> stripe_lib.Invoice:
    return stripe_lib.Invoice.construct_from(
        {"id": "STRIPE_INVOICE_ID", "tax": tax, "subscription": subscription}, None
    )


def build_stripe_charge(
    *,
    invoice: str | None = None,
    payment_intent: str | None = None,
    balance_transaction: str | None = None,
) -> stripe_lib.Charge:
    return stripe_lib.Charge.construct_from(
        {
            "id": "STRIPE_CHARGE_ID",
            "currency": "usd",
            "amount": 1100,
            "invoice": invoice,
            "payment_intent": payment_intent,
            "balance_transaction": balance_transaction,
        },
        None,
    )


@pytest.fixture(autouse=True)
def stripe_service_mock(mocker: MockerFixture) -> MagicMock:
    mock = MagicMock(spec=StripeService)
    mocker.patch("polar.transaction.service.stripe_service", new=mock)
    return mock


@pytest.mark.asyncio
class TestStripeHandlePayment:
    async def test_not_existing_subscription(
        self, session: AsyncSession, stripe_service_mock: MagicMock
    ) -> None:
        stripe_invoice = build_stripe_invoice(subscription="NOT_EXISTING_SUBSCRIPTION")
        stripe_charge = build_stripe_charge(invoice=stripe_invoice.id)

        stripe_service_mock.get_invoice.return_value = stripe_invoice

        with pytest.raises(SubscriptionDoesNotExist):
            await transaction_service.stripe_handle_payment(
                session, charge=stripe_charge
            )

    async def test_subscription(
        self,
        session: AsyncSession,
        organization: Organization,
        user: User,
        stripe_service_mock: MagicMock,
    ) -> None:
        subscription_tier = await create_subscription_tier(
            session, organization=organization
        )
        subscription = await create_subscription(
            session, subscription_tier=subscription_tier, user=user
        )
        stripe_invoice = build_stripe_invoice(
            subscription=subscription.stripe_subscription_id
        )
        stripe_balance_transaction = build_stripe_balance_transaction()
        stripe_charge = build_stripe_charge(
            invoice=stripe_invoice.id, balance_transaction=stripe_balance_transaction.id
        )

        stripe_service_mock.get_invoice.return_value = stripe_invoice
        stripe_service_mock.get_balance_transaction.return_value = (
            stripe_balance_transaction
        )

        transaction = await transaction_service.stripe_handle_payment(
            session, charge=stripe_charge
        )

        assert transaction.type == TransactionType.payment
        assert transaction.processor == PaymentProcessor.stripe
        assert transaction.currency == stripe_charge.currency
        assert transaction.amount == stripe_charge.amount - (stripe_invoice.tax or 0)
        assert transaction.processor_fee_amount == stripe_balance_transaction.fee
        assert transaction.charge_id == stripe_charge.id
        assert transaction.subscription_id == subscription.id
        assert transaction.pledge_id is None

    async def test_pledge(
        self, session: AsyncSession, pledge: Pledge, stripe_service_mock: MagicMock
    ) -> None:
        pledge.payment_id = "STRIPE_PAYMENT_ID"
        session.add(pledge)
        await session.commit()

        stripe_balance_transaction = build_stripe_balance_transaction()
        stripe_charge = build_stripe_charge(
            payment_intent=pledge.payment_id,
            balance_transaction=stripe_balance_transaction.id,
        )

        stripe_service_mock.get_balance_transaction.return_value = (
            stripe_balance_transaction
        )

        transaction = await transaction_service.stripe_handle_payment(
            session, charge=stripe_charge
        )

        assert transaction.type == TransactionType.payment
        assert transaction.processor == PaymentProcessor.stripe
        assert transaction.currency == stripe_charge.currency
        assert transaction.amount == stripe_charge.amount
        assert transaction.processor_fee_amount == stripe_balance_transaction.fee
        assert transaction.charge_id == stripe_charge.id
        assert transaction.pledge_id == pledge.id
        assert transaction.subscription_id is None


@pytest.mark.asyncio
class TestHandleTransfer:
    async def test_unsupported_account_type(
        self, session: AsyncSession, organization: Organization, user: User
    ) -> None:
        account = Account(
            account_type="UNKNOWN",
            organization_id=organization.id,
            admin_id=user.id,
            country="US",
            currency="USD",
        )

        with pytest.raises(UnsupportedAccountType):
            await transaction_service.handle_transfer(
                session,
                destination_account=account,
                currency="usd",
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
            currency="USD",
            is_details_submitted=False,
            is_charges_enabled=False,
            is_payouts_enabled=False,
            stripe_id=None,
        )

        with pytest.raises(StripeNotConfiguredOnDestinationAccount):
            await transaction_service.handle_transfer(
                session,
                destination_account=account,
                currency="usd",
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
            currency="USD",
            is_details_submitted=True,
            is_charges_enabled=True,
            is_payouts_enabled=True,
            stripe_id="STRIPE_ACCOUNT_ID",
        )
        session.add(account)
        await session.commit()

        stripe_service_mock.transfer.return_value = SimpleNamespace(
            id="STRIPE_TRANSFER_ID"
        )

        outgoing, incoming = await transaction_service.handle_transfer(
            session,
            destination_account=account,
            currency="usd",
            amount=1000,
        )

        assert outgoing.account_id is None
        assert outgoing.type == TransactionType.transfer
        assert outgoing.processor == PaymentProcessor.stripe
        assert outgoing.amount == -1000
        assert outgoing.transfer_id == "STRIPE_TRANSFER_ID"

        assert incoming.account_id == account.id
        assert incoming.type == TransactionType.transfer
        assert incoming.processor == PaymentProcessor.stripe
        assert incoming.amount == 1000
        assert incoming.transfer_id == "STRIPE_TRANSFER_ID"

    async def test_open_collective(
        self,
        session: AsyncSession,
        organization: Organization,
        user: User,
        stripe_service_mock: MagicMock,
    ) -> None:
        account = Account(
            account_type=AccountType.open_collective,
            organization_id=organization.id,
            admin_id=user.id,
            country="US",
            currency="USD",
            is_details_submitted=False,
            is_charges_enabled=False,
            is_payouts_enabled=False,
            open_collective_slug="polarsource",
        )
        session.add(account)
        await session.commit()

        outgoing, incoming = await transaction_service.handle_transfer(
            session,
            destination_account=account,
            currency="usd",
            amount=1000,
        )

        assert outgoing.account_id is None
        assert outgoing.type == TransactionType.transfer
        assert outgoing.processor == PaymentProcessor.open_collective
        assert outgoing.amount == -1000

        assert incoming.account_id == account.id
        assert incoming.type == TransactionType.transfer
        assert incoming.processor == PaymentProcessor.open_collective
        assert incoming.amount == 1000
