from collections.abc import AsyncGenerator

import pytest
from pytest_mock import MockerFixture
from sqlalchemy import Select
from sqlalchemy.dialects import postgresql

from polar.models import Customer, Order
from polar.models.order import OrderStatus
from polar.order.repository import OrderRepository
from polar.order.sorting import OrderSortProperty
from polar.postgres import AsyncSession
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import create_order


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
