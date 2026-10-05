from collections.abc import AsyncGenerator

import pytest
from pytest_mock import MockerFixture
from sqlalchemy import Select, update
from sqlalchemy.dialects import postgresql

from polar.kit.utils import utc_now
from polar.models import Customer, Order, Organization
from polar.models.order import OrderStatus
from polar.models.payment import PaymentStatus
from polar.order.repository import OrderRepository
from polar.order.sorting import OrderSortProperty
from polar.postgres import AsyncSession
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import create_order, create_payment


@pytest.mark.asyncio
class TestAcquirePaymentLock:
    @pytest.mark.parametrize(
        "payment_status",
        [PaymentStatus.pending, PaymentStatus.failed, PaymentStatus.succeeded],
    )
    async def test_payment_status_guard(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        customer: Customer,
        organization: Organization,
        payment_status: PaymentStatus,
    ) -> None:
        order = await create_order(save_fixture, customer=customer)
        payment = await create_payment(
            save_fixture, organization, order=order, status=payment_status
        )
        repository = OrderRepository.from_session(session)

        acquired = await repository.acquire_payment_lock_by_id(order.id)
        assert acquired == (payment_status != PaymentStatus.pending)
        await session.refresh(order)
        assert (order.payment_lock_acquired_at is not None) == acquired

        if payment_status == PaymentStatus.pending:
            payment.status = PaymentStatus.failed
            await save_fixture(payment)
            assert await repository.acquire_payment_lock_by_id(order.id)

    async def test_pending_payment_for_other_order_does_not_block(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        customer: Customer,
        organization: Organization,
    ) -> None:
        order = await create_order(save_fixture, customer=customer)
        other_order = await create_order(save_fixture, customer=customer)
        await create_payment(
            save_fixture,
            organization,
            order=other_order,
            status=PaymentStatus.pending,
        )

        repository = OrderRepository.from_session(session)
        assert await repository.acquire_payment_lock_by_id(order.id)


@pytest.mark.asyncio
class TestReleasePaymentLock:
    @pytest.mark.parametrize("stale", [False, True])
    async def test_releases_lock(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        customer: Customer,
        stale: bool,
    ) -> None:
        order = await create_order(save_fixture, customer=customer)
        assert order.payment_lock_acquired_at is None
        await session.execute(
            update(Order)
            .where(Order.id == order.id)
            .values(payment_lock_acquired_at=utc_now())
            .execution_options(synchronize_session=False if stale else "fetch")
        )
        assert (order.payment_lock_acquired_at is None) == stale

        repository = OrderRepository.from_session(session)
        await repository.release_payment_lock(order)
        assert order.payment_lock_acquired_at is None
        await session.refresh(order)

        assert order.payment_lock_acquired_at is None


@pytest.mark.asyncio
class TestGetSortingClause:
    async def test_status(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        customer: Customer,
    ) -> None:
        expected_statuses = [
            OrderStatus.draft,
            OrderStatus.pending,
            OrderStatus.paid,
            OrderStatus.partially_refunded,
            OrderStatus.refunded,
            OrderStatus.void,
        ]
        for status in reversed(expected_statuses):
            await create_order(save_fixture, customer=customer, status=status)

        repository = OrderRepository.from_session(session)
        statement = repository.apply_sorting(
            repository.get_base_statement(),
            [(OrderSortProperty.status, False)],
        )
        orders = await repository.get_all(statement)

        assert [order.status for order in orders] == expected_statuses


@pytest.mark.asyncio
class TestStreamStalePaymentLock:
    async def test_predicate_stays_indexable(
        self, mocker: MockerFixture, session: AsyncSession
    ) -> None:
        captured: list[Select[tuple[Order]]] = []

        async def capture(
            self: OrderRepository, statement: Select[tuple[Order]]
        ) -> AsyncGenerator[Order]:
            captured.append(statement)
            empty: list[Order] = []
            for order in empty:
                yield order

        mocker.patch.object(OrderRepository, "stream", capture)

        repository = OrderRepository.from_session(session)
        async for _ in repository.stream_stale_payment_lock():
            pass

        compiled = str(captured[0].compile(dialect=postgresql.dialect()))
        # Wrapping the comparison in `IS TRUE` costs us
        # ix_orders_payment_lock_acquired_at and scans every order.
        assert "IS true" not in compiled
        assert "orders.payment_lock_acquired_at <= now()" in compiled
