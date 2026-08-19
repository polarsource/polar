from typing import Any

import pytest
from sqlalchemy import select, update

from polar.kit.db.postgres import AsyncSession
from polar.models import Product
from polar.models.product_price import ProductPriceSeatUnit
from polar.product.tiers import (
    NonContiguousTiersError,
    SeatTierType,
    seat_tiers_to_tiers,
)
from scripts.backfill_product_price_tiers import run_backfill
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import create_product_price_seat_unit

TIERS: list[dict[str, Any]] = [
    {"min_seats": 1, "max_seats": 10, "price_per_seat": 1000},
    {"min_seats": 11, "max_seats": None, "price_per_seat": 800},
]

LEGACY_SEAT_TIERS = {
    "seat_tier_type": SeatTierType.graduated,
    "tiers": TIERS,
}


async def _legacy_seat_price(
    save_fixture: SaveFixture,
    product: Product,
) -> ProductPriceSeatUnit:
    """A seat price with empty shared columns and a filled unused
    `seat_tiers` column, like rows written before the cutover."""
    price = await create_product_price_seat_unit(
        save_fixture,
        product=product,
        tiers=TIERS,
        seat_tier_type=SeatTierType.graduated,
    )
    price._seat_tiers = LEGACY_SEAT_TIERS  # type: ignore[assignment]
    price.tiers = None  # type: ignore[assignment]
    price.minimum_units = None
    price.maximum_units = None
    await save_fixture(price)
    return price


async def _get_tier_columns(
    session: AsyncSession, price: ProductPriceSeatUnit
) -> tuple[object, int | None, int | None]:
    result = await session.execute(
        select(
            ProductPriceSeatUnit.tiers,
            ProductPriceSeatUnit.minimum_units,
            ProductPriceSeatUnit.maximum_units,
        ).where(ProductPriceSeatUnit.id == price.id)
    )
    return result.tuples().one()


@pytest.mark.asyncio
class TestBackfillProductPriceTiers:
    async def test_backfills_legacy_rows(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        product: Product,
    ) -> None:
        price = await _legacy_seat_price(save_fixture, product)

        updated = await run_backfill(dry_run=False, session=session)

        assert updated == 1
        tiers, minimum_units, maximum_units = await _get_tier_columns(session, price)
        assert tiers == seat_tiers_to_tiers(LEGACY_SEAT_TIERS)  # type: ignore[arg-type]
        assert minimum_units == 1
        assert maximum_units is None

    async def test_dry_run_counts_without_writing(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        product: Product,
    ) -> None:
        price = await _legacy_seat_price(save_fixture, product)

        counted = await run_backfill(dry_run=True, session=session)

        assert counted == 1
        assert await _get_tier_columns(session, price) == (None, None, None)

    async def test_dry_run_raises_on_invalid_tiers(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        product: Product,
    ) -> None:
        price = await _legacy_seat_price(save_fixture, product)
        await session.execute(
            update(ProductPriceSeatUnit)
            .where(ProductPriceSeatUnit.id == price.id)
            .values(
                _seat_tiers={
                    "seat_tier_type": SeatTierType.volume,
                    "tiers": [
                        {"min_seats": 1, "max_seats": 5, "price_per_seat": 1000},
                        {"min_seats": 10, "max_seats": None, "price_per_seat": 800},
                    ],
                }
            )
        )
        await session.flush()
        session.expire(price)

        with pytest.raises(NonContiguousTiersError):
            await run_backfill(dry_run=True, session=session)

        assert await _get_tier_columns(session, price) == (None, None, None)

    async def test_skips_rows_that_already_have_tiers(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        product: Product,
    ) -> None:
        price = await create_product_price_seat_unit(
            save_fixture,
            product=product,
            tiers=TIERS,
            seat_tier_type=SeatTierType.graduated,
        )
        original = await _get_tier_columns(session, price)
        price._seat_tiers = {
            "seat_tier_type": SeatTierType.volume,
            "tiers": [{"min_seats": 1, "max_seats": None, "price_per_seat": 1}],
        }
        await save_fixture(price)

        updated = await run_backfill(dry_run=False, session=session)

        assert updated == 0
        assert await _get_tier_columns(session, price) == original

    async def test_idempotent(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        product: Product,
    ) -> None:
        price = await _legacy_seat_price(save_fixture, product)

        first_count = await run_backfill(dry_run=False, session=session)
        first = await _get_tier_columns(session, price)
        second_count = await run_backfill(dry_run=False, session=session)
        second = await _get_tier_columns(session, price)

        assert first_count == 1
        assert second_count == 0
        assert first == second
