import pytest

from polar.models import Customer, Product
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import create_order


@pytest.mark.parametrize(
    "amount,tax_amount,applied_balance_amount,total_refund_amount,expected_refund_amount,expected_refund_tax_amount",
    [
        pytest.param(
            1000, 250, 1000, 1250, 1000, 250, id="refund subtotal amount with tax"
        ),
        pytest.param(
            1000,
            250,
            1000,
            2250,
            2000,
            250,
            id="refund subtotal + balance with tax",
        ),
        pytest.param(
            1000, 250, -500, 750, 500, 250, id="full refund with negative balance"
        ),
    ],
)
@pytest.mark.asyncio
async def test_calculate_refunded_tax(
    amount: int,
    tax_amount: int,
    applied_balance_amount: int,
    total_refund_amount: int,
    expected_refund_amount: int,
    expected_refund_tax_amount: int,
    save_fixture: SaveFixture,
    product: Product,
    customer: Customer,
) -> None:
    order = await create_order(
        save_fixture,
        product=product,
        customer=customer,
        subtotal_amount=amount,
        tax_amount=tax_amount,
        applied_balance_amount=applied_balance_amount,
    )
    assert order.refunded_amount == 0
    assert order.refunded_tax_amount == 0

    refund_amount, refund_tax_amount = order.calculate_refunded_tax(total_refund_amount)

    assert refund_amount == expected_refund_amount
    assert refund_tax_amount == expected_refund_tax_amount
