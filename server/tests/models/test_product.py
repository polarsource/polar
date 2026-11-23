from decimal import Decimal

import pytest

from polar.enums import SubscriptionRecurringInterval
from polar.models import Meter, Organization
from polar.postgres import AsyncSession
from polar.product.repository import ProductRepository
from polar.product.tiers import Tiers, TierType
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import (
    create_product,
    create_product_price_fixed,
    create_product_price_metered_tiers,
    create_product_price_metered_unit,
    create_product_price_seat_unit,
    create_product_price_unit_based,
)


@pytest.mark.anyio
class TestPrices:
    async def test_seat_before_metered_unit(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        organization: Organization,
        meter: Meter,
    ) -> None:
        product = await create_product(
            save_fixture,
            organization=organization,
            recurring_interval=SubscriptionRecurringInterval.month,
            prices=[],
        )
        metered_price = await create_product_price_metered_unit(
            save_fixture, product=product, meter=meter, unit_amount=Decimal(100)
        )
        seat_price = await create_product_price_seat_unit(save_fixture, product=product)

        session.expunge_all()
        reloaded = await ProductRepository.from_session(session).get_by_id(product.id)

        assert reloaded is not None
        assert [price.id for price in reloaded.prices] == [
            seat_price.id,
            metered_price.id,
        ]

    async def test_unit_before_metered_tiers(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        organization: Organization,
        meter: Meter,
    ) -> None:
        product = await create_product(
            save_fixture,
            organization=organization,
            recurring_interval=SubscriptionRecurringInterval.month,
            prices=[],
        )
        metered_price = await create_product_price_metered_tiers(
            save_fixture,
            product=product,
            meter=meter,
            tiers=Tiers.model_validate(
                {
                    "type": TierType.graduated,
                    "tiers": [{"bound": None, "unit_amount": "100"}],
                }
            ),
        )
        unit_price = await create_product_price_unit_based(
            save_fixture, product=product
        )

        session.expunge_all()
        reloaded = await ProductRepository.from_session(session).get_by_id(product.id)

        assert reloaded is not None
        assert [price.id for price in reloaded.prices] == [
            unit_price.id,
            metered_price.id,
        ]

    async def test_fixed_before_seat(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        organization: Organization,
        meter: Meter,
    ) -> None:
        product = await create_product(
            save_fixture,
            organization=organization,
            recurring_interval=SubscriptionRecurringInterval.month,
            prices=[],
        )
        metered_price = await create_product_price_metered_unit(
            save_fixture, product=product, meter=meter, unit_amount=Decimal(100)
        )
        seat_price = await create_product_price_seat_unit(save_fixture, product=product)
        fixed_price = await create_product_price_fixed(save_fixture, product=product)

        session.expunge_all()
        reloaded = await ProductRepository.from_session(session).get_by_id(product.id)

        assert reloaded is not None
        assert [price.id for price in reloaded.prices] == [
            fixed_price.id,
            seat_price.id,
            metered_price.id,
        ]
