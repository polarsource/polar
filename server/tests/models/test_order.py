import pytest

from polar.enums import TaxBehavior
from polar.models import Customer, Product
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import create_order


@pytest.mark.parametrize(
    (
        "tax_behavior",
        "subtotal_amount",
        "tax_amount",
        "applied_balance_amount",
        "total_refund_amount",
        "expected_refund_amount",
        "expected_refund_tax_amount",
    ),
    [
        pytest.param(
            TaxBehavior.exclusive,
            1000,
            250,
            1000,
            1250,
            1000,
            250,
            id="exclusive refund subtotal amount with tax",
        ),
        pytest.param(
            TaxBehavior.exclusive,
            1000,
            250,
            1000,
            2250,
            2000,
            250,
            id="exclusive refund subtotal + balance with tax",
        ),
        pytest.param(
            TaxBehavior.exclusive,
            1000,
            250,
            -500,
            750,
            500,
            250,
            id="exclusive full refund with negative balance",
        ),
        pytest.param(
            TaxBehavior.exclusive,
            1000,
            250,
            0,
            1300,
            1040,
            260,
            id="exclusive refund exceeding original amount",
        ),
        pytest.param(
            TaxBehavior.inclusive,
            1000,
            200,
            0,
            1000,
            800,
            200,
            id="inclusive full amount",
        ),
        pytest.param(
            TaxBehavior.inclusive,
            1000,
            200,
            0,
            500,
            400,
            100,
            id="inclusive half amount",
        ),
    ],
)
@pytest.mark.asyncio
async def test_calculate_refunded_tax_from_total(
    tax_behavior: TaxBehavior,
    subtotal_amount: int,
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
        subtotal_amount=subtotal_amount,
        tax_amount=tax_amount,
        applied_balance_amount=applied_balance_amount,
        tax_behavior=tax_behavior,
    )
    assert order.refunded_amount == 0
    assert order.refunded_tax_amount == 0
    assert order.net_amount == subtotal_amount - (
        tax_amount if tax_behavior == TaxBehavior.inclusive else 0
    )

    refund_amount, refund_tax_amount = order.calculate_refunded_tax_from_total(
        total_refund_amount
    )

    assert refund_amount == expected_refund_amount
    assert refund_tax_amount == expected_refund_tax_amount


@pytest.mark.parametrize(
    (
        "tax_behavior",
        "subtotal_amount",
        "tax_amount",
        "applied_balance_amount",
        "refund_amount",
        "expected_refund_tax_amount",
    ),
    [
        pytest.param(
            TaxBehavior.exclusive, 1000, 250, 0, 1000, 250, id="exclusive full amount"
        ),
        pytest.param(
            TaxBehavior.exclusive,
            1000,
            250,
            1000,
            2000,
            250,
            id="exclusive full amount with applied balance",
        ),
        pytest.param(
            TaxBehavior.exclusive,
            1000,
            250,
            1000,
            500,
            125,
            id="exclusive sub amount with applied balance",
        ),
        pytest.param(
            TaxBehavior.inclusive, 1000, 200, 0, 800, 200, id="inclusive full amount"
        ),
        pytest.param(
            TaxBehavior.inclusive, 1000, 200, 0, 400, 100, id="inclusive half amount"
        ),
    ],
)
@pytest.mark.asyncio
async def test_calculate_refunded_tax_from_subtotal(
    tax_behavior: TaxBehavior,
    subtotal_amount: int,
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
        subtotal_amount=subtotal_amount,
        tax_amount=tax_amount,
        applied_balance_amount=applied_balance_amount,
        tax_behavior=tax_behavior,
    )
    assert order.refunded_amount == 0
    assert order.refunded_tax_amount == 0

    refund_tax_amount = order.calculate_refunded_tax_from_subtotal(refund_amount)

    assert refund_tax_amount == expected_refund_tax_amount
