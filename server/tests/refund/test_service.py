from collections import namedtuple
from typing import Any
from unittest.mock import MagicMock

import pytest
import stripe as stripe_lib
from httpx import AsyncClient, Response
from pytest_mock import MockerFixture

from polar.integrations.stripe.service import StripeService
from polar.models import (
    Customer,
    Order,
    Organization,
    Product,
    Transaction,
)
from polar.models.dispute import DisputeAlertProcessor
from polar.models.order import OrderStatus
from polar.models.pledge import PledgeState
from polar.models.refund import RefundReason, RefundStatus
from polar.models.webhook_endpoint import WebhookEventType
from polar.order.repository import OrderRepository
from polar.order.service import order as order_service
from polar.pledge.service import pledge as pledge_service
from polar.postgres import AsyncSession
from polar.refund.schemas import RefundCreate
from polar.refund.service import MissingRelatedDispute, RefundedAlready
from polar.refund.service import refund as refund_service
from polar.wallet.service import wallet as wallet_service
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import (
    create_dispute,
    create_order,
    create_order_and_payment,
    create_payment,
    create_payment_transaction,
    create_pledge,
    create_refund,
    create_user,
    create_wallet_billing,
)
from tests.fixtures.stripe import build_stripe_refund


@pytest.fixture(autouse=True)
def stripe_service_mock(mocker: MockerFixture) -> MagicMock:
    mock = MagicMock(spec=StripeService)
    mocker.patch("polar.refund.service.stripe_service", new=mock)
    return mock


@pytest.fixture(autouse=True)
def refund_transaction_service_mock(mocker: MockerFixture) -> MagicMock:
    mock = mocker.patch(
        "polar.refund.service.refund_transaction_service", autospec=True
    )
    return mock


Hooks = namedtuple("Hooks", "created updated succeeded")
HookNames = frozenset(Hooks._fields)


@pytest.fixture
def refund_hooks(mocker: MockerFixture) -> Hooks:
    created = mocker.patch.object(refund_service, "_on_created")
    updated = mocker.patch.object(refund_service, "_on_updated")
    succeeded = mocker.patch.object(refund_service, "_on_succeeded")
    return Hooks(
        created=created,
        updated=updated,
        succeeded=succeeded,
    )


def assert_hooks_called_once(refund_hooks: Hooks, called: set[str]) -> None:
    for hook in called:
        getattr(refund_hooks, hook).assert_called_once()

    not_called = HookNames - called
    for hook in not_called:
        getattr(refund_hooks, hook).assert_not_called()


def reset_hooks(refund_hooks: Hooks) -> None:
    for hook in HookNames:
        getattr(refund_hooks, hook).reset_mock()


def assert_order_updated_webhook_called(send_webhook_mock: MagicMock) -> None:
    """Helper to verify that order.updated webhook was sent."""
    calls = send_webhook_mock.call_args_list
    order_updated_calls = [
        call
        for call in calls
        if len(call[0]) > 2 and call[0][2] == WebhookEventType.order_updated
    ]
    assert len(order_updated_calls) >= 1, "order.updated webhook should be called"


