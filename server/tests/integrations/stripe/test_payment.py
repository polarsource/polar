from datetime import timedelta

import pytest
from freezegun import freeze_time

from polar.enums import PaymentProcessor
from polar.integrations.stripe.payment import (
    _resolve_trigger,
    handle_cancellation,
    handle_failure,
)
from polar.kit.db.postgres import AsyncSession
from polar.kit.utils import utc_now
from polar.models import (
    Customer,
    Product,
    Subscription,
)
from polar.models.order import OrderStatus
from polar.models.payment import PaymentTrigger
from polar.models.subscription import SubscriptionStatus
from polar.order.repository import OrderRepository
from polar.payment.repository import PaymentRepository
from polar.subscription.repository import SubscriptionRepository
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import (
    create_order,
)
from tests.fixtures.stripe import build_stripe_charge, build_stripe_payment_intent


@pytest.mark.asyncio
class TestHandleFailure:
    """Integration tests for the failed payment. If it's an order, the subscription
    will be marked as past due, benefits will be revoked, and the order will have its next
    payment attempt scheduled."""

    @freeze_time("2024-01-01 12:00:00")
    async def test_full_dunning_flow_with_repositories(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        subscription: Subscription,
        customer: Customer,
        product: Product,
    ) -> None:
        """Test the complete dunning flow with actual repository calls"""
        # Given
        order = await create_order(
            save_fixture,
            product=product,
            customer=customer,
            subscription=subscription,
            status=OrderStatus.pending,
        )

        order.next_payment_attempt_at = None
        assert order.subscription is not None
        await save_fixture(order)

        # Create stripe charge with order_id metadata
        stripe_charge = build_stripe_charge(
            status="failed",
            amount=2000,
            metadata={"order_id": str(order.id)},
            billing_details={"email": "test@example.com"},
            payment_method_details={
                "card": {"brand": "visa", "last4": "4242"},
                "type": "card",
            },
        )

        # When
        await handle_failure(session, stripe_charge)

        # Then
        order_repo = OrderRepository.from_session(session)
        subscription_repo = SubscriptionRepository.from_session(session)

        updated_order = await order_repo.get_by_id(order.id)
        assert updated_order is not None
        assert updated_order.next_payment_attempt_at is not None
        expected_retry_date = utc_now() + timedelta(days=2)
        assert updated_order.next_payment_attempt_at == expected_retry_date

        updated_subscription = await subscription_repo.get_by_id(subscription.id)
        assert updated_subscription is not None
        assert updated_subscription.status == SubscriptionStatus.past_due


