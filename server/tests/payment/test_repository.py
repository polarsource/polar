import pytest

from polar.enums import PaymentProcessor
from polar.models import Customer, Product
from polar.models.payment import PaymentStatus
from polar.payment.repository import PaymentRepository
from polar.postgres import AsyncSession
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import create_order, create_payment


@pytest.mark.asyncio
class TestGetAllByOrder:
    async def test_returns_all_payments_for_order(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        product: Product,
        customer: Customer,
    ) -> None:
        # Create an order
        order = await create_order(
            save_fixture,
            product=product,
            customer=customer,
        )

        # Create multiple payments for the order
        payment_repository = PaymentRepository.from_session(session)

        payment1 = await create_payment(
            save_fixture,
            customer.organization,
            status=PaymentStatus.succeeded,
            amount=1000,
            processor_id="ch_test_1",
            order=order,
        )

        payment2 = await create_payment(
            save_fixture,
            customer.organization,
            status=PaymentStatus.failed,
            amount=1000,
            processor_id="ch_test_2",
            order=order,
        )

        # Get all payments for the order
        payments = await payment_repository.get_all_by_order(order.id)

        # Verify payments were returned
        assert len(payments) == 2
        payment_ids = {p.id for p in payments}
        assert payment1.id in payment_ids
        assert payment2.id in payment_ids

    async def test_returns_empty_list_for_order_without_payments(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        product: Product,
        customer: Customer,
    ) -> None:
        # Create an order without payments
        order = await create_order(
            save_fixture,
            product=product,
            customer=customer,
        )

        payment_repository = PaymentRepository.from_session(session)

        # Get all payments for the order
        payments = await payment_repository.get_all_by_order(order.id)

        # Verify no payments were returned
        assert len(payments) == 0

    async def test_returns_payments_ordered_by_created_at_desc(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        product: Product,
        customer: Customer,
    ) -> None:
        # Create an order
        order = await create_order(
            save_fixture,
            product=product,
            customer=customer,
        )

        payment_repository = PaymentRepository.from_session(session)

        # Create multiple payments with different timestamps
        payment1 = await create_payment(
            save_fixture,
            customer.organization,
            status=PaymentStatus.succeeded,
            amount=1000,
            processor_id="ch_test_1",
            order=order,
        )

        payment2 = await create_payment(
            save_fixture,
            customer.organization,
            status=PaymentStatus.succeeded,
            amount=1000,
            processor_id="ch_test_2",
            order=order,
        )

        # Get all payments for the order
        payments = await payment_repository.get_all_by_order(order.id)

        # Verify payments are ordered by created_at descending
        assert len(payments) == 2
        assert payments[0].id == payment2.id  # Most recent first
        assert payments[1].id == payment1.id
