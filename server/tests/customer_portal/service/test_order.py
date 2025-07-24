from unittest.mock import Mock

import pytest

from polar.auth.models import AuthSubject
from polar.customer_portal.service.order import (
    CustomerOrderSortProperty,
    OrderNotEligibleForRetry,
    PaymentAlreadyInProgress,
)
from polar.customer_portal.service.order import customer_order as customer_order_service
from polar.kit.db.postgres import AsyncSession
from polar.kit.pagination import PaginationParams
from polar.kit.sorting import Sorting
from polar.kit.utils import utc_now
from polar.models import Customer, PaymentMethod, Product, Subscription
from polar.models.order import OrderStatus
from tests.fixtures.auth import AuthSubjectFixture
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import (
    create_order,
    create_payment_method,
)


@pytest.mark.asyncio
class TestList:
    @pytest.mark.auth(AuthSubjectFixture(subject="customer"))
    async def test_other_customer(
        self,
        auth_subject: AuthSubject[Customer],
        save_fixture: SaveFixture,
        session: AsyncSession,
        product: Product,
        customer_second: Customer,
    ) -> None:
        await create_order(save_fixture, product=product, customer=customer_second)

        orders, count = await customer_order_service.list(
            session, auth_subject, pagination=PaginationParams(1, 10)
        )

        assert count == 0
        assert len(orders) == 0

    @pytest.mark.auth(AuthSubjectFixture(subject="customer"))
    async def test_customer(
        self,
        auth_subject: AuthSubject[Customer],
        save_fixture: SaveFixture,
        session: AsyncSession,
        product: Product,
        customer: Customer,
    ) -> None:
        await create_order(save_fixture, product=product, customer=customer)

        orders, count = await customer_order_service.list(
            session, auth_subject, pagination=PaginationParams(1, 10)
        )

        assert count == 1
        assert len(orders) == 1

    @pytest.mark.parametrize(
        "sorting",
        [
            [("created_at", True)],
            [("amount", True)],
            [("organization", False)],
            [("product", False)],
            [("subscription", False)],
        ],
    )
    @pytest.mark.auth(AuthSubjectFixture(subject="customer"))
    async def test_sorting(
        self,
        sorting: list[Sorting[CustomerOrderSortProperty]],
        auth_subject: AuthSubject[Customer],
        save_fixture: SaveFixture,
        session: AsyncSession,
        product: Product,
        customer: Customer,
    ) -> None:
        await create_order(save_fixture, product=product, customer=customer)

        orders, count = await customer_order_service.list(
            session, auth_subject, pagination=PaginationParams(1, 10), sorting=sorting
        )

        assert count == 1
        assert len(orders) == 1


@pytest.mark.asyncio
class TestGetById:
    @pytest.mark.auth(AuthSubjectFixture(subject="customer"))
    async def test_other_customer(
        self,
        auth_subject: AuthSubject[Customer],
        save_fixture: SaveFixture,
        session: AsyncSession,
        product: Product,
        customer_second: Customer,
    ) -> None:
        order = await create_order(
            save_fixture, product=product, customer=customer_second
        )

        result = await customer_order_service.get_by_id(session, auth_subject, order.id)
        assert result is None

    @pytest.mark.auth(AuthSubjectFixture(subject="customer"))
    async def test_customer(
        self,
        auth_subject: AuthSubject[Customer],
        save_fixture: SaveFixture,
        session: AsyncSession,
        product: Product,
        customer: Customer,
    ) -> None:
        order = await create_order(save_fixture, product=product, customer=customer)

        result = await customer_order_service.get_by_id(session, auth_subject, order.id)

        assert result is not None
        assert result.id == order.id


@pytest.mark.asyncio
class TestRetryPayment:
    @pytest.mark.auth(AuthSubjectFixture(subject="customer"))
    async def test_order_not_eligible_no_next_attempt(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        product: Product,
        customer: Customer,
    ) -> None:
        order = await create_order(save_fixture, product=product, customer=customer)

        with pytest.raises(OrderNotEligibleForRetry):
            await customer_order_service.retry_payment(session, order)

    @pytest.mark.auth(AuthSubjectFixture(subject="customer"))
    async def test_order_not_eligible_paid_status(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        product: Product,
        customer: Customer,
    ) -> None:
        order = await create_order(save_fixture, product=product, customer=customer)
        order.status = OrderStatus.paid
        order.next_payment_attempt_at = utc_now()
        await save_fixture(order)

        with pytest.raises(OrderNotEligibleForRetry):
            await customer_order_service.retry_payment(session, order)

    @pytest.mark.auth(AuthSubjectFixture(subject="customer"))
    async def test_order_not_eligible_no_subscription(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        product: Product,
        customer: Customer,
    ) -> None:
        order = await create_order(save_fixture, product=product, customer=customer)
        order.status = OrderStatus.pending
        order.next_payment_attempt_at = utc_now()
        order.subscription = None
        await save_fixture(order)

        with pytest.raises(OrderNotEligibleForRetry):
            await customer_order_service.retry_payment(session, order)

    @pytest.mark.auth(AuthSubjectFixture(subject="customer"))
    async def test_payment_already_in_progress(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        product: Product,
        customer: Customer,
        subscription: Subscription,
    ) -> None:
        payment_method = await create_payment_method(save_fixture, customer=customer)
        subscription.payment_method = payment_method
        order = await create_order(
            save_fixture, product=product, customer=customer, subscription=subscription
        )
        order.status = OrderStatus.pending
        order.next_payment_attempt_at = utc_now()
        order.payment_lock_acquired_at = utc_now()
        await save_fixture(order)

        with pytest.raises(PaymentAlreadyInProgress):
            await customer_order_service.retry_payment(session, order)

    @pytest.mark.auth(AuthSubjectFixture(subject="customer"))
    async def test_no_payment_method(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        product: Product,
        customer: Customer,
        subscription: Subscription,
    ) -> None:
        order = await create_order(save_fixture, product=product, customer=customer)
        order.status = OrderStatus.pending
        order.next_payment_attempt_at = utc_now()
        order.subscription = subscription
        order.subscription.payment_method_id = None
        await save_fixture(order)

        with pytest.raises(OrderNotEligibleForRetry):
            await customer_order_service.retry_payment(session, order)

    @pytest.mark.auth(AuthSubjectFixture(subject="customer"))
    async def test_successful_retry(
        self,
        mocker: Mock,
        save_fixture: SaveFixture,
        session: AsyncSession,
        product: Product,
        customer: Customer,
        subscription: Subscription,
        payment_method: PaymentMethod,
    ) -> None:
        order = await create_order(save_fixture, product=product, customer=customer)
        order.status = OrderStatus.pending
        order.next_payment_attempt_at = utc_now()
        order.subscription = subscription
        order.subscription.payment_method_id = payment_method.id
        await save_fixture(order)

        enqueue_job_mock = mocker.patch(
            "polar.customer_portal.service.order.enqueue_job"
        )

        await customer_order_service.retry_payment(session, order)

        enqueue_job_mock.assert_called_once_with(
            "order.trigger_payment",
            order_id=order.id,
            payment_method_id=payment_method.id,
        )