@pytest.mark.asyncio
class TestHandleCancellation:
    """A canceled PaymentIntent (typically the stale-lock cleanup cancelling an
    unresolved off-session SCA intent) must release the order's payment lock and
    progress dunning so a fresh charge is attempted on the next retry."""

    @freeze_time("2024-01-01 12:00:00")
    async def test_releases_lock_and_advances_dunning(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        subscription: Subscription,
        customer: Customer,
        product: Product,
    ) -> None:
        # Given a pending order with a wedged payment lock
        order = await create_order(
            save_fixture,
            product=product,
            customer=customer,
            subscription=subscription,
            status=OrderStatus.pending,
            payment_lock_acquired_at=utc_now() - timedelta(hours=2),
        )
        order.next_payment_attempt_at = None
        assert order.subscription is not None
        await save_fixture(order)

        payment_intent = build_stripe_payment_intent(
            id="pi_wedged",
            status="canceled",
            metadata={"order_id": str(order.id)},
        )

        # When
        await handle_cancellation(session, payment_intent)

        # Then — lock released and dunning scheduled
        order_repo = OrderRepository.from_session(session)
        updated_order = await order_repo.get_by_id(order.id)
        assert updated_order is not None
        assert updated_order.payment_lock_acquired_at is None
        assert updated_order.next_payment_attempt_at is not None
        expected_retry_date = utc_now() + timedelta(days=2)
        assert updated_order.next_payment_attempt_at == expected_retry_date

        subscription_repo = SubscriptionRepository.from_session(session)
        updated_subscription = await subscription_repo.get_by_id(subscription.id)
        assert updated_subscription is not None
        assert updated_subscription.status == SubscriptionStatus.past_due

    async def test_live_payment_attempt_not_disturbed(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        subscription: Subscription,
        customer: Customer,
        product: Product,
    ) -> None:
        """A cancellation for an older intent must not release the lock of an
        attempt that is still in flight, which would let a second charge fire
        alongside it."""
        acquired_at = utc_now() - timedelta(minutes=1)
        order = await create_order(
            save_fixture,
            product=product,
            customer=customer,
            subscription=subscription,
            status=OrderStatus.pending,
            payment_lock_acquired_at=acquired_at,
        )

        payment_intent = build_stripe_payment_intent(
            id="pi_previous_cycle",
            status="canceled",
            metadata={"order_id": str(order.id)},
        )

        # When
        await handle_cancellation(session, payment_intent)

        # Then — lock untouched, dunning not advanced
        order_repo = OrderRepository.from_session(session)
        updated_order = await order_repo.get_by_id(order.id)
        assert updated_order is not None
        assert updated_order.payment_lock_acquired_at == acquired_at
        assert updated_order.next_payment_attempt_at is None

    async def test_unlocked_order_not_disturbed(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        subscription: Subscription,
        customer: Customer,
        product: Product,
    ) -> None:
        """An order holding no lock has no attempt to fail: a cancellation for
        one of its old intents must not advance dunning."""
        order = await create_order(
            save_fixture,
            product=product,
            customer=customer,
            subscription=subscription,
            status=OrderStatus.pending,
        )

        payment_intent = build_stripe_payment_intent(
            id="pi_previous_cycle",
            status="canceled",
            metadata={"order_id": str(order.id)},
        )

        # When
        await handle_cancellation(session, payment_intent)

        # Then
        order_repo = OrderRepository.from_session(session)
        updated_order = await order_repo.get_by_id(order.id)
        assert updated_order is not None
        assert updated_order.next_payment_attempt_at is None

    async def test_paid_order_not_disturbed(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        subscription: Subscription,
        customer: Customer,
        product: Product,
    ) -> None:
        """A resolving intent may have succeeded before the cancellation is
        processed; a paid order must never be reopened."""
        order = await create_order(
            save_fixture,
            product=product,
            customer=customer,
            subscription=subscription,
            status=OrderStatus.paid,
        )

        payment_intent = build_stripe_payment_intent(
            id="pi_late_cancel",
            status="canceled",
            metadata={"order_id": str(order.id)},
        )

        # When
        await handle_cancellation(session, payment_intent)

        # Then
        order_repo = OrderRepository.from_session(session)
        updated_order = await order_repo.get_by_id(order.id)
        assert updated_order is not None
        assert updated_order.status == OrderStatus.paid
        assert updated_order.next_payment_attempt_at is None


