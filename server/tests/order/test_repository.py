from collections.abc import AsyncGenerator

import pytest
from pytest_mock import MockerFixture
from sqlalchemy import Select
from sqlalchemy.dialects import postgresql

from polar.models import Order
from polar.order.repository import OrderRepository
from polar.postgres import AsyncSession


@pytest.mark.asyncio
class TestStreamStalePaymentLock:
    async def test_predicate_stays_indexable(
        self, mocker: MockerFixture, session: AsyncSession
    ) -> None:
        captured: list[Select[tuple[Order]]] = []

        async def capture(
            self: OrderRepository, statement: Select[tuple[Order]]
        ) -> AsyncGenerator[Order, None]:
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