class StripeRefund:
    async def calculate_and_create(
        self,
        client: AsyncClient,
        stripe_service_mock: MagicMock,
        order: Order,
        payment: Transaction,
        create_schema: RefundCreate,
    ) -> Response:
        refund_amount = create_schema.amount
        refund_tax_amount = refund_service.calculate_tax(order, refund_amount)
        return await self.create(
            client,
            stripe_service_mock,
            order,
            payment,
            create_schema,
            refund_amount=refund_amount,
            refund_tax_amount=refund_tax_amount,
        )

    async def create(
        self,
        client: AsyncClient,
        stripe_service_mock: MagicMock,
        order: Order,
        payment: Transaction,
        create_schema: RefundCreate,
        *,
        refund_amount: int,
        refund_tax_amount: int,
    ) -> Response:
        if not payment.charge_id:
            raise RuntimeError()

        stripe_refund = build_stripe_refund(
            amount=(refund_amount + refund_tax_amount),
            charge_id=payment.charge_id,
        )
        stripe_service_mock.create_refund.return_value = stripe_refund
        response = await client.post(
            "/v1/refunds/",
            json={
                "order_id": str(create_schema.order_id),
                "reason": str(create_schema.reason),
                "amount": refund_amount,
            },
        )
        return response

    async def create_and_assert(
        self,
        client: AsyncClient,
        stripe_service_mock: MagicMock,
        order: Order,
        payment: Transaction,
        create_schema: RefundCreate,
        expected: dict[str, Any] = {},
        expected_status: int = 200,
    ) -> Response:
        response = await self.calculate_and_create(
            client,
            stripe_service_mock,
            order,
            payment,
            create_schema,
        )

        # TODO: Why 200 vs. 201?
        assert response.status_code == expected_status
        if not expected:
            return response

        data = response.json()
        for k, v in expected.items():
            assert data[k] == v

        return response

    async def create_order_refund(
        self,
        session: AsyncSession,
        client: AsyncClient,
        stripe_service_mock: MagicMock,
        order: Order,
        payment: Transaction,
        *,
        amount: int,
        tax: int,
    ) -> tuple[Order, Response]:
        refunded_amount = order.refunded_amount
        refunded_tax_amount = order.refunded_tax_amount

        response = await self.create_and_assert(
            client,
            stripe_service_mock,
            order,
            payment,
            RefundCreate(
                order_id=order.id,
                reason=RefundReason.service_disruption,
                amount=amount,
                comment=None,
                revoke_benefits=False,
            ),
            expected={
                "status": "succeeded",
                "reason": "service_disruption",
                "amount": amount,
                # Refunds round down to closest cent (conservative in aggregate)
                "tax_amount": tax,
            },
        )
        refunded_amount += amount
        refunded_tax_amount += tax

        order_repository = OrderRepository.from_session(session)
        updated = await order_repository.get_by_id(order.id)
        assert updated is not None

        assert updated.refunded_amount == refunded_amount
        assert updated.refunded_tax_amount == refunded_tax_amount
        return updated, response


