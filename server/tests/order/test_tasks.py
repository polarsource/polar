import uuid
from datetime import timedelta
from unittest.mock import MagicMock

import pytest
import stripe as stripe_lib
from dramatiq import Retry
from pytest_mock import MockerFixture

from polar.config import settings
from polar.kit.db.postgres import AsyncSession
from polar.kit.utils import utc_now
from polar.models import Organization, Product
from polar.models.order import OrderBillingReasonInternal, OrderStatus
from polar.models.payment import PaymentStatus, PaymentTrigger
from polar.models.subscription import SubscriptionStatus
from polar.order.repository import OrderRepository
from polar.order.service import order as order_service
from polar.order.tasks import (
    OrderDoesNotExist,
    process_dunning,
    process_dunning_order,
    process_stale_payment_lock_order,
    process_stale_payment_locks,
    trigger_payment,
)
from polar.subscription.repository import SubscriptionRepository
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import (
    create_customer,
    create_order,
    create_payment,
    create_payment_method,
    create_subscription,
)
from tests.fixtures.stripe import build_stripe_payment_intent


@pytest.mark.asyncio
class TestProcessDunning:
    async def test_enqueues_tasks_for_due_orders(
        self,
        save_fixture: SaveFixture,
        product: Product,
        organization: Organization,
        mocker: MockerFixture,
    ) -> None:
        # Given
        customer = await create_customer(save_fixture, organization=organization)
        past_time = utc_now() - timedelta(hours=1)
        order = await create_order(
            save_fixture,
            product=product,
            customer=customer,
            status=OrderStatus.pending,
        )
        order.next_payment_attempt_at = past_time
        await save_fixture(order)

        enqueue_job_mock = mocker.patch("polar.order.tasks.enqueue_job")

        # When
        await process_dunning()

        # Then
        enqueue_job_mock.assert_called_once_with(
            "order.process_dunning_order",
            order.id,
        )

    async def test_order_in_future_skipped(
        self,
        save_fixture: SaveFixture,
        product: Product,
        organization: Organization,
        mocker: MockerFixture,
    ) -> None:
        # Given
        customer = await create_customer(save_fixture, organization=organization)
        future_time = utc_now() + timedelta(hours=1)
        order = await create_order(
            save_fixture,
            product=product,
            customer=customer,
            status=OrderStatus.pending,
        )
        order.next_payment_attempt_at = future_time
        await save_fixture(order)

        enqueue_job_mock = mocker.patch("polar.order.tasks.enqueue_job")

        # When
        await process_dunning()

        # Then
        enqueue_job_mock.assert_not_called()

    async def test_enqueues_multiple_due_orders(
        self,
        save_fixture: SaveFixture,
        product: Product,
        organization: Organization,
        mocker: MockerFixture,
    ) -> None:
        # Given
        customer = await create_customer(save_fixture, organization=organization)
        past_time = utc_now() - timedelta(hours=1)

        order1 = await create_order(
            save_fixture,
            product=product,
            customer=customer,
            status=OrderStatus.pending,
        )
        order1.next_payment_attempt_at = past_time
        await save_fixture(order1)

        order2 = await create_order(
            save_fixture,
            product=product,
            customer=customer,
            status=OrderStatus.pending,
        )
        order2.next_payment_attempt_at = past_time
        await save_fixture(order2)

        enqueue_job_mock = mocker.patch("polar.order.tasks.enqueue_job")

        # When
        await process_dunning()

        # Then
        assert enqueue_job_mock.call_count == 2
        enqueue_job_mock.assert_any_call("order.process_dunning_order", order1.id)
        enqueue_job_mock.assert_any_call("order.process_dunning_order", order2.id)


