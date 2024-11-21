from typing import Any, cast
from unittest.mock import AsyncMock, MagicMock

import pytest
import stripe as stripe_lib
from pytest_mock import MockerFixture
from sqlalchemy.orm import joinedload

from polar.integrations.stripe.schemas import ProductType
from polar.integrations.stripe.service import StripeService
from polar.models import Organization, Pledge, Transaction, User
from polar.models.transaction import PaymentProcessor, TransactionType
from polar.postgres import AsyncSession
from polar.transaction.service.payment import (  # type: ignore[attr-defined]
    PledgeDoesNotExist,
    processor_fee_transaction_service,
)
from polar.transaction.service.payment import (
    payment_transaction as payment_transaction_service,
)
from polar.transaction.service.processor_fee import ProcessorFeeTransactionService
from tests.fixtures.database import SaveFixture


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
            "metadata": None,
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
    metadata: dict[str, str] | None = None,
    risk_level: str | None = None,
    risk_score: int | None = None,
) -> stripe_lib.Charge:
    metadata = metadata or {}
    obj: dict[str, Any] = {
        "id": "STRIPE_CHARGE_ID",
        "customer": customer,
        "currency": "usd",
        "amount": 1100,
        "invoice": invoice,
        "payment_intent": payment_intent,
        "balance_transaction": balance_transaction,
        "metadata": {"type": type, **metadata} if type is not None else metadata,
    }
    if risk_level or risk_score:
        obj["outcome"] = {
            "risk_level": risk_level if risk_level else "normal",
            "risk_score": risk_score if risk_score else 0,
        }

    return stripe_lib.Charge.construct_from(obj, None)


@pytest.fixture(autouse=True)
def stripe_service_mock(mocker: MockerFixture) -> MagicMock:
    mock = MagicMock(spec=StripeService)
    mocker.patch("polar.transaction.service.payment.stripe_service", new=mock)
    return mock


@pytest.fixture(autouse=True)
def create_payment_fees_mock(mocker: MockerFixture) -> AsyncMock:
    return mocker.patch.object(
        processor_fee_transaction_service,
        "create_payment_fees",
        spec=ProcessorFeeTransactionService.create_payment_fees,
        return_value=[],
    )


@pytest.mark.asyncio
class TestCreatePayment:
    async def test_existing_transaction(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        pledge: Pledge,
        user: User,
        stripe_service_mock: MagicMock,
    ) -> None:
        stripe_balance_transaction = build_stripe_balance_transaction()
        stripe_charge = build_stripe_charge(
            customer=user.stripe_customer_id,
            payment_intent=pledge.payment_id,
            balance_transaction=stripe_balance_transaction.id,
        )

        existing_transaction = Transaction(
            type=TransactionType.payment,
            processor=PaymentProcessor.stripe,
            currency=stripe_charge.currency,
            amount=stripe_charge.amount,
            account_currency=stripe_charge.currency,
            account_amount=stripe_charge.amount,
            tax_amount=0,
            charge_id=stripe_charge.id,
        )
        await save_fixture(existing_transaction)

        # then
        session.expunge_all()

        transaction = await payment_transaction_service.create_payment(
            session, charge=stripe_charge
        )

        assert transaction.id == existing_transaction.id

    @pytest.mark.parametrize(
        "risk",
        [
            pytest.param({"risk_level": None, "risk_score": None}),
            pytest.param({"risk_level": "normal", "risk_score": 20}),
        ],
    )
    async def test_customer_user(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        pledge: Pledge,
        user: User,
        stripe_service_mock: MagicMock,
        risk: dict[str, Any],
    ) -> None:
        user.stripe_customer_id = "STRIPE_CUSTOMER_ID"
        await save_fixture(user)
        pledge.payment_id = "STRIPE_PAYMENT_ID"
        await save_fixture(pledge)

        risk_level = risk["risk_level"]
        if risk_level:
            risk_level = str(risk_level)

        risk_score = risk["risk_score"]
        if risk_score is not None:
            risk_score = int(risk_score)

        stripe_balance_transaction = build_stripe_balance_transaction()
        stripe_charge = build_stripe_charge(
            customer=user.stripe_customer_id,
            payment_intent=pledge.payment_id,
            balance_transaction=stripe_balance_transaction.id,
            risk_level=risk_level,
            risk_score=risk_score,
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
        assert transaction.payment_user == user
        assert transaction.payment_organization is None
        assert transaction.risk_level == risk_level
        assert transaction.risk_score == risk_score

    async def test_customer_organization(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        pledge: Pledge,
        organization: Organization,
        stripe_service_mock: MagicMock,
    ) -> None:
        organization.stripe_customer_id = "STRIPE_CUSTOMER_ID"
        await save_fixture(organization)
        pledge.by_organization = organization
        pledge.payment_id = "STRIPE_PAYMENT_ID"
        await save_fixture(pledge)

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
        assert transaction.payment_user is None
        assert transaction.payment_organization == organization

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
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        pledge: Pledge,
        stripe_service_mock: MagicMock,
        create_payment_fees_mock: AsyncMock,
    ) -> None:
        pledge.payment_id = "STRIPE_PAYMENT_ID"
        await save_fixture(pledge)

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
        assert transaction.charge_id == stripe_charge.id
        assert transaction.pledge == pledge
        assert transaction.order is None

        create_payment_fees_mock.assert_awaited_once()

    async def test_anonymous_pledge(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        pledge: Pledge,
        stripe_service_mock: MagicMock,
    ) -> None:
        pledge.payment_id = "STRIPE_PAYMENT_ID"
        await save_fixture(pledge)

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

        pledge = cast(
            Pledge,
            await session.get(
                Pledge,
                pledge.id,
                options=(joinedload(Pledge.user), joinedload(Pledge.by_organization)),
            ),
        )

        assert transaction.type == TransactionType.payment
        assert transaction.pledge == pledge
        assert transaction.payment_user == pledge.user
        assert transaction.payment_organization == pledge.by_organization

    async def test_tax_metadata(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        pledge: Pledge,
        stripe_service_mock: MagicMock,
    ) -> None:
        pledge.payment_id = "STRIPE_PAYMENT_ID"
        await save_fixture(pledge)

        stripe_balance_transaction = build_stripe_balance_transaction()
        stripe_charge = build_stripe_charge(
            customer="GUEST_CUSTOMER_ID",
            payment_intent=pledge.payment_id,
            balance_transaction=stripe_balance_transaction.id,
            type=ProductType.product,
            metadata={"tax_country": "US", "tax_state": "NY", "tax_amount": "100"},
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
        assert transaction.tax_amount == 100
        assert transaction.tax_country == "US"
        assert transaction.tax_state == "NY"
