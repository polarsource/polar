from unittest.mock import MagicMock

import pytest
from pytest_mock import MockerFixture

from polar.integrations.stripe.schemas import ProductType
from polar.integrations.stripe.service import StripeService
from polar.models import Customer, Transaction
from polar.models.transaction import Processor, TransactionType
from polar.postgres import AsyncSession
from polar.transaction.service.payment import (
    payment_transaction as payment_transaction_service,
)
from tests.fixtures.database import SaveFixture
from tests.fixtures.stripe import build_stripe_balance_transaction, build_stripe_charge


@pytest.fixture(autouse=True)
def stripe_service_mock(mocker: MockerFixture) -> MagicMock:
    mock = MagicMock(spec=StripeService)
    mocker.patch("polar.transaction.service.payment.stripe_service", new=mock)
    return mock


@pytest.fixture
def enqueue_job_mock(mocker: MockerFixture) -> MagicMock:
    return mocker.patch("polar.transaction.service.payment.enqueue_job")


@pytest.mark.asyncio
class TestCreatePayment:
    async def test_existing_transaction(
        self,
        stripe_service_mock: MagicMock,
        enqueue_job_mock: MagicMock,
        session: AsyncSession,
        save_fixture: SaveFixture,
        customer: Customer,
    ) -> None:
        stripe_balance_transaction = build_stripe_balance_transaction()
        stripe_charge = build_stripe_charge(
            customer=customer.stripe_customer_id,
            payment_intent="STRIPE_PAYMENT_ID",
            balance_transaction=stripe_balance_transaction.id,
        )
        stripe_service_mock.get_balance_transaction.return_value = (
            stripe_balance_transaction
        )

        existing_transaction = Transaction(
            type=TransactionType.payment,
            processor=Processor.stripe,
            currency=stripe_charge.currency,
            amount=stripe_charge.amount,
            account_currency=stripe_charge.currency,
            account_amount=stripe_charge.amount,
            tax_amount=0,
            charge_id=stripe_charge.id,
        )
        await save_fixture(existing_transaction)

        transaction = await payment_transaction_service.create_payment(
            session, charge=stripe_charge
        )

        assert transaction.id == existing_transaction.id
        enqueue_job_mock.assert_not_called()

    @pytest.mark.parametrize(
        ("risk_level", "risk_score"),
        [
            pytest.param(None, None),
            pytest.param("normal", 20),
            pytest.param("normal", 4),
        ],
    )
    async def test_customer(
        self,
        session: AsyncSession,
        customer: Customer,
        stripe_service_mock: MagicMock,
        enqueue_job_mock: MagicMock,
        risk_level: str | None,
        risk_score: int | None,
    ) -> None:
        stripe_balance_transaction = build_stripe_balance_transaction()
        stripe_charge = build_stripe_charge(
            customer=customer.stripe_customer_id,
            payment_intent="STRIPE_PAYMENT_ID",
            balance_transaction=stripe_balance_transaction.id,
            outcome={
                "risk_level": risk_level,
                "risk_score": risk_score,
            },
        )
        stripe_service_mock.get_balance_transaction.return_value = (
            stripe_balance_transaction
        )

        transaction = await payment_transaction_service.create_payment(
            session, charge=stripe_charge
        )

        assert transaction.type == TransactionType.payment
        assert transaction.customer_id == stripe_charge.customer
        assert transaction.payment_customer is None
        assert transaction.payment_organization is None
        assert transaction.risk_level == risk_level
        assert transaction.risk_score == risk_score

        enqueue_job_mock.assert_called_once_with(
            "processor_fee.create_payment_fees", transaction.id
        )

    async def test_tax_metadata(
        self,
        session: AsyncSession,
        enqueue_job_mock: MagicMock,
        stripe_service_mock: MagicMock,
    ) -> None:
        stripe_balance_transaction = build_stripe_balance_transaction()
        stripe_charge = build_stripe_charge(
            customer="GUEST_CUSTOMER_ID",
            payment_intent="STRIPE_PAYMENT_ID",
            balance_transaction=stripe_balance_transaction.id,
            type=ProductType.product,
            metadata={"tax_country": "US", "tax_state": "NY", "tax_amount": "100"},
        )
        stripe_service_mock.get_balance_transaction.return_value = (
            stripe_balance_transaction
        )

        transaction = await payment_transaction_service.create_payment(
            session, charge=stripe_charge
        )

        assert transaction.type == TransactionType.payment
        assert transaction.tax_amount == 100
        assert transaction.tax_country == "US"
        assert transaction.tax_state == "NY"

        enqueue_job_mock.assert_called_once_with(
            "processor_fee.create_payment_fees", transaction.id
        )

    async def test_different_settlement_currency(
        self,
        session: AsyncSession,
        enqueue_job_mock: MagicMock,
        stripe_service_mock: MagicMock,
    ) -> None:
        stripe_balance_transaction = build_stripe_balance_transaction(
            amount=1800, currency="usd", exchange_rate=1.5
        )
        stripe_charge = build_stripe_charge(
            amount=1200,
            currency="eur",
            customer="GUEST_CUSTOMER_ID",
            payment_intent="STRIPE_PAYMENT_ID",
            balance_transaction=stripe_balance_transaction.id,
            type=ProductType.product,
            metadata={"tax_country": "FR", "tax_amount": "200"},
        )
        stripe_service_mock.get_balance_transaction.return_value = (
            stripe_balance_transaction
        )

        transaction = await payment_transaction_service.create_payment(
            session, charge=stripe_charge
        )

        assert transaction.type == TransactionType.payment
        assert transaction.amount == transaction.account_amount == 1500
        assert transaction.tax_amount == 300
        assert transaction.currency == transaction.account_currency == "usd"
        assert transaction.presentment_currency == "eur"
        assert transaction.presentment_amount == 1000
        assert transaction.presentment_tax_amount == 200

        enqueue_job_mock.assert_called_once_with(
            "processor_fee.create_payment_fees", transaction.id
        )
