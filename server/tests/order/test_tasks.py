from datetime import timedelta

import pytest
from pytest_mock import MockerFixture

from polar.kit.db.postgres import AsyncSession
from polar.kit.utils import utc_now
from polar.models import Organization, Product
from polar.models.order import OrderBillingReason, OrderStatus
from polar.models.payment import PaymentStatus
from polar.models.subscription import SubscriptionStatus
from polar.order.repository import OrderRepository
from polar.order.service import order as order_service
from polar.order.tasks import process_dunning
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
    async def test_order_without_subscription_skipped(
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

        enqueue_job_mock = mocker.patch("polar.order.service.enqueue_job")

        # When
        await process_dunning()

        # Then
        enqueue_job_mock.assert_not_called()

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

        enqueue_job_mock = mocker.patch("polar.order.service.enqueue_job")

        # When
        await process_dunning()

        # Then
        enqueue_job_mock.assert_not_called()

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
        await process_dunning()

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
        customer = await create_customer(save_fixture, organization=organization)
        subscription = await create_subscription(
            save_fixture,
            product=product,
            customer=customer,
            status=SubscriptionStatus.active,
        )
        subscription.payment_method_id = None
        await save_fixture(subscription)

        past_time = utc_now() - timedelta(hours=1)
        order = await create_order(
            save_fixture,
            product=product,
            customer=customer,
            subscription=subscription,
            status=OrderStatus.pending,
            billing_reason=OrderBillingReason.subscription_cycle,
        )
        order.next_payment_attempt_at = past_time
        await save_fixture(order)

        enqueue_job_mock = mocker.patch("polar.order.service.enqueue_job")

        # When
        await process_dunning()

        # Then
        enqueue_job_mock.assert_not_called()

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

        past_time = utc_now() - timedelta(hours=1)
        order = await create_order(
            save_fixture,
            product=product,
            customer=customer,
            subscription=subscription,
            status=OrderStatus.pending,
            billing_reason=OrderBillingReason.subscription_cycle,
        )
        order.next_payment_attempt_at = past_time
        await save_fixture(order)

        enqueue_job_mock = mocker.patch("polar.order.service.enqueue_job")

        # When
        await process_dunning()

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
            stripe_subscription_id=None,
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
            billing_reason=OrderBillingReason.subscription_cycle,
        )
        order.next_payment_attempt_at = past_time
        await save_fixture(order)

        payment = await create_payment(
            save_fixture,
            organization=customer.organization,
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
            stripe_subscription_id=None,
        )

        first_retry_time = utc_now() - timedelta(hours=1)
        order = await create_order(
            save_fixture,
            product=product,
            customer=customer,
            subscription=subscription,
            status=OrderStatus.pending,
            billing_reason=OrderBillingReason.subscription_cycle,
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
            stripe_subscription_id=None,
        )

        very_old_time = utc_now() - timedelta(days=30)
        order = await create_order(
            save_fixture,
            product=product,
            customer=customer,
            subscription=subscription,
            status=OrderStatus.pending,
            billing_reason=OrderBillingReason.subscription_cycle,
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