@pytest.mark.asyncio
class TestCreate(StripeRefund):
    async def test_create_repeatedly(
        self,
        session: AsyncSession,
        mocker: MockerFixture,
        stripe_service_mock: MagicMock,
        save_fixture: SaveFixture,
        product: Product,
        refund_hooks: Hooks,
        customer: Customer,
    ) -> None:
        # Complex Swedish order. $99.9 with 25% VAT = $24.75
        order, payment = await create_order_and_payment(
            save_fixture,
            product=product,
            customer=customer,
            subtotal_amount=1000,
            tax_amount=250,
        )

        assert order.refunded_amount == 0
        assert order.refunded_tax_amount == 0

        stripe_error = stripe_lib.InvalidRequestError(
            "Charge py_XX has already been refunded.",
            param=None,
            code="charge_already_refunded",
        )
        stripe_service_mock.create_refund.side_effect = stripe_error

        # Raised by us or Stripe, e.g attempting a POST request in a quick loop
        with pytest.raises(RefundedAlready):
            await refund_service.create(
                session,
                order,
                RefundCreate(
                    order_id=order.id,
                    reason=RefundReason.service_disruption,
                    amount=1000,
                    comment=None,
                    revoke_benefits=False,
                ),
            )

        order_repository = OrderRepository.from_session(session)
        updated_order = await order_repository.get_by_id(order.id)
        assert updated_order is not None
        assert updated_order.refunded_amount == 0
        assert updated_order.refunded_tax_amount == 0

    @pytest.mark.parametrize(
        "initial_balance,order_amount,order_tax_amount,refund_amount,expected_balance",
        [
            pytest.param(500, 1000, 250, 1000, 0, id="full refund within balance"),
            pytest.param(500, 1000, 250, 100, 375, id="partial refund within balance"),
            pytest.param(0, 1000, 250, 1000, 0, id="no balance"),
            pytest.param(-500, 1000, 250, 1000, -500, id="negative balance"),
        ],
    )
    async def test_create_impact_customer_balance(
        self,
        initial_balance: int,
        order_amount: int,
        order_tax_amount: int,
        refund_amount: int,
        expected_balance: int,
        session: AsyncSession,
        stripe_service_mock: MagicMock,
        save_fixture: SaveFixture,
        product: Product,
        customer: Customer,
    ) -> None:
        # Complex Swedish order. $99.9 with 25% VAT = $24.75
        order, payment = await create_order_and_payment(
            save_fixture,
            product=product,
            customer=customer,
            subtotal_amount=order_amount,
            tax_amount=order_tax_amount,
        )
        assert order.refunded_amount == 0
        assert order.refunded_tax_amount == 0

        # Create customer balance
        await create_wallet_billing(
            save_fixture,
            customer=customer,
            initial_balance=initial_balance,
        )

        refund_tax_amount = refund_service.calculate_tax(order, refund_amount)

        stripe_refund = build_stripe_refund(
            amount=(refund_amount + refund_tax_amount),
            charge_id=payment.charge_id,
        )
        stripe_service_mock.create_refund.return_value = stripe_refund

        await refund_service.create(
            session,
            order,
            RefundCreate(
                order_id=order.id,
                reason=RefundReason.service_disruption,
                amount=refund_amount,
                comment=None,
                revoke_benefits=False,
            ),
        )

        order_repository = OrderRepository.from_session(session)
        updated_order = await order_repository.get_by_id(order.id)
        assert updated_order is not None
        assert updated_order.refunded_amount == refund_amount
        assert updated_order.refunded_tax_amount == refund_tax_amount

        new_balance = await wallet_service.get_billing_wallet_balance(
            session, customer, order.currency
        )
        assert new_balance == expected_balance

    @pytest.mark.parametrize(
        "order_amount,order_tax_amount,order_applied_balance_amount,refund_amount,expected_refunded_amount,expected_refunded_tax_amount",
        [
            pytest.param(
                1000, 250, 1000, 1000, 1000, 250, id="refund subtotal amount with tax"
            ),
            pytest.param(
                1000,
                250,
                1000,
                2000,
                2000,
                250,
                id="refund subtotal + balance with tax",
            ),
            pytest.param(
                1000, 250, -500, 500, 500, 250, id="full refund with negative balance"
            ),
        ],
    )
    async def test_create_refund_applied_balance(
        self,
        order_amount: int,
        order_tax_amount: int,
        order_applied_balance_amount: int,
        refund_amount: int,
        expected_refunded_amount: int,
        expected_refunded_tax_amount: int,
        session: AsyncSession,
        stripe_service_mock: MagicMock,
        save_fixture: SaveFixture,
        product: Product,
        customer: Customer,
    ) -> None:
        order, payment = await create_order_and_payment(
            save_fixture,
            product=product,
            customer=customer,
            subtotal_amount=order_amount,
            tax_amount=order_tax_amount,
            applied_balance_amount=order_applied_balance_amount,
        )
        assert payment.amount == order_amount + order_applied_balance_amount
        assert order.refunded_amount == 0
        assert order.refunded_tax_amount == 0

        refund_tax_amount = refund_service.calculate_tax(order, refund_amount)
        assert refund_tax_amount == expected_refunded_tax_amount

        stripe_refund_amount = refund_amount + refund_tax_amount
        assert stripe_refund_amount <= payment.amount + payment.tax_amount

        stripe_refund = build_stripe_refund(
            amount=stripe_refund_amount,
            charge_id=payment.charge_id,
        )
        stripe_service_mock.create_refund.return_value = stripe_refund

        await refund_service.create(
            session,
            order,
            RefundCreate(
                order_id=order.id,
                reason=RefundReason.service_disruption,
                amount=refund_amount,
                comment=None,
                revoke_benefits=False,
            ),
        )

        order_repository = OrderRepository.from_session(session)
        updated_order = await order_repository.get_by_id(order.id)
        assert updated_order is not None
        assert updated_order.refunded_amount == expected_refunded_amount
        assert updated_order.refunded_tax_amount == expected_refunded_tax_amount

    async def test_valid_pledge_refund(
        self,
        session: AsyncSession,
        refund_transaction_service_mock: MagicMock,
        save_fixture: SaveFixture,
        organization: Organization,
        refund_hooks: Hooks,
    ) -> None:
        user = await create_user(save_fixture)
        payment_intent = "pi_pledge_payment_1337"
        pledge = await create_pledge(
            save_fixture,
            organization,
            pledging_user=user,
            payment_id=payment_intent,
        )
        payment_transaction = await create_payment_transaction(
            save_fixture,
            amount=pledge.amount,
            tax_amount=0,
            pledge=pledge,
        )

        stripe_refund = build_stripe_refund(
            status="succeeded",
            amount=pledge.amount,
            charge_id=payment_transaction.charge_id,
            payment_intent=payment_intent,
        )
        refund = await refund_service.upsert_from_stripe(session, stripe_refund)
        assert refund
        assert refund.status == RefundStatus.succeeded
        assert refund_transaction_service_mock.create.call_count == 1

        # Only call webhooks on orders
        assert_hooks_called_once(refund_hooks, set())

        updated = await pledge_service.get_by_payment_id(
            session, payment_id=payment_intent
        )
        assert updated
        assert updated.state == PledgeState.refunded

    async def test_valid_pending(
        self,
        session: AsyncSession,
        refund_transaction_service_mock: MagicMock,
        save_fixture: SaveFixture,
        product: Product,
        refund_hooks: Hooks,
        customer: Customer,
    ) -> None:
        # Complex Swedish order. $99.9 with 25% VAT = $24.75
        order, payment = await create_order_and_payment(
            save_fixture,
            product=product,
            customer=customer,
            subtotal_amount=1000,
            tax_amount=250,
        )

        assert order.refunded_amount == 0
        assert order.refunded_tax_amount == 0

        pending_stripe_refund = build_stripe_refund(
            status="pending",
            amount=100,
            charge_id=payment.charge_id,
        )
        refund = await refund_service.upsert_from_stripe(session, pending_stripe_refund)
        assert refund
        assert refund.status == RefundStatus.pending
        assert_hooks_called_once(refund_hooks, {"created"})
        refund_transaction_service_mock.create.assert_not_called()

        order_repository = OrderRepository.from_session(session)
        updated_order = await order_repository.get_by_id(order.id)
        assert updated_order is not None
        assert updated_order.refunded_amount == 0
        assert updated_order.refunded_tax_amount == 0

        reset_hooks(refund_hooks)
        succeeded_stripe_refund = build_stripe_refund(
            id=pending_stripe_refund.id,
            status="succeeded",
            amount=100,
            charge_id=payment.charge_id,
        )
        refund = await refund_service.upsert_from_stripe(
            session, succeeded_stripe_refund
        )
        assert refund
        assert refund.status == RefundStatus.succeeded
        assert_hooks_called_once(refund_hooks, {"updated", "succeeded"})

    async def test_valid_full_refund(
        self,
        session: AsyncSession,
        mocker: MockerFixture,
        save_fixture: SaveFixture,
        product: Product,
        refund_hooks: Hooks,
        customer: Customer,
    ) -> None:
        # Complex Swedish order. $99.9 with 25% VAT = $24.75
        order, payment = await create_order_and_payment(
            save_fixture,
            product=product,
            customer=customer,
            subtotal_amount=1000,
            tax_amount=250,
        )
        assert order.refunded_amount == 0
        assert order.refunded_tax_amount == 0

        stripe_refund = build_stripe_refund(
            status="succeeded",
            amount=1250,
            charge_id=payment.charge_id,
        )
        # Could be created from our API
        refund = await refund_service.create_from_stripe(session, stripe_refund)
        # ... and simultaneously from Stripe `refund.created` webhook
        webhook_refund = await refund_service.create_from_stripe(session, stripe_refund)
        assert refund
        assert refund.status == RefundStatus.succeeded
        assert webhook_refund
        assert webhook_refund.status == RefundStatus.succeeded

        # Ensure we only record and process refund once
        assert_hooks_called_once(refund_hooks, {"created", "succeeded"})

        order_repository = OrderRepository.from_session(session)
        updated_order = await order_repository.get_by_id(order.id)
        assert updated_order is not None
        assert updated_order.status == OrderStatus.refunded
        assert updated_order.refunded_amount == 1000
        assert updated_order.refunded_tax_amount == 250

    async def test_valid_partial_refunds(
        self,
        session: AsyncSession,
        mocker: MockerFixture,
        save_fixture: SaveFixture,
        product: Product,
        refund_hooks: Hooks,
        customer: Customer,
    ) -> None:
        # Complex Swedish order. $99.9 with 25% VAT = $24.75
        order, payment = await create_order_and_payment(
            save_fixture,
            product=product,
            customer=customer,
            subtotal_amount=1000,
            tax_amount=250,
        )
        assert order.refunded_amount == 0
        assert order.refunded_tax_amount == 0

        stripe_refund = build_stripe_refund(
            status="succeeded",
            amount=375,  # 300 + 75 in VAT
            charge_id=payment.charge_id,
        )
        # Could be created from our API
        refund = await refund_service.create_from_stripe(session, stripe_refund)
        # ... and simultaneously from Stripe `refund.created` webhook
        await refund_service.create_from_stripe(session, stripe_refund)
        assert refund
        assert refund.status == RefundStatus.succeeded
        assert_hooks_called_once(refund_hooks, {"created", "succeeded"})

        order_repository = OrderRepository.from_session(session)
        updated_order = await order_repository.get_by_id(order.id)
        assert updated_order is not None
        assert updated_order.status == OrderStatus.partially_refunded
        assert updated_order.refunded_amount == 300
        assert updated_order.refunded_tax_amount == 75

        reset_hooks(refund_hooks)

        stripe_refund = build_stripe_refund(
            status="succeeded",
            amount=375,  # 300 + 75 in VAT
            charge_id=payment.charge_id,
        )
        # Could be created from our API
        refund = await refund_service.create_from_stripe(session, stripe_refund)
        # ... and simultaneously from Stripe `refund.created` webhook
        await refund_service.create_from_stripe(session, stripe_refund)
        assert refund
        assert refund.status == RefundStatus.succeeded
        assert_hooks_called_once(refund_hooks, {"created", "succeeded"})

        order_repository = OrderRepository.from_session(session)
        updated_order = await order_repository.get_by_id(order.id)
        assert updated_order is not None
        assert updated_order.status == OrderStatus.partially_refunded
        assert updated_order.refunded_amount == 600
        assert updated_order.refunded_tax_amount == 150

    async def test_missing_related_dispute(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        product: Product,
        customer: Customer,
    ) -> None:
        order, payment = await create_order_and_payment(
            save_fixture,
            product=product,
            customer=customer,
            subtotal_amount=1000,
            tax_amount=250,
        )

        stripe_refund = build_stripe_refund(
            status="succeeded",
            amount=100,
            id="re_stripe_refund_1337",
            charge_id=payment.charge_id,
            metadata={"cbs_related_alert_id": "CHARGEBACK_STOP_ALERT_ID"},
        )

        with pytest.raises(MissingRelatedDispute):
            await refund_service.create_from_stripe(session, stripe_refund)

    async def test_existing_related_dispute(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        product: Product,
        customer: Customer,
        organization: Organization,
    ) -> None:
        order, transaction = await create_order_and_payment(
            save_fixture,
            product=product,
            customer=customer,
            subtotal_amount=1000,
            tax_amount=250,
        )
        payment = await create_payment(
            save_fixture, organization, processor_id=transaction.charge_id
        )
        dispute = await create_dispute(
            save_fixture,
            order,
            payment,
            payment_processor_id=None,
            alert_processor=DisputeAlertProcessor.chargeback_stop,
            alert_processor_id="CHARGEBACK_STOP_ALERT_ID",
        )

        stripe_refund = build_stripe_refund(
            status="succeeded",
            amount=100,
            id="re_stripe_refund_1337",
            charge_id=payment.processor_id,
            metadata={"cbs_related_alert_id": "CHARGEBACK_STOP_ALERT_ID"},
        )

        refund = await refund_service.create_from_stripe(session, stripe_refund)

        assert refund.dispute_id == dispute.id


