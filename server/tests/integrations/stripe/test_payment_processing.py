from copy import deepcopy
from unittest.mock import AsyncMock

import pytest
from dramatiq import Retry
from pytest_mock import MockerFixture
from sqlalchemy.ext.asyncio import AsyncSession as SQLAlchemyAsyncSession

from polar.enums import PaymentProcessor, TaxProcessor
from polar.integrations.stripe.tasks import charge_succeeded
from polar.kit.address import Address, CountryAlpha2
from polar.kit.utils import utc_now
from polar.models import Customer, Order, Product
from polar.models.checkout import CheckoutStatus
from polar.models.external_event import StripeEvent
from polar.models.order import OrderStatus
from polar.models.payment import PaymentStatus
from polar.models.wallet import WalletType
from polar.order.repository import OrderRepository
from polar.order.tasks import process_payment, process_tax
from polar.payment.repository import PaymentRepository
from polar.postgres import AsyncSession
from polar.tax.calculation.base import TaxRecordError
from polar.transaction.service.payment import (
    payment_transaction as payment_transaction_service,
)
from polar.transaction.tasks import create_payment as create_payment_transaction
from polar.worker import JobQueueManager
from polar.worker._sqlalchemy import SQLAlchemyMiddleware
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import (
    create_checkout,
    create_order,
    create_wallet,
    create_wallet_transaction,
)
from tests.fixtures.stripe import build_stripe_balance_transaction, build_stripe_charge


@pytest.fixture(autouse=True)
def task_sessions(session: AsyncSession, mocker: MockerFixture) -> None:
    mocker.patch.object(
        SQLAlchemyMiddleware,
        "get_async_session",
        side_effect=lambda: SQLAlchemyAsyncSession(
            bind=session.bind,
            expire_on_commit=False,
            join_transaction_mode="create_savepoint",
        ),
    )


@pytest.fixture
async def pending_order(
    save_fixture: SaveFixture, product: Product, customer: Customer
) -> Order:
    order = await create_order(
        save_fixture,
        product=product,
        customer=customer,
        status=OrderStatus.pending,
        payment_lock_acquired_at=utc_now(),
        next_payment_attempt_at=utc_now(),
        tax_processor=TaxProcessor.numeral,
        billing_address=Address(country=CountryAlpha2("MX")),
    )
    order.tax_calculation_processor_id = "tax_calculation"
    await save_fixture(order)
    return order


@pytest.fixture
async def charge_event(save_fixture: SaveFixture, pending_order: Order) -> StripeEvent:
    metadata = {
        "organization_id": str(pending_order.organization_id),
        "order_id": str(pending_order.id),
    }
    charge = build_stripe_charge(
        id="ch_processing",
        amount=pending_order.due_amount,
        metadata=metadata,
        billing_details={"email": "customer@example.com"},
        payment_method_details={"type": "card", "card": {"last4": "4242"}},
    )
    event = StripeEvent(
        task_name="stripe.webhook.charge.succeeded",
        external_id="evt_processing",
        data={
            "id": "evt_processing",
            "object": "event",
            "type": "charge.succeeded",
            "data": {"object": {**charge, "object": "charge", "metadata": metadata}},
        },
    )
    await save_fixture(event)
    return event


