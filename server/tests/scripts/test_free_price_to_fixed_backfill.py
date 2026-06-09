import uuid
from typing import Any, cast

import pytest
from sqlalchemy import CursorResult, select

from polar.enums import SubscriptionRecurringInterval
from polar.kit.db.postgres import AsyncSession
from polar.models import Organization, ProductPrice
from polar.models.product_price import (
    LegacyRecurringProductPriceFree,
    ProductPriceAmountType,
    ProductPriceType,
)
from scripts.free_price_to_fixed_backfill import update_statement
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import (
    create_product,
    create_product_price_custom,
    create_product_price_fixed,
    create_product_price_free,
)

product_prices = ProductPrice.__table__


async def _row(
    session: AsyncSession, price_id: uuid.UUID
) -> tuple[str, int | None, str | None]:
    result = await session.execute(
        select(
            product_prices.c.amount_type,
            product_prices.c.price_amount_v2,
            product_prices.c.type,
        ).where(product_prices.c.id == price_id)
    )
    row = result.one()
    return row.amount_type, row.price_amount_v2, row.type


@pytest.mark.asyncio
async def test_free_price_to_fixed_backfill(
    save_fixture: SaveFixture,
    session: AsyncSession,
    organization: Organization,
) -> None:
    product = await create_product(
        save_fixture, organization=organization, recurring_interval=None, prices=[]
    )

    free = await create_product_price_free(save_fixture, product=product)
    legacy_free = LegacyRecurringProductPriceFree(
        product=product, price_currency="usd", tax_behavior=None, is_archived=False
    )
    legacy_free.type = ProductPriceType.recurring
    legacy_free.recurring_interval = SubscriptionRecurringInterval.month
    await save_fixture(legacy_free)
    fixed = await create_product_price_fixed(save_fixture, product=product, amount=1000)
    custom = await create_product_price_custom(save_fixture, product=product)

    result = await session.execute(update_statement, {"limit": 1000})
    await session.commit()
    # Only the two free prices are converted.
    assert cast(CursorResult[Any], result).rowcount == 2

    # New free price -> fixed amount 0, `type` stays NULL (identity: fixed).
    assert await _row(session, free.id) == (ProductPriceAmountType.fixed, 0, None)

    # Legacy recurring free price -> fixed amount 0, `type` stays "recurring"
    # (identity: legacy_fixed).
    assert await _row(session, legacy_free.id) == (
        ProductPriceAmountType.fixed,
        0,
        "recurring",
    )

    # Paid fixed price is left untouched.
    assert await _row(session, fixed.id) == (ProductPriceAmountType.fixed, 1000, None)

    # Custom price is left untouched.
    amount_type, _, _ = await _row(session, custom.id)
    assert amount_type == ProductPriceAmountType.custom

    # Idempotent: a second run converts nothing.
    result = await session.execute(update_statement, {"limit": 1000})
    await session.commit()
    assert cast(CursorResult[Any], result).rowcount == 0