@pytest.mark.asyncio
class TestCreateFromDispute:
    async def test_valid(
        self,
        session: AsyncSession,
        refund_transaction_service_mock: MagicMock,
        save_fixture: SaveFixture,
        organization: Organization,
        product: Product,
        customer: Customer,
    ) -> None:
        order, payment_transaction = await create_order_and_payment(
            save_fixture,
            product=product,
            customer=customer,
            subtotal_amount=1000,
            tax_amount=250,
        )
        payment = await create_payment(
            save_fixture,
            organization,
            order=order,
            processor_id=payment_transaction.charge_id,
        )
        dispute = await create_dispute(
            save_fixture,
            order,
            payment,
            amount=1000,
            tax_amount=250,
        )

        refund = await refund_service.create_from_dispute(
            session, dispute, "DISPUTE_BALANCE_TRANSACTION_ID"
        )
        assert refund
        assert refund.status == RefundStatus.succeeded
        assert refund.reason == RefundReason.dispute_prevention
        assert refund.amount == dispute.amount
        assert refund.currency == dispute.currency
        assert refund.tax_amount == dispute.tax_amount
        assert refund.dispute_id == dispute.id
        assert refund.order_id == order.id
        assert refund.processor == dispute.payment_processor
        assert refund.processor_id == dispute.payment_processor_id

        assert refund_transaction_service_mock.create.call_count == 1