@pytest.mark.asyncio
class TestProcessDunningOrder:
    async def test_order_without_subscription_skipped(
        self,
        save_fixture: SaveFixture,
        product: Product,
        organization: Organization,
        mocker: MockerFixture,
    ) -> None:
        # Given
        log_mock = mocker.patch("polar.order.service.log")
        customer = await create_customer(save_fixture, organization=organization)
        order = await create_order(
            save_fixture,
            product=product,
            customer=customer,
            subscription=None,
        )

        # When
        await process_dunning_order(order.id)

        # Then
        log_mock.warning.assert_called_once_with(
            "Order has no subscription, skipping dunning",
            order_id=order.id,
        )

    async def test_cancelled_subscription_order_cleared_from_dunning(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        product: Product,
        organization: Organization,
    ) -> None:
        # Given
        customer = await create_customer(save_fixture, organization=organization)
        subscription = await create_subscription(
            save_fixture,
            product=product,
            customer=customer,
            status=SubscriptionStatus.canceled,
        )
        past_time = utc_now() - timedelta(hours=1)
        order = await create_order(
            save_fixture,
            product=product,
            customer=customer,
            subscription=subscription,
            status=OrderStatus.pending,
        )
        order.next_payment_attempt_at = past_time
        await save_fixture(order)

        # When
        await process_dunning_order(order.id)

        # Then
        repository = OrderRepository.from_session(session)
        updated_order = await repository.get_by_id(order.id)
        assert updated_order is not None
        assert updated_order.next_payment_attempt_at is None

    async def test_subscription_without_payment_method_skipped(
        self,
        save_fixture: SaveFixture,
        product: Product,
        organization: Organization,
        mocker: MockerFixture,
    ) -> None:
        # Given
        log_mock = mocker.patch("polar.order.service.log")
        customer = await create_customer(save_fixture, organization=organization)
        subscription = await create_subscription(
            save_fixture,
            product=product,
            customer=customer,
            status=SubscriptionStatus.active,
        )
        subscription.payment_method_id = None
        await save_fixture(subscription)

        order = await create_order(
            save_fixture,
            product=product,
            customer=customer,
            subscription=subscription,
            status=OrderStatus.pending,
            billing_reason=OrderBillingReasonInternal.subscription_cycle,
        )

        # When
        await process_dunning_order(order.id)

        # Then
        log_mock.warning.assert_called_once_with(
            "Order subscription has no payment method, record a failure",
            order_id=order.id,
            subscription_id=subscription.id,
        )

    async def test_valid_order_triggers_payment_retry(
        self,
        save_fixture: SaveFixture,
        product: Product,
        organization: Organization,
        mocker: MockerFixture,
    ) -> None:
        # Given
        customer = await create_customer(save_fixture, organization=organization)
        subscription = await create_subscription(
            save_fixture,
            product=product,
            customer=customer,
            status=SubscriptionStatus.active,
        )
        payment_method = await create_payment_method(save_fixture, customer=customer)
        subscription.payment_method = payment_method
        await save_fixture(subscription)

        order = await create_order(
            save_fixture,
            product=product,
            customer=customer,
            subscription=subscription,
            status=OrderStatus.pending,
            billing_reason=OrderBillingReasonInternal.subscription_cycle,
        )

        enqueue_job_mock = mocker.patch("polar.order.service.enqueue_job")

        # When
        await process_dunning_order(order.id)

        # Then
        enqueue_job_mock.assert_called_once_with(
            "order.trigger_payment",
            order_id=order.id,
            payment_method_id=subscription.payment_method_id,
            payment_trigger="retry_dunning",
        )

    async def test_payment_retry_success_clears_dunning_and_reactivates_subscription(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        product: Product,
        organization: Organization,
        mocker: MockerFixture,
    ) -> None:
        # Given: subscription is past due with pending retry
        customer = await create_customer(save_fixture, organization=organization)
        subscription = await create_subscription(
            save_fixture,
            product=product,
            customer=customer,
            status=SubscriptionStatus.past_due,
        )
        payment_method = await create_payment_method(save_fixture, customer=customer)
        subscription.payment_method = payment_method
        await save_fixture(subscription)

        past_time = utc_now() - timedelta(hours=1)
        order = await create_order(
            save_fixture,
            product=product,
            customer=customer,
            subscription=subscription,
            status=OrderStatus.pending,
            billing_reason=OrderBillingReasonInternal.subscription_cycle,
        )
        order.next_payment_attempt_at = past_time
        await save_fixture(order)

        payment = await create_payment(
            save_fixture,
            organization,
            status=PaymentStatus.succeeded,
            order=order,
        )

        # When: payment succeeds
        result_order = await order_service.handle_payment(session, order, payment)

        # Then: order is paid, dunning cleared, and subscription reactivated
        assert result_order.status == OrderStatus.paid
        assert result_order.next_payment_attempt_at is None

        from polar.subscription.repository import SubscriptionRepository

        subscription_repo = SubscriptionRepository.from_session(session)
        updated_subscription = await subscription_repo.get_by_id(subscription.id)
        assert updated_subscription is not None
        assert updated_subscription.status == SubscriptionStatus.active

    async def test_payment_retry_failure_schedules_next_attempt(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        product: Product,
        organization: Organization,
    ) -> None:
        # Given: order already failed once and is due for first retry
        customer = await create_customer(save_fixture, organization=organization)
        subscription = await create_subscription(
            save_fixture,
            product=product,
            customer=customer,
            status=SubscriptionStatus.past_due,
        )

        first_retry_time = utc_now() - timedelta(hours=1)
        order = await create_order(
            save_fixture,
            product=product,
            customer=customer,
            subscription=subscription,
            status=OrderStatus.pending,
            billing_reason=OrderBillingReasonInternal.subscription_cycle,
        )
        order.next_payment_attempt_at = first_retry_time
        await save_fixture(order)

        await create_payment(
            save_fixture,
            organization,
            status=PaymentStatus.failed,
            trigger=PaymentTrigger.purchase,
            order=order,
        )
        await create_payment(
            save_fixture,
            organization,
            status=PaymentStatus.failed,
            trigger=PaymentTrigger.purchase,
            order=order,
        )

        # When: retry attempt fails
        result_order = await order_service.handle_payment_failure(session, order)

        # Then: next retry is scheduled according to second interval (5 days)
        assert result_order.next_payment_attempt_at is not None
        expected_next_attempt = utc_now() + timedelta(days=5)
        time_diff = abs(
            (
                result_order.next_payment_attempt_at - expected_next_attempt
            ).total_seconds()
        )
        assert time_diff < 1  # Within 1 second

    async def test_payment_retry_failure_final_attempt_marks_canceled(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        product: Product,
        organization: Organization,
        mocker: MockerFixture,
    ) -> None:
        # Given: order has exhausted all retry attempts
        customer = await create_customer(save_fixture, organization=organization)
        subscription = await create_subscription(
            save_fixture,
            product=product,
            customer=customer,
            status=SubscriptionStatus.past_due,
        )

        very_old_time = utc_now() - timedelta(days=30)
        order = await create_order(
            save_fixture,
            product=product,
            customer=customer,
            subscription=subscription,
            status=OrderStatus.pending,
            billing_reason=OrderBillingReasonInternal.subscription_cycle,
        )
        order.next_payment_attempt_at = very_old_time
        await save_fixture(order)

        # Initial cycle failure + all DUNNING_RETRY_INTERVALS retries failed
        for _ in range(len(settings.DUNNING_RETRY_INTERVALS) + 1):
            await create_payment(
                save_fixture,
                organization,
                status=PaymentStatus.failed,
                trigger=PaymentTrigger.purchase,
                order=order,
            )

        # When: final retry attempt fails
        result_order = await order_service.handle_payment_failure(session, order)

        # Then: order removed from dunning and subscription marked as canceled
        assert result_order.next_payment_attempt_at is None

        subscription_repo = SubscriptionRepository.from_session(session)
        updated_subscription = await subscription_repo.get_by_id(subscription.id)
        assert updated_subscription is not None
        assert updated_subscription.status == SubscriptionStatus.canceled


