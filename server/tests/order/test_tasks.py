from datetime import timedelta

import pytest
from pytest_mock import MockerFixture

from polar.kit.db.postgres import AsyncSession
from polar.kit.utils import utc_now
from polar.models import Organization, Product
from polar.models.order import OrderBillingReason, OrderStatus
from polar.models.subscription import SubscriptionStatus
from polar.order.repository import OrderRepository
from polar.order.tasks import process_dunning
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import (
    create_customer,
    create_order,
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
            billing_reason=OrderBillingReason.purchase,
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
            billing_reason=OrderBillingReason.purchase,
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
            billing_reason=OrderBillingReason.subscription_cycle,
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