@pytest.mark.asyncio
class TestUpdatedWebhooks(StripeRefund):
    async def test_valid(
        self,
        session: AsyncSession,
        refund_transaction_service_mock: MagicMock,
        save_fixture: SaveFixture,
        product_organization_second: Product,
        refund_hooks: Hooks,
        customer: Customer,
    ) -> None:
        # Complex Swedish order. $99.9 with 25% VAT = $24.75
        order, payment = await create_order_and_payment(
            save_fixture,
            product=product_organization_second,
            customer=customer,
            subtotal_amount=1000,
            tax_amount=250,
        )

        refund_id = "re_stripe_refund_1337"
        stripe_refund = build_stripe_refund(
            status="pending",
            amount=100,
            id=refund_id,
            charge_id=payment.charge_id,
        )
        refund = await refund_service.upsert_from_stripe(session, stripe_refund)
        assert refund
        assert refund.status == RefundStatus.pending
        assert refund_transaction_service_mock.create.call_count == 0
        assert_hooks_called_once(refund_hooks, {"created"})
        reset_hooks(refund_hooks)

        order_repository = OrderRepository.from_session(session)
        updated_order = await order_repository.get_by_id(order.id)
        assert updated_order is not None
        assert updated_order.refunded_amount == 0
        assert updated_order.refunded_tax_amount == 0

        stripe_refund = build_stripe_refund(
            status="succeeded",
            amount=100,
            id=refund_id,
            charge_id=payment.charge_id,
        )
        refund = await refund_service.upsert_from_stripe(session, stripe_refund)
        assert refund
        assert refund.status == RefundStatus.succeeded
        assert refund_transaction_service_mock.create.call_count == 1
        assert_hooks_called_once(refund_hooks, {"updated", "succeeded"})

        order_repository = OrderRepository.from_session(session)
        updated_order = await order_repository.get_by_id(order.id)
        assert updated_order is not None
        assert updated_order.refunded_amount == 80
        assert updated_order.refunded_tax_amount == 20

    async def test_reverted(
        self,
        session: AsyncSession,
        refund_transaction_service_mock: MagicMock,
        save_fixture: SaveFixture,
        product_organization_second: Product,
        refund_hooks: Hooks,
        customer: Customer,
    ) -> None:
        order = await create_order(
            save_fixture,
            product=product_organization_second,
            customer=customer,
            status=OrderStatus.refunded,
            subtotal_amount=80,
            tax_amount=20,
            refunded_amount=80,
            refunded_tax_amount=20,
        )
        payment = await create_payment_transaction(
            save_fixture, amount=80, tax_amount=20, order=order
        )
        refund = await create_refund(save_fixture, order, amount=80, tax_amount=20)

        updated_refund = await refund_service.update_from_stripe(
            session,
            refund,
            build_stripe_refund(
                status="failed",
                amount=100,
                id=refund.processor_id,
                charge_id=payment.charge_id,
            ),
        )

        assert updated_refund.status == RefundStatus.failed

        order_repository = OrderRepository.from_session(session)
        updated_order = await order_repository.get_by_id(order.id)
        assert updated_order is not None
        assert updated_order.refunded_amount == 0
        assert updated_order.refunded_tax_amount == 0
        assert updated_order.status == OrderStatus.paid

        refund_transaction_service_mock.revert.assert_awaited_once()