@pytest.mark.asyncio
class TestTriggerPayment:
    async def test_trigger_payment_success(
        self,
        save_fixture: SaveFixture,
        product: Product,
        organization: Organization,
        mocker: MockerFixture,
    ) -> None:
        # Given
        customer = await create_customer(save_fixture, organization=organization)
        payment_method = await create_payment_method(save_fixture, customer=customer)
        order = await create_order(
            save_fixture,
            product=product,
            customer=customer,
            status=OrderStatus.pending,
        )

        # Mock the Stripe service instead of the order service
        mock_create_payment_intent = mocker.patch(
            "polar.order.service.stripe_service.create_payment_intent",
            return_value=MagicMock(status="succeeded", id="pi_test_success"),
        )

        # When
        await trigger_payment(order.id, payment_method.id)

        # Then
        mock_create_payment_intent.assert_called_once()

    async def test_trigger_payment_card_error_no_retry(
        self,
        save_fixture: SaveFixture,
        product: Product,
        organization: Organization,
        mocker: MockerFixture,
    ) -> None:
        # Given
        customer = await create_customer(save_fixture, organization=organization)
        payment_method = await create_payment_method(save_fixture, customer=customer)
        order = await create_order(
            save_fixture,
            product=product,
            customer=customer,
            status=OrderStatus.pending,
        )

        # Mock Stripe service to raise CardError
        card_error = stripe_lib.CardError(
            message="Your card was declined.",
            param="card",
            code="card_declined",
        )
        mock_create_payment_intent = mocker.patch(
            "polar.order.service.stripe_service.create_payment_intent",
            side_effect=card_error,
        )

        # When
        await trigger_payment(order.id, payment_method.id)

        # Then
        mock_create_payment_intent.assert_called_once()
        # Task should complete without raising exception (no retry)

    async def test_trigger_payment_api_error_with_retry(
        self,
        save_fixture: SaveFixture,
        product: Product,
        organization: Organization,
        mocker: MockerFixture,
    ) -> None:
        # Given
        customer = await create_customer(save_fixture, organization=organization)
        payment_method = await create_payment_method(save_fixture, customer=customer)
        order = await create_order(
            save_fixture,
            product=product,
            customer=customer,
            status=OrderStatus.pending,
        )

        # Mock Stripe service to raise APIConnectionError
        api_error = stripe_lib.APIConnectionError("Network error")
        mock_create_payment_intent = mocker.patch(
            "polar.order.service.stripe_service.create_payment_intent",
            side_effect=api_error,
        )

        # Mock can_retry to return True
        mocker.patch("polar.order.tasks.can_retry", return_value=True)

        # When/Then - should raise Retry exception
        with pytest.raises(Retry):  # Retry exception
            await trigger_payment(order.id, payment_method.id)

        mock_create_payment_intent.assert_called_once()

    async def test_trigger_payment_order_not_found(
        self,
        save_fixture: SaveFixture,
        organization: Organization,
        mocker: MockerFixture,
    ) -> None:
        # Given
        import uuid

        customer = await create_customer(save_fixture, organization=organization)
        payment_method = await create_payment_method(save_fixture, customer=customer)
        non_existent_order_id = uuid.uuid4()

        # When/Then
        with pytest.raises(OrderDoesNotExist):
            await trigger_payment(non_existent_order_id, payment_method.id)

    async def test_trigger_payment_payment_method_not_found(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        product: Product,
        organization: Organization,
        mocker: MockerFixture,
    ) -> None:
        # Given
        customer = await create_customer(save_fixture, organization=organization)
        subscription = await create_subscription(
            save_fixture,
            product=product,
            customer=customer,
            status=SubscriptionStatus.active,
        )
        order = await create_order(
            save_fixture,
            product=product,
            customer=customer,
            subscription=subscription,
            status=OrderStatus.pending,
            billing_reason=OrderBillingReasonInternal.subscription_cycle,
        )
        non_existent_payment_method_id = uuid.uuid4()

        # When
        await trigger_payment(order.id, non_existent_payment_method_id)

        # Then
        order_repository = OrderRepository.from_session(session)
        updated_order = await order_repository.get_by_id(order.id)
        assert updated_order is not None
        assert updated_order.next_payment_attempt_at is not None

    async def test_trigger_payment_passes_payment_trigger(
        self,
        save_fixture: SaveFixture,
        product: Product,
        organization: Organization,
        mocker: MockerFixture,
    ) -> None:
        """Test that payment_trigger is passed through to order_service.trigger_payment."""
        customer = await create_customer(save_fixture, organization=organization)
        payment_method = await create_payment_method(save_fixture, customer=customer)
        order = await create_order(
            save_fixture,
            product=product,
            customer=customer,
            status=OrderStatus.pending,
        )

        mock_create_payment_intent = mocker.patch(
            "polar.order.service.stripe_service.create_payment_intent",
            return_value=MagicMock(status="succeeded", id="pi_test_success"),
        )

        # When
        await trigger_payment(
            order.id, payment_method.id, payment_trigger="retry_dunning"
        )

        # Then — verify payment_trigger is in the PI metadata
        mock_create_payment_intent.assert_called_once()
        call_kwargs = mock_create_payment_intent.call_args[1]
        assert call_kwargs["metadata"]["payment_trigger"] == "retry_dunning"

    async def test_trigger_payment_without_payment_trigger(
        self,
        save_fixture: SaveFixture,
        product: Product,
        organization: Organization,
        mocker: MockerFixture,
    ) -> None:
        """Backward compat: pre-existing enqueued messages won't have payment_trigger.
        The task should still work with payment_trigger=None."""
        customer = await create_customer(save_fixture, organization=organization)
        payment_method = await create_payment_method(save_fixture, customer=customer)
        order = await create_order(
            save_fixture,
            product=product,
            customer=customer,
            status=OrderStatus.pending,
        )

        mock_create_payment_intent = mocker.patch(
            "polar.order.service.stripe_service.create_payment_intent",
            return_value=MagicMock(status="succeeded", id="pi_test_success"),
        )

        # When — called without payment_trigger (default None)
        await trigger_payment(order.id, payment_method.id)

        # Then — payment_trigger should NOT be in metadata
        mock_create_payment_intent.assert_called_once()
        call_kwargs = mock_create_payment_intent.call_args[1]
        assert "payment_trigger" not in call_kwargs["metadata"]

    async def test_trigger_payment_already_in_progress_does_not_raise(
        self,
        save_fixture: SaveFixture,
        product: Product,
        organization: Organization,
        mocker: MockerFixture,
    ) -> None:
        """A wedged payment lock must not dead-letter the dunning retry: the
        task should swallow PaymentAlreadyInProgress and return cleanly."""
        customer = await create_customer(save_fixture, organization=organization)
        payment_method = await create_payment_method(save_fixture, customer=customer)
        order = await create_order(
            save_fixture,
            product=product,
            customer=customer,
            status=OrderStatus.pending,
            payment_lock_acquired_at=utc_now() - timedelta(hours=2),
        )

        mock_create_payment_intent = mocker.patch(
            "polar.order.service.stripe_service.create_payment_intent",
        )

        # When / Then — must not raise
        await trigger_payment(order.id, payment_method.id)

        # No new charge attempted while the lock is held
        mock_create_payment_intent.assert_not_called()


