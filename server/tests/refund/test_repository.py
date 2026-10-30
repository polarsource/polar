import pytest

from polar.models import Customer, Product
from polar.postgres import AsyncSession
from polar.refund.repository import RefundRepository
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import create_order_and_payment, create_refund


@pytest.mark.anyio
class TestGetRevertedAmounts:
    @pytest.mark.parametrize("recorded", [False, True], ids=["empty", "recorded"])
    async def test_returns_integer_minor_units(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        product: Product,
        customer: Customer,
        recorded: bool,
    ) -> None:
        order, payment, _ = await create_order_and_payment(
            save_fixture,
            product=product,
            customer=customer,
            subtotal_amount=10000,
            tax_amount=2000,
        )
        current = await create_refund(
            save_fixture,
            order,
            payment,
            amount=0,
            tax_amount=1000,
            processor_id="current",
        )
        if recorded:
            previous = await create_refund(
                save_fixture,
                order,
                payment,
                amount=500,
                tax_amount=1000,
                processor_id="previous",
            )
            previous.tax_transaction_processor_id = "tax_refund_previous"

        amounts = await RefundRepository.from_session(session).get_reverted_amounts(
            order.id, exclude_refund_id=current.id
        )

        assert all(isinstance(amount, int) for amount in amounts)
        assert amounts == ((1000, 1500) if recorded else (0, 0))
