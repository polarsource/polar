import pytest

from polar.models import Customer, Product
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import create_order


@pytest.mark.parametrize(
    (
        "amount",
        "tax_amount",
        "applied_balance_amount",
        "total_refund_amount",
        "expected_refund_amount",
        "expected_refund_tax_amount",
    ),
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
        pytest.param(
            1000, 250, 0, 1300, 1040, 260, id="refund exceeding original amount"
        ),
    ],
)
@pytest.mark.asyncio
async def test_calculate_refunded_tax_from_total(
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

    refund_amount, refund_tax_amount = order.calculate_refunded_tax_from_total(
        total_refund_amount
    )

    assert refund_amount == expected_refund_amount
    assert refund_tax_amount == expected_refund_tax_amount


@pytest.mark.parametrize(
    (
        "amount",
        "tax_amount",
        "applied_balance_amount",
        "refund_amount",
        "expected_refund_tax_amount",
    ),
    [
        pytest.param(1000, 250, 0, 1000, 250, id="full amount"),
        pytest.param(1000, 250, 1000, 2000, 250, id="full amount with applied balance"),
        pytest.param(1000, 250, 1000, 500, 125, id="sub amount with applied balance"),
    ],
)
@pytest.mark.asyncio
async def test_calculate_refunded_tax_from_subtotal(
    amount: int,
    tax_amount: int,
    applied_balance_amount: int,
    refund_amount: int,
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

    refund_tax_amount = order.calculate_refunded_tax_from_subtotal(refund_amount)

    assert refund_tax_amount == expected_refund_tax_amount