@pytest.mark.asyncio
class TestProcessStalePaymentLocks:
    async def test_enqueues_stale_locked_orders(
        self,
        save_fixture: SaveFixture,
        product: Product,
        organization: Organization,
        mocker: MockerFixture,
    ) -> None:
        # Given
        customer = await create_customer(save_fixture, organization=organization)
        order = await create_order(
            save_fixture,
            product=product,
            customer=customer,
            status=OrderStatus.pending,
            payment_lock_acquired_at=utc_now() - timedelta(hours=2),
        )

        enqueue_job_mock = mocker.patch("polar.order.tasks.enqueue_job")

        # When
        await process_stale_payment_locks()

        # Then
        enqueue_job_mock.assert_called_once_with(
            "order.process_stale_payment_lock_order",
            order.id,
        )

    async def test_fresh_lock_skipped(
        self,
        save_fixture: SaveFixture,
        product: Product,
        organization: Organization,
        mocker: MockerFixture,
    ) -> None:
        # Given a lock acquired recently (within the stale threshold)
        customer = await create_customer(save_fixture, organization=organization)
        await create_order(
            save_fixture,
            product=product,
            customer=customer,
            status=OrderStatus.pending,
            payment_lock_acquired_at=utc_now(),
        )

        enqueue_job_mock = mocker.patch("polar.order.tasks.enqueue_job")

        # When
        await process_stale_payment_locks()

        # Then
        enqueue_job_mock.assert_not_called()

    async def test_unlocked_order_skipped(
        self,
        save_fixture: SaveFixture,
        product: Product,
        organization: Organization,
        mocker: MockerFixture,
    ) -> None:
        # Given an order without a payment lock
        customer = await create_customer(save_fixture, organization=organization)
        await create_order(
            save_fixture,
            product=product,
            customer=customer,
            status=OrderStatus.pending,
        )

        enqueue_job_mock = mocker.patch("polar.order.tasks.enqueue_job")

        # When
        await process_stale_payment_locks()

        # Then
        enqueue_job_mock.assert_not_called()


