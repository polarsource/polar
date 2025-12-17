import uuid
from datetime import timedelta

import pytest
import stripe as stripe_lib
from dramatiq import Retry
from pytest_mock import MockerFixture

from polar.kit.db.postgres import AsyncSession
from polar.kit.utils import utc_now
from polar.models import Organization, Product
from polar.models.order import OrderBillingReasonInternal, OrderStatus
from polar.models.payment import PaymentStatus
from polar.models.subscription import SubscriptionStatus
from polar.order.repository import OrderRepository
from polar.order.service import order as order_service
from polar.order.tasks import (
    OrderDoesNotExist,
    process_dunning,
    process_dunning_order,
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
        caplog: pytest.LogCaptureFixture,
    ) -> None:
        # Given
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
        assert "Order has no subscription, skipping dunning" in caplog.text

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
        caplog: pytest.LogCaptureFixture,
    ) -> None:
        # Given
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
        assert (
            "Order subscription has no payment method, record a failure" in caplog.text
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

        # Create 4 failed payments to exhaust all retry attempts
        for _ in range(4):
            await create_payment(
                save_fixture,
                organization,
                status=PaymentStatus.failed,
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
            return_value=None,
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
