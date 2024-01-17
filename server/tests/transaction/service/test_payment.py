from unittest.mock import MagicMock

import pytest
import stripe as stripe_lib
from pytest_mock import MockerFixture

from polar.integrations.stripe.schemas import ProductType
from polar.integrations.stripe.service import StripeService
from polar.models import Organization, Pledge, User
from polar.models.transaction import PaymentProcessor, TransactionType
from polar.postgres import AsyncSession
from polar.transaction.service.payment import (
    PledgeDoesNotExist,
    SubscriptionDoesNotExist,
)
from polar.transaction.service.payment import (
    payment_transaction as payment_transaction_service,
)
from tests.fixtures.random_objects import create_subscription, create_subscription_tier


def build_stripe_balance_transaction(
    *,
    fee: int | None = 100,
) -> stripe_lib.BalanceTransaction:
    return stripe_lib.BalanceTransaction.construct_from(
        {"id": "STRIPE_BALANCE_TRANSACTION_ID", "fee": fee}, None
    )


def build_stripe_invoice(
    *, tax: int | None = 100, subscription: str | None = None
) -> stripe_lib.Invoice:
    return stripe_lib.Invoice.construct_from(
        {
            "id": "STRIPE_INVOICE_ID",
            "tax": tax,
            "subscription": subscription,
            "total_tax_amounts": [{"tax_rate": {"country": "US", "state": "NY"}}],
        },
        None,
    )


def build_stripe_charge(
    *,
    customer: str | None = None,
    invoice: str | None = None,
    payment_intent: str | None = None,
    balance_transaction: str | None = None,
    type: ProductType | None = None,
) -> stripe_lib.Charge:
    return stripe_lib.Charge.construct_from(
        {
            "id": "STRIPE_CHARGE_ID",
            "customer": customer,
            "currency": "usd",
            "amount": 1100,
            "invoice": invoice,
            "payment_intent": payment_intent,
            "balance_transaction": balance_transaction,
            "metadata": {"type": type} if type is not None else {},
        },
        None,
    )


@pytest.fixture(autouse=True)
def stripe_service_mock(mocker: MockerFixture) -> MagicMock:
    mock = MagicMock(spec=StripeService)
    mocker.patch("polar.transaction.service.payment.stripe_service", new=mock)
    return mock


