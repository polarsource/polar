from decimal import Decimal

import pytest

from polar.models import Meter, Product
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import create_product_price_metered_unit


@pytest.mark.asyncio
@pytest.mark.parametrize(
    ("unit_amount", "cap_amount", "units", "expected"),
    [
        (Decimal(1_00), None, 1, 1_00),
        (Decimal(1_00), None, 1.994, 1_99),
        (Decimal(1_00), None, 1.995, 2_00),
        (Decimal(1_00), None, 1.996, 2_00),
        (Decimal(1_00), 50_00, 1000, 50_00),
        (Decimal(1_00), 50_00, 1, 1_00),
        (Decimal("0.000000000001"), None, 1_000_000, 0),
        (Decimal("0.000000000001"), None, 1_000_000_000_000, 1),
    ],
)
async def test_get_amount_and_label(
    unit_amount: Decimal,
    cap_amount: int | None,
    units: float,
    expected: int,
    save_fixture: SaveFixture,
    product: Product,
    meter: Meter,
) -> None:
    price = await create_product_price_metered_unit(
        save_fixture,
        product=product,
        meter=meter,
        unit_amount=unit_amount,
        cap_amount=cap_amount,
    )

    amount, _ = price.get_amount_and_label(units)
    assert amount == expected


@pytest.mark.asyncio
@pytest.mark.parametrize(
    ("unit_amount", "cap_amount", "units", "expected_label"),
    [
        # Full precision unit price: $0.005 should not be rounded to $0.00
        (
            Decimal("0.5"),
            None,
            100,
            "(100 consumed units) × $0.005",
        ),
        # Negative units should display as 0
        (
            Decimal(1_00),
            None,
            -5,
            "(0 consumed units) × $1.00",
        ),
        # Standard case
        (
            Decimal(1_00),
            None,
            10,
            "(10 consumed units) × $1.00",
        ),
        # Capped
        (
            Decimal(1_00),
            5_00,
            1000,
            "(1,000 consumed units) × $1.00— Capped at $5.00",
        ),
    ],
)
async def test_get_amount_and_label_label(
    unit_amount: Decimal,
    cap_amount: int | None,
    units: float,
    expected_label: str,
    save_fixture: SaveFixture,
    product: Product,
    meter: Meter,
) -> None:
    price = await create_product_price_metered_unit(
        save_fixture,
        product=product,
        meter=meter,
        unit_amount=unit_amount,
        cap_amount=cap_amount,
    )

    _, label = price.get_amount_and_label(units)
    assert label == expected_label
