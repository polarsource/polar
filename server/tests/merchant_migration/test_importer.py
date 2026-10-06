import pytest

from polar.merchant_migration.importer import (
    ADD_ON_PRODUCT_METADATA_KEY,
    add_on_product_name,
    find_or_create_add_on_product,
)
from polar.models import Benefit, Product, ProductPriceFixed
from polar.postgres import AsyncSession
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import (
    create_product_price_fixed,
    set_product_benefits,
)


@pytest.mark.parametrize(
    ("add_on_name", "expected"),
    [
        ("+ 1 Project", "Essentials + 1 Project"),
        ("Project slot", "Essentials + Project slot"),
        (None, "Essentials + Add-on"),
        ("x" * 80, f"Essentials + {'x' * 51}"),
    ],
)
def test_add_on_product_name(add_on_name: str | None, expected: str) -> None:
    assert add_on_product_name("Essentials", add_on_name) == expected


@pytest.mark.asyncio
class TestFindOrCreateAddOnProduct:
    async def test_creates_an_archived_product_with_the_plan_benefits(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        product: Product,
        benefit_organization: Benefit,
    ) -> None:
        await set_product_benefits(
            save_fixture, product=product, benefits=[benefit_organization]
        )
        plan_price = product.prices[0]
        assert isinstance(plan_price, ProductPriceFixed)

        combined, fixed, unit = await find_or_create_add_on_product(
            session,
            product,
            plan_price,
            add_on_price_source_id="price_slot",
            unit_amount=250,
            name="Pro + Slot",
        )

        assert combined.id != product.id
        assert combined.is_archived is True
        assert combined.recurring_interval == product.recurring_interval
        assert combined.user_metadata == {
            ADD_ON_PRODUCT_METADATA_KEY: f"{product.id}:price_slot"
        }
        assert [link.benefit_id for link in combined.product_benefits] == [
            benefit_organization.id
        ]
        assert fixed.price_amount == plan_price.price_amount
        assert fixed.is_archived is False
        assert unit.calculate_amount(3) == 750

    async def test_reuses_the_product_and_archives_other_amounts(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        product: Product,
    ) -> None:
        plan_price = product.prices[0]
        assert isinstance(plan_price, ProductPriceFixed)
        legacy_price = await create_product_price_fixed(
            save_fixture, product=product, amount=800, is_archived=True
        )
        first, _, first_unit = await find_or_create_add_on_product(
            session,
            product,
            plan_price,
            add_on_price_source_id="price_slot",
            unit_amount=250,
            name="Pro + Slot",
        )

        second, legacy_fixed, second_unit = await find_or_create_add_on_product(
            session,
            product,
            legacy_price,
            add_on_price_source_id="price_slot",
            unit_amount=300,
            name="Pro + Slot",
        )

        assert second.id == first.id
        assert legacy_fixed.price_amount == 800
        assert legacy_fixed.is_archived is True
        assert second_unit.id != first_unit.id
        assert second_unit.is_archived is True
        assert second_unit.calculate_amount(2) == 600
