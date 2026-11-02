from copy import deepcopy
from unittest.mock import AsyncMock
from uuid import uuid4

import pytest
from pytest_mock import MockerFixture
from sqlalchemy.ext.asyncio import AsyncSession as SQLAlchemyAsyncSession

from polar.checkout.repository import CheckoutRepository
from polar.enums import PaymentProcessor, TaxProcessor
from polar.integrations.stripe.tasks import charge_succeeded, setup_intent_succeeded
from polar.kit.address import Address, CountryAlpha2
from polar.kit.trial import TrialInterval
from polar.kit.utils import utc_now
from polar.models import Checkout, Customer, Order, Product
from polar.models.checkout import CheckoutStatus
from polar.models.external_event import StripeEvent
from polar.models.order import OrderStatus
from polar.models.payment import PaymentStatus
from polar.models.wallet import WalletType
from polar.order.repository import OrderRepository
from polar.order.tasks import (
    CheckoutDoesNotExist,
    PaymentNotSucceeded,
    WalletTransactionDoesNotExist,
    process_payment,
    process_tax,
)
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
from tests.fixtures.stripe import (
    build_stripe_balance_transaction,
    build_stripe_charge,
    build_stripe_payment_method,
)


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
    @pytest.mark.parametrize(
        ("relationship", "error"),
        [
            ("checkout_id", CheckoutDoesNotExist),
            ("wallet_transaction_id", WalletTransactionDoesNotExist),
        ],
    )
    async def test_missing_relationship_has_dedicated_error(
        self, relationship: str, error: type[Exception]
    ) -> None:
        with pytest.raises(error):
            await process_payment(**{relationship: uuid4()})

    async def test_unsuccessful_payment_has_dedicated_error(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        charge_event: StripeEvent,
    ) -> None:
        await charge_succeeded(charge_event.id)
        payment = await PaymentRepository.from_session(session).get_by_processor_id(
            PaymentProcessor.stripe, "ch_processing"
        )
        assert payment is not None
        payment.status = PaymentStatus.failed
        await save_fixture(payment)

        with pytest.raises(PaymentNotSucceeded):
            await process_payment(payment.id)

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
        assert payment.order_id is None
        await process_payment(payment.id, wallet_transaction_id=transaction.id)
        await process_payment(payment.id, wallet_transaction_id=transaction.id)
        await session.refresh(payment)
        assert payment.order_id is not None
        await process_tax(payment.order_id)

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
            await process_tax(pending_order.id)
        await session.refresh(pending_order)
        await session.refresh(payment)
        assert pending_order.paid
        assert payment.status == PaymentStatus.succeeded
        assert pending_order.tax_transaction_processor_id is None

        record.side_effect = None
        record.return_value = ("tax_transaction", TaxProcessor.numeral)
        await process_tax(pending_order.id)
        await process_tax(pending_order.id)
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

        assert enqueue.call_count == 2
        assert payment.order_id is not None
        assert len(await repository.get_all_by_order(payment.order_id)) == 1

    async def test_tax_is_queued_by_order_after_checkout_processing(
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
        store_enqueue = mocker.patch("polar.integrations.stripe.payment.enqueue_job")
        process_enqueue = mocker.patch("polar.order.tasks.enqueue_job")

        await charge_succeeded(charge_event.id)
        store_enqueue.assert_called_once()
        assert store_enqueue.call_args.args == ("order.process_payment",)
        repository = PaymentRepository.from_session(session)
        payment = await repository.get_by_processor_id(
            PaymentProcessor.stripe, "ch_processing"
        )
        assert payment is not None
        assert payment.order_id is None
        record.assert_not_awaited()

        await process_payment(payment.id)
        await session.refresh(payment)
        assert payment.order_id is not None
        process_enqueue.assert_any_call("order.process_tax", order_id=payment.order_id)
        await process_tax(payment.order_id)
        await process_payment(payment.id)

        await session.refresh(payment)
        assert payment.order_id is not None
        order = await OrderRepository.from_session(session).get_by_id(payment.order_id)
        assert order is not None
        assert order.paid
        assert order.tax_transaction_processor_id == "checkout_tax_transaction"
        assert record.call_args.kwargs["reference"] == f"checkout:{checkout.id}"
        record.assert_awaited_once()


@pytest.fixture
async def setup_context(
    save_fixture: SaveFixture,
    product: Product,
    customer: Customer,
    mocker: MockerFixture,
) -> tuple[StripeEvent, Checkout]:
    checkout = await create_checkout(
        save_fixture,
        products=[product],
        customer=customer,
        status=CheckoutStatus.confirmed,
        trial_interval=TrialInterval.month,
        trial_interval_count=1,
        payment_processor_metadata={"intent_client_secret": "setup_secret"},
    )
    event = StripeEvent(
        task_name="stripe.webhook.setup_intent.succeeded",
        external_id="evt_setup_processing",
        data={
            "id": "evt_setup_processing",
            "object": "event",
            "type": "setup_intent.succeeded",
            "data": {
                "object": {
                    "object": "setup_intent",
                    "id": "seti_processing",
                    "client_secret": "setup_secret",
                    "payment_method": "pm_setup",
                    "metadata": {
                        "organization_id": str(customer.organization_id),
                        "checkout_id": str(checkout.id),
                    },
                }
            },
        },
    )
    await save_fixture(event)
    mocker.patch(
        "polar.payment_method.service.stripe_service.get_payment_method",
        return_value=build_stripe_payment_method(
            details={"brand": "visa", "last4": "4242", "fingerprint": "fp_setup"}
        ),
    )
    return event, checkout


@pytest.mark.anyio
class TestSetupProcessing:
    async def test_setup_retry_requeues_tax_for_existing_order(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        customer: Customer,
        setup_context: tuple[StripeEvent, Checkout],
        product_recurring_free_price: Product,
        mocker: MockerFixture,
    ) -> None:
        event, _ = setup_context
        customer.billing_address = Address(country=CountryAlpha2("FR"))
        await save_fixture(customer)
        checkout = await create_checkout(
            save_fixture,
            products=[product_recurring_free_price],
            customer=customer,
            status=CheckoutStatus.confirmed,
            payment_processor_metadata={"intent_client_secret": "setup_secret"},
        )
        checkout.tax_processor = TaxProcessor.numeral
        checkout.tax_processor_id = "setup_calculation"
        await save_fixture(checkout)
        data = deepcopy(event.data)
        data["data"]["object"]["metadata"]["checkout_id"] = str(checkout.id)
        event.data = data
        await save_fixture(event)
        store_enqueue = mocker.patch("polar.integrations.stripe.payment.enqueue_job")
        await setup_intent_succeeded(event.id)
        context = store_enqueue.call_args.kwargs
        flush = mocker.patch.object(
            JobQueueManager, "flush", side_effect=RuntimeError("Queue unavailable")
        )

        with pytest.raises(RuntimeError, match="Queue unavailable"):
            await process_payment(**context)

        flush.side_effect = None
        process_enqueue = mocker.patch("polar.order.tasks.enqueue_job")
        await process_payment(**context)

        order = await OrderRepository.from_session(session).get_earliest_by_checkout_id(
            checkout.id
        )
        assert order is not None
        assert order.paid
        process_enqueue.assert_any_call("order.process_tax", order_id=order.id)

    async def test_setup_defers_purchase_with_saved_payment_method(
        self,
        session: AsyncSession,
        setup_context: tuple[StripeEvent, Checkout],
        mocker: MockerFixture,
    ) -> None:
        event, checkout = setup_context
        enqueue = mocker.patch("polar.integrations.stripe.payment.enqueue_job")

        await setup_intent_succeeded(event.id)

        await session.refresh(event)
        await session.refresh(checkout)
        assert event.handled_at is not None
        assert checkout.status == CheckoutStatus.confirmed
        enqueue.assert_called_once()
        assert enqueue.call_args.args == ("order.process_payment",)
        context = enqueue.call_args.kwargs
        assert context["payment_id"] is None
        assert context["checkout_id"] == checkout.id
        assert context["payment_method_id"] is not None

        await process_payment(**context)

        await session.refresh(checkout)
        processed_checkout = await CheckoutRepository.from_session(session).get_by_id(
            checkout.id
        )
        assert processed_checkout is not None
        assert processed_checkout.status == CheckoutStatus.succeeded
        order = await OrderRepository.from_session(session).get_earliest_by_checkout_id(
            checkout.id,
            options=OrderRepository.from_session(session).get_eager_options(),
        )
        assert order is not None
        assert order.subscription is not None
        assert order.subscription.payment_method_id == context["payment_method_id"]

    @pytest.mark.parametrize("reason", ["expired", "changed_intent", "trial_abuse"])
    async def test_outdated_setup_is_handled_without_processing(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        setup_context: tuple[StripeEvent, Checkout],
        mocker: MockerFixture,
        reason: str,
    ) -> None:
        event, checkout = setup_context
        if reason == "expired":
            checkout.status = CheckoutStatus.expired
        elif reason == "changed_intent":
            checkout.payment_processor_metadata = {
                "intent_client_secret": "new_setup_secret"
            }
        else:
            checkout.status = CheckoutStatus.open
            mocker.patch(
                "polar.integrations.stripe.payment.stripe_service.get_setup_intent",
                return_value=mocker.Mock(
                    metadata={"polar_trial_abuse_detected": "true"}
                ),
            )
        await save_fixture(checkout)
        enqueue = mocker.patch("polar.integrations.stripe.payment.enqueue_job")

        await setup_intent_succeeded(event.id)

        await session.refresh(event)
        assert event.handled_at is not None
        enqueue.assert_not_called()
