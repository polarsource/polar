import pytest

from polar.models import Meter, Product
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import create_product_price_metered_unit


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "unit_amount, included_units, cap_amount, units, expected",
    [
        (1_00, 0, None, 1, 1_00),
        (1_00, 0, None, 1.994, 1_99),
        (1_00, 0, None, 1.995, 2_00),
        (1_00, 0, None, 1.996, 2_00),
        (1_00, 50, None, 100, 50_00),
        (1_00, 0, 50_00, 1000, 50_00),
        (1_00, 0, 50_00, 1, 1_00),
    ],
)
async def test_get_amount_and_label(
    unit_amount: int,
    included_units: int,
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
        included_units=included_units,
        cap_amount=cap_amount,
    )

    amount, _ = price.get_amount_and_label(units)
    assert amount == expected