class TestResolveTrigger:
    """Test the _resolve_trigger helper that extracts PaymentTrigger from Stripe metadata."""

    def test_explicit_payment_trigger_in_metadata(self) -> None:
        charge = build_stripe_charge(
            metadata={"payment_trigger": "retry_dunning"},
        )
        assert _resolve_trigger(charge) == PaymentTrigger.retry_dunning

    def test_all_trigger_values(self) -> None:
        for trigger in PaymentTrigger:
            charge = build_stripe_charge(metadata={"payment_trigger": trigger.value})
            assert _resolve_trigger(charge) == trigger

    def test_fallback_to_purchase_when_checkout_id_present(self) -> None:
        charge = build_stripe_charge(
            metadata={"checkout_id": "co_123"},
        )
        assert _resolve_trigger(charge) == PaymentTrigger.purchase

    def test_no_trigger_without_metadata_keys(self) -> None:
        """Backward compat: Stripe notifications from before the deployment
        won't have payment_trigger in metadata."""
        charge = build_stripe_charge(
            metadata={"order_id": "ord_123"},
        )
        assert _resolve_trigger(charge) is None

    def test_invalid_trigger_value_ignored(self) -> None:
        """If metadata contains a value we don't recognize, fall back gracefully."""
        charge = build_stripe_charge(
            metadata={"payment_trigger": "unknown_value"},
        )
        assert _resolve_trigger(charge) is None

    def test_explicit_trigger_takes_precedence_over_checkout(self) -> None:
        charge = build_stripe_charge(
            metadata={
                "payment_trigger": "retry_customer",
                "checkout_id": "co_123",
            },
        )
        assert _resolve_trigger(charge) == PaymentTrigger.retry_customer

    def test_payment_intent_with_trigger(self) -> None:
        pi = build_stripe_payment_intent(
            metadata={"payment_trigger": "retry_payment_method_update"},
            latest_charge=None,
            last_payment_error={
                "code": "card_declined",
                "message": "declined",
                "payment_method": {
                    "id": "pm_1",
                    "type": "card",
                    "card": {"brand": "visa", "last4": "4242"},
                },
            },
        )
        assert _resolve_trigger(pi) == PaymentTrigger.retry_payment_method_update

    def test_payment_intent_without_trigger(self) -> None:
        """Pre-deployment payment intents won't have payment_trigger."""
        pi = build_stripe_payment_intent(
            metadata={"order_id": "ord_123"},
            latest_charge=None,
            last_payment_error={
                "code": "card_declined",
                "message": "declined",
                "payment_method": {
                    "id": "pm_1",
                    "type": "card",
                    "card": {"brand": "visa", "last4": "4242"},
                },
            },
        )
        assert _resolve_trigger(pi) is None


@pytest.mark.asyncio
class TestHandleFailureTrigger:
    """Test that handle_failure persists the resolved trigger on the payment."""

    async def test_trigger_persisted_on_charge_with_explicit_trigger(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        subscription: Subscription,
        customer: Customer,
        product: Product,
    ) -> None:
        """A retry charge with explicit payment_trigger metadata should persist it."""
        order = await create_order(
            save_fixture,
            product=product,
            customer=customer,
            subscription=subscription,
            status=OrderStatus.pending,
        )

        charge = build_stripe_charge(
            status="failed",
            amount=2000,
            metadata={
                "order_id": str(order.id),
                "payment_trigger": "retry_dunning",
            },
            billing_details={"email": "test@example.com"},
            payment_method_details={
                "card": {"brand": "visa", "last4": "4242"},
                "type": "card",
            },
        )

        await handle_failure(session, charge)

        payment_repo = PaymentRepository.from_session(session)
        payment = await payment_repo.get_by_processor_id(
            PaymentProcessor.stripe, charge.id
        )
        assert payment is not None
        assert payment.trigger == PaymentTrigger.retry_dunning

    async def test_no_trigger_for_pre_deployment_charge(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        subscription: Subscription,
        customer: Customer,
        product: Product,
    ) -> None:
        """Charges from before the deployment won't have payment_trigger metadata.
        The trigger should be None."""
        order = await create_order(
            save_fixture,
            product=product,
            customer=customer,
            subscription=subscription,
            status=OrderStatus.pending,
        )

        charge = build_stripe_charge(
            status="failed",
            amount=2000,
            metadata={"order_id": str(order.id)},
            billing_details={"email": "test@example.com"},
            payment_method_details={
                "card": {"brand": "visa", "last4": "4242"},
                "type": "card",
            },
        )

        await handle_failure(session, charge)

        payment_repo = PaymentRepository.from_session(session)
        payment = await payment_repo.get_by_processor_id(
            PaymentProcessor.stripe, charge.id
        )
        assert payment is not None
        assert payment.trigger is None
