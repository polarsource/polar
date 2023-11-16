from unittest.mock import MagicMock

import pytest
import stripe as stripe_lib
from pytest_mock import MockerFixture

from polar.integrations.stripe.service import StripeService
from polar.models import Organization, Pledge, User
from polar.models.transaction import PaymentProcessor, TransactionType
from polar.postgres import AsyncSession
from polar.transaction.service import SubscriptionDoesNotExist
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
class TestReceiveStripePayment:
    async def test_not_existing_subscription(
        self, session: AsyncSession, stripe_service_mock: MagicMock
    ) -> None:
        stripe_invoice = build_stripe_invoice(subscription="NOT_EXISTING_SUBSCRIPTION")
        stripe_charge = build_stripe_charge(invoice=stripe_invoice.id)

        stripe_service_mock.get_invoice.return_value = stripe_invoice

        with pytest.raises(SubscriptionDoesNotExist):
            await transaction_service.receive_stripe_payment(
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

        transaction = await transaction_service.receive_stripe_payment(
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

        transaction = await transaction_service.receive_stripe_payment(
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