@pytest.mark.anyio
class TestPaymentProcessing:
    async def test_wallet_payment_and_tax_are_processed_once(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        customer: Customer,
        charge_event: StripeEvent,
        mocker: MockerFixture,
    ) -> None:
        customer.billing_address = Address(country=CountryAlpha2("FR"))
        await save_fixture(customer)
        wallet = await create_wallet(
            save_fixture, customer=customer, type=WalletType.usage
        )
        transaction = await create_wallet_transaction(
            save_fixture,
            wallet=wallet,
            amount=1000,
            tax_amount=200,
            tax_calculation_processor_id="wallet_calculation",
        )
        data = deepcopy(charge_event.data)
        data["data"]["object"]["metadata"] = {
            "organization_id": str(customer.organization_id),
            "wallet_transaction_id": str(transaction.id),
        }
        data["data"]["object"]["amount"] = 1200
        charge_event.data = data
        await save_fixture(charge_event)
        record = mocker.patch(
            "polar.order.service.tax_calculation_service.record",
            return_value=("wallet_tax_transaction", TaxProcessor.numeral),
        )

        await charge_succeeded(charge_event.id)
        payment = await PaymentRepository.from_session(session).get_by_processor_id(
            PaymentProcessor.stripe, "ch_processing"
        )
        assert payment is not None
        with pytest.raises(Retry):
            await process_tax(
                payment_id=payment.id, wallet_transaction_id=transaction.id
            )
        await process_payment(payment.id, wallet_transaction_id=transaction.id)
        await process_payment(payment.id, wallet_transaction_id=transaction.id)
        await process_tax(payment_id=payment.id, wallet_transaction_id=transaction.id)

        await session.refresh(payment)
        await session.refresh(transaction)
        assert payment.order_id is not None
        assert payment.order_id == transaction.order_id
        order = await OrderRepository.from_session(session).get_by_id(payment.order_id)
        assert order is not None
        assert order.paid
        assert order.tax_transaction_processor_id == "wallet_tax_transaction"
        assert record.call_args.kwargs["reference"] == str(order.id)
        record.assert_awaited_once()

    async def test_creates_ledger_transaction_from_saved_payment(
        self,
        session: AsyncSession,
        charge_event: StripeEvent,
        mocker: MockerFixture,
    ) -> None:
        await charge_succeeded(charge_event.id)
        payment = await PaymentRepository.from_session(session).get_by_processor_id(
            PaymentProcessor.stripe, "ch_processing"
        )
        assert payment is not None
        charge = build_stripe_charge(
            id=payment.processor_id,
            amount=payment.amount,
            balance_transaction="txn_balance",
        )
        get_charge = mocker.patch(
            "polar.transaction.tasks.stripe_service.get_charge", return_value=charge
        )
        mocker.patch(
            "polar.transaction.service.payment.stripe_service.get_balance_transaction",
            return_value=build_stripe_balance_transaction(amount=charge.amount),
        )

        await create_payment_transaction(payment.id)

        transaction = await payment_transaction_service.get_by_charge_id(
            session, charge.id
        )
        assert transaction is not None
        assert transaction.presentment_amount == charge.amount
        get_charge.assert_awaited_once_with(payment.processor_id)

    async def test_tax_failure_does_not_rollback_payment_or_fulfillment(
        self,
        session: AsyncSession,
        charge_event: StripeEvent,
        pending_order: Order,
        mocker: MockerFixture,
    ) -> None:
        record = mocker.patch(
            "polar.order.service.tax_calculation_service.record",
            side_effect=TaxRecordError("Numeral unavailable"),
        )
        stripe_charge = mocker.patch(
            "polar.order.service.stripe_service.get_charge",
            side_effect=AssertionError(
                "Business processing must not load a Stripe charge"
            ),
        )

        await charge_succeeded(charge_event.id)
        await session.refresh(charge_event)
        assert charge_event.handled_at is not None
        repository = PaymentRepository.from_session(session)
        payment = await repository.get_by_processor_id(
            PaymentProcessor.stripe, "ch_processing"
        )
        assert payment is not None
        assert payment.status == PaymentStatus.succeeded
        await session.refresh(pending_order)
        assert pending_order.status == OrderStatus.pending
        record.assert_not_awaited()

        await process_payment(payment.id)
        await session.refresh(pending_order)
        assert pending_order.paid
        assert pending_order.payment_lock_acquired_at is None
        record.assert_not_awaited()

        with pytest.raises(TaxRecordError):
            await process_tax(payment_id=payment.id)
        await session.refresh(pending_order)
        await session.refresh(payment)
        assert pending_order.paid
        assert payment.status == PaymentStatus.succeeded
        assert pending_order.tax_transaction_processor_id is None

        record.side_effect = None
        record.return_value = ("tax_transaction", TaxProcessor.numeral)
        await process_tax(payment_id=payment.id)
        await process_tax(payment_id=payment.id)
        await process_payment(payment.id)
        await session.refresh(pending_order)
        assert pending_order.tax_transaction_processor_id == "tax_transaction"
        assert record.await_count == 2
        stripe_charge.assert_not_awaited()

    async def test_handled_event_can_republish_after_queue_failure(
        self,
        session: AsyncSession,
        charge_event: StripeEvent,
        mocker: MockerFixture,
    ) -> None:
        enqueue = mocker.patch("polar.integrations.stripe.payment.enqueue_job")
        flush: AsyncMock = mocker.patch.object(
            JobQueueManager, "flush", side_effect=RuntimeError("Queue unavailable")
        )
        with pytest.raises(RuntimeError, match="Queue unavailable"):
            await charge_succeeded(charge_event.id)
        await session.refresh(charge_event)
        assert charge_event.handled_at is not None
        repository = PaymentRepository.from_session(session)
        payment = await repository.get_by_processor_id(
            PaymentProcessor.stripe, "ch_processing"
        )
        assert payment is not None
        assert payment.status == PaymentStatus.succeeded

        flush.side_effect = None
        await charge_succeeded(charge_event.id)

        assert enqueue.call_count == 4
        assert payment.order_id is not None
        assert len(await repository.get_all_by_order(payment.order_id)) == 1

    async def test_tax_waits_for_checkout_order_and_preserves_reference(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        customer: Customer,
        product_one_time: Product,
        charge_event: StripeEvent,
        mocker: MockerFixture,
    ) -> None:
        customer.billing_address = Address(country=CountryAlpha2("FR"))
        await save_fixture(customer)
        checkout = await create_checkout(
            save_fixture,
            products=[product_one_time],
            customer=customer,
            status=CheckoutStatus.confirmed,
        )
        checkout.tax_processor = TaxProcessor.numeral
        checkout.tax_processor_id = "checkout_calculation"
        await save_fixture(checkout)
        data = deepcopy(charge_event.data)
        data["data"]["object"]["metadata"] = {
            "organization_id": str(product_one_time.organization_id),
            "checkout_id": str(checkout.id),
        }
        data["data"]["object"]["amount"] = checkout.total_amount
        charge_event.data = data
        await save_fixture(charge_event)
        record = mocker.patch(
            "polar.order.service.tax_calculation_service.record",
            return_value=("checkout_tax_transaction", TaxProcessor.numeral),
        )

        await charge_succeeded(charge_event.id)
        repository = PaymentRepository.from_session(session)
        payment = await repository.get_by_processor_id(
            PaymentProcessor.stripe, "ch_processing"
        )
        assert payment is not None
        assert payment.order_id is None
        with pytest.raises(Retry):
            await process_tax(payment_id=payment.id)

        await process_payment(payment.id)
        await process_tax(payment_id=payment.id)
        await process_payment(payment.id)

        await session.refresh(payment)
        assert payment.order_id is not None
        order = await OrderRepository.from_session(session).get_by_id(payment.order_id)
        assert order is not None
        assert order.paid
        assert order.tax_transaction_processor_id == "checkout_tax_transaction"
        assert record.call_args.kwargs["reference"] == f"checkout:{checkout.id}"
        record.assert_awaited_once()