@pytest.mark.asyncio
class TestProcessStalePaymentLockOrder:
    async def test_requests_cancellation_without_releasing_lock(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        product: Product,
        organization: Organization,
        mocker: MockerFixture,
    ) -> None:
        # Given
        customer = await create_customer(save_fixture, organization=organization)
        order = await create_order(
            save_fixture,
            product=product,
            customer=customer,
            status=OrderStatus.pending,
            payment_lock_acquired_at=utc_now() - timedelta(hours=2),
        )

        mocker.patch(
            "polar.order.service.stripe_service.get_payment_intents_for_order",
            return_value=[
                build_stripe_payment_intent(id="pi_stale", status="requires_action")
            ],
        )
        cancel_mock = mocker.patch(
            "polar.order.service.stripe_service.cancel_payment_intent",
        )

        # When
        await process_stale_payment_lock_order(order.id)

        # Then — cancellation requested, lock left in place for the webhook
        cancel_mock.assert_called_once_with("pi_stale")
        order_repository = OrderRepository.from_session(session)
        updated_order = await order_repository.get_by_id(order.id)
        assert updated_order is not None
        assert updated_order.payment_lock_acquired_at is not None

    async def test_resolved_payment_intents_left_alone(
        self,
        save_fixture: SaveFixture,
        product: Product,
        organization: Organization,
        mocker: MockerFixture,
    ) -> None:
        """Terminal intents from earlier dunning cycles must not be cancelled."""
        customer = await create_customer(save_fixture, organization=organization)
        order = await create_order(
            save_fixture,
            product=product,
            customer=customer,
            status=OrderStatus.pending,
            payment_lock_acquired_at=utc_now() - timedelta(hours=2),
        )

        mocker.patch(
            "polar.order.service.stripe_service.get_payment_intents_for_order",
            return_value=[
                build_stripe_payment_intent(id="pi_old", status="canceled"),
                build_stripe_payment_intent(id="pi_settling", status="processing"),
            ],
        )
        cancel_mock = mocker.patch(
            "polar.order.service.stripe_service.cancel_payment_intent",
        )

        # When
        await process_stale_payment_lock_order(order.id)

        # Then
        cancel_mock.assert_not_called()

    async def test_already_resolved_payment_intent_skipped(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        product: Product,
        organization: Organization,
        mocker: MockerFixture,
    ) -> None:
        """If the intent resolves between the search and the cancellation, Stripe
        rejects the cancel; we log and leave the lock for the resolving webhook."""
        customer = await create_customer(save_fixture, organization=organization)
        order = await create_order(
            save_fixture,
            product=product,
            customer=customer,
            status=OrderStatus.pending,
            payment_lock_acquired_at=utc_now() - timedelta(hours=2),
        )

        mocker.patch(
            "polar.order.service.stripe_service.get_payment_intents_for_order",
            return_value=[
                build_stripe_payment_intent(id="pi_succeeded", status="requires_action")
            ],
        )
        cancel_mock = mocker.patch(
            "polar.order.service.stripe_service.cancel_payment_intent",
            side_effect=stripe_lib.InvalidRequestError(
                "You cannot cancel this PaymentIntent because it has a status of "
                "succeeded.",
                param="intent",
                code="payment_intent_unexpected_state",
            ),
        )

        # When / Then — must not raise
        await process_stale_payment_lock_order(order.id)

        cancel_mock.assert_called_once_with("pi_succeeded")
        order_repository = OrderRepository.from_session(session)
        updated_order = await order_repository.get_by_id(order.id)
        assert updated_order is not None
        assert updated_order.payment_lock_acquired_at is not None

    async def test_generic_stripe_error_retries_next_run(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        product: Product,
        organization: Organization,
        mocker: MockerFixture,
    ) -> None:
        """A transient Stripe error must not release the lock; the next scheduled
        run retries the cancellation."""
        customer = await create_customer(save_fixture, organization=organization)
        order = await create_order(
            save_fixture,
            product=product,
            customer=customer,
            status=OrderStatus.pending,
            payment_lock_acquired_at=utc_now() - timedelta(hours=2),
        )

        mocker.patch(
            "polar.order.service.stripe_service.get_payment_intents_for_order",
            return_value=[
                build_stripe_payment_intent(id="pi_stale", status="requires_action")
            ],
        )
        cancel_mock = mocker.patch(
            "polar.order.service.stripe_service.cancel_payment_intent",
            side_effect=stripe_lib.APIError("Stripe is down"),
        )

        # When / Then — must not raise
        await process_stale_payment_lock_order(order.id)

        cancel_mock.assert_called_once_with("pi_stale")
        order_repository = OrderRepository.from_session(session)
        updated_order = await order_repository.get_by_id(order.id)
        assert updated_order is not None
        assert updated_order.payment_lock_acquired_at is not None

    async def test_no_payment_intent_found(
        self,
        save_fixture: SaveFixture,
        product: Product,
        organization: Organization,
        mocker: MockerFixture,
    ) -> None:
        """A stale lock with nothing left to cancel is left for reconciliation."""
        customer = await create_customer(save_fixture, organization=organization)
        order = await create_order(
            save_fixture,
            product=product,
            customer=customer,
            status=OrderStatus.pending,
            payment_lock_acquired_at=utc_now() - timedelta(hours=2),
        )

        mocker.patch(
            "polar.order.service.stripe_service.get_payment_intents_for_order",
            return_value=[],
        )
        cancel_mock = mocker.patch(
            "polar.order.service.stripe_service.cancel_payment_intent",
        )

        # When
        await process_stale_payment_lock_order(order.id)

        # Then
        cancel_mock.assert_not_called()

    async def test_order_not_found(self) -> None:
        with pytest.raises(OrderDoesNotExist):
            await process_stale_payment_lock_order(uuid.uuid4())