@pytest.mark.asyncio
class TestOrderUpdatedWebhook(StripeRefund):
    """Test that order.updated webhook is sent when refunds are processed."""

    async def test_order_updated_webhook_on_full_refund(
        self,
        session: AsyncSession,
        mocker: MockerFixture,
        save_fixture: SaveFixture,
        product: Product,
        customer: Customer,
    ) -> None:
        """Test that order.updated webhook is invoked on full refund."""
        # Create order and payment
        order, payment = await create_order_and_payment(
            save_fixture,
            product=product,
            customer=customer,
            subtotal_amount=1000,
            tax_amount=250,
        )

        # Mock order_service.send_webhook to verify it's called
        send_webhook_mock = mocker.patch.object(order_service, "send_webhook")

        # Create a full refund
        stripe_refund = build_stripe_refund(
            status="succeeded",
            amount=1250,  # Full amount including tax
            charge_id=payment.charge_id,
        )
        await refund_service.create_from_stripe(session, stripe_refund)

        # Verify order.updated webhook was sent
        assert_order_updated_webhook_called(send_webhook_mock)

    async def test_order_updated_webhook_on_partial_refund(
        self,
        session: AsyncSession,
        mocker: MockerFixture,
        save_fixture: SaveFixture,
        product: Product,
        customer: Customer,
    ) -> None:
        """Test that order.updated webhook is invoked on partial refund."""
        # Create order and payment
        order, payment = await create_order_and_payment(
            save_fixture,
            product=product,
            customer=customer,
            subtotal_amount=1000,
            tax_amount=250,
        )

        # Mock order_service.send_webhook to verify it's called
        send_webhook_mock = mocker.patch.object(order_service, "send_webhook")

        # Create a partial refund (30% of the order)
        stripe_refund = build_stripe_refund(
            status="succeeded",
            amount=375,  # 300 + 75 in tax
            charge_id=payment.charge_id,
        )
        await refund_service.create_from_stripe(session, stripe_refund)

        # Verify order.updated webhook was sent
        assert_order_updated_webhook_called(send_webhook_mock)

    async def test_order_updated_webhook_on_refund_revert(
        self,
        session: AsyncSession,
        mocker: MockerFixture,
        save_fixture: SaveFixture,
        product_organization_second: Product,
        refund_hooks: Hooks,
        customer: Customer,
    ) -> None:
        """Test that order.updated webhook is invoked when a refund is reverted."""
        # Create a fully refunded order
        order = await create_order(
            save_fixture,
            product=product_organization_second,
            customer=customer,
            status=OrderStatus.refunded,
            subtotal_amount=80,
            tax_amount=20,
            refunded_amount=80,
            refunded_tax_amount=20,
        )
        payment = await create_payment_transaction(
            save_fixture, amount=80, tax_amount=20, order=order
        )
        refund = await create_refund(save_fixture, order, amount=80, tax_amount=20)

        # Mock order_service.send_webhook to verify it's called
        send_webhook_mock = mocker.patch.object(order_service, "send_webhook")

        # Update refund to failed status (which reverts the refund)
        await refund_service.update_from_stripe(
            session,
            refund,
            build_stripe_refund(
                status="failed",
                amount=100,
                id=refund.processor_id,
                charge_id=payment.charge_id,
            ),
        )

        # Verify order.updated webhook was sent
        assert_order_updated_webhook_called(send_webhook_mock)