@pytest.mark.asyncio
class TestCreatePayment:
    async def test_customer_user(
        self,
        session: AsyncSession,
        pledge: Pledge,
        user: User,
        stripe_service_mock: MagicMock,
    ) -> None:
        user.stripe_customer_id = "STRIPE_CUSTOMER_ID"
        session.add(user)
        pledge.payment_id = "STRIPE_PAYMENT_ID"
        session.add(pledge)
        await session.commit()

        stripe_balance_transaction = build_stripe_balance_transaction()
        stripe_charge = build_stripe_charge(
            customer=user.stripe_customer_id,
            payment_intent=pledge.payment_id,
            balance_transaction=stripe_balance_transaction.id,
        )

        stripe_service_mock.get_balance_transaction.return_value = (
            stripe_balance_transaction
        )

        # then
        session.expunge_all()

        transaction = await payment_transaction_service.create_payment(
            session, charge=stripe_charge
        )

        assert transaction.type == TransactionType.payment
        assert transaction.customer_id == user.stripe_customer_id
        assert transaction.payment_user_id == user.id
        assert transaction.payment_organization_id is None

    async def test_customer_organization(
        self,
        session: AsyncSession,
        pledge: Pledge,
        organization: Organization,
        stripe_service_mock: MagicMock,
    ) -> None:
        organization.stripe_customer_id = "STRIPE_CUSTOMER_ID"
        session.add(organization)
        pledge.by_organization = organization
        pledge.payment_id = "STRIPE_PAYMENT_ID"
        session.add(pledge)
        await session.commit()

        stripe_balance_transaction = build_stripe_balance_transaction()
        stripe_charge = build_stripe_charge(
            customer=organization.stripe_customer_id,
            payment_intent=pledge.payment_id,
            balance_transaction=stripe_balance_transaction.id,
        )

        stripe_service_mock.get_balance_transaction.return_value = (
            stripe_balance_transaction
        )

        # then
        session.expunge_all()

        transaction = await payment_transaction_service.create_payment(
            session, charge=stripe_charge
        )

        assert transaction.type == TransactionType.payment
        assert transaction.customer_id == organization.stripe_customer_id
        assert transaction.payment_user_id is None
        assert transaction.payment_organization_id == organization.id

    async def test_not_existing_subscription(
        self, session: AsyncSession, stripe_service_mock: MagicMock
    ) -> None:
        stripe_invoice = build_stripe_invoice(subscription="NOT_EXISTING_SUBSCRIPTION")
        stripe_charge = build_stripe_charge(invoice=stripe_invoice.id)

        stripe_service_mock.get_invoice.return_value = stripe_invoice

        # then
        session.expunge_all()

        with pytest.raises(SubscriptionDoesNotExist):
            await payment_transaction_service.create_payment(
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

        # then
        session.expunge_all()

        transaction = await payment_transaction_service.create_payment(
            session, charge=stripe_charge
        )

        assert transaction.type == TransactionType.payment
        assert transaction.processor == PaymentProcessor.stripe
        assert transaction.currency == stripe_charge.currency
        assert transaction.amount == stripe_charge.amount - (stripe_invoice.tax or 0)
        assert transaction.tax_amount == stripe_invoice.tax
        assert transaction.tax_country == "US"
        assert transaction.tax_state == "NY"
        assert transaction.processor_fee_amount == stripe_balance_transaction.fee
        assert transaction.charge_id == stripe_charge.id
        assert transaction.subscription_id == subscription.id
        assert transaction.pledge_id is None

    async def test_not_existing_pledge(
        self, session: AsyncSession, pledge: Pledge, stripe_service_mock: MagicMock
    ) -> None:
        stripe_balance_transaction = build_stripe_balance_transaction()
        stripe_charge = build_stripe_charge(
            payment_intent="NOT_EXISTING_PAYMENT_INTENT",
            balance_transaction=stripe_balance_transaction.id,
            type=ProductType.pledge,
        )

        stripe_service_mock.get_balance_transaction.return_value = (
            stripe_balance_transaction
        )

        # then
        session.expunge_all()

        with pytest.raises(PledgeDoesNotExist):
            await payment_transaction_service.create_payment(
                session, charge=stripe_charge
            )

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
            type=ProductType.pledge,
        )

        stripe_service_mock.get_balance_transaction.return_value = (
            stripe_balance_transaction
        )

        # then
        session.expunge_all()

        transaction = await payment_transaction_service.create_payment(
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

    async def test_anonymous_pledge(
        self, session: AsyncSession, pledge: Pledge, stripe_service_mock: MagicMock
    ) -> None:
        pledge.payment_id = "STRIPE_PAYMENT_ID"
        session.add(pledge)
        await session.commit()

        stripe_balance_transaction = build_stripe_balance_transaction()
        stripe_charge = build_stripe_charge(
            customer="GUEST_CUSTOMER_ID",
            payment_intent=pledge.payment_id,
            balance_transaction=stripe_balance_transaction.id,
            type=ProductType.pledge,
        )

        stripe_service_mock.get_balance_transaction.return_value = (
            stripe_balance_transaction
        )

        # then
        session.expunge_all()

        transaction = await payment_transaction_service.create_payment(
            session, charge=stripe_charge
        )

        assert transaction.type == TransactionType.payment
        assert transaction.pledge_id == pledge.id
        assert transaction.payment_user_id == pledge.by_user_id
        assert transaction.payment_organization_id == pledge.by_organization_id
