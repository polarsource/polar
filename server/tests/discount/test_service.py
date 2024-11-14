import asyncio
from datetime import timedelta

import pytest

from polar.discount.service import DiscountNotRedeemableError
from polar.discount.service import discount as discount_service
from polar.kit.utils import utc_now
from polar.locker import Locker
from polar.models import Checkout, Discount, DiscountRedemption, Organization, Product
from polar.models.discount import DiscountDuration, DiscountType
from polar.postgres import AsyncSession
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import create_checkout, create_discount


async def create_discount_redemption(
    save_fixture: SaveFixture, *, discount: Discount, checkout: Checkout
) -> DiscountRedemption:
    discount_redemption = DiscountRedemption(discount=discount, checkout=checkout)
    await save_fixture(discount_redemption)
    return discount_redemption


@pytest.mark.asyncio
@pytest.mark.skip_db_asserts
class TestIsRedeemableDiscount:
    async def test_not_started(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        organization: Organization,
    ) -> None:
        discount = await create_discount(
            save_fixture,
            type=DiscountType.percentage,
            basis_points=1000,
            duration=DiscountDuration.repeating,
            duration_in_months=1,
            organization=organization,
            starts_at=utc_now() + timedelta(days=1),
        )

        assert (
            await discount_service.is_redeemable_discount(session, discount)
        ) is False

    async def test_ended(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        organization: Organization,
    ) -> None:
        discount = await create_discount(
            save_fixture,
            type=DiscountType.percentage,
            basis_points=1000,
            duration=DiscountDuration.repeating,
            duration_in_months=1,
            organization=organization,
            ends_at=utc_now() - timedelta(days=1),
        )

        assert (
            await discount_service.is_redeemable_discount(session, discount)
        ) is False

    async def test_max_redemptions_reached(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        organization: Organization,
        product: Product,
    ) -> None:
        max_redemptions = 10
        discount = await create_discount(
            save_fixture,
            type=DiscountType.percentage,
            basis_points=1000,
            duration=DiscountDuration.repeating,
            duration_in_months=1,
            organization=organization,
            max_redemptions=max_redemptions,
        )
        for _ in range(max_redemptions):
            checkout = await create_checkout(save_fixture, price=product.prices[0])
            await create_discount_redemption(
                save_fixture, discount=discount, checkout=checkout
            )

        assert (
            await discount_service.is_redeemable_discount(session, discount)
        ) is False

    async def test_redeemable(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        organization: Organization,
        product: Product,
    ) -> None:
        max_redemptions = 10
        discount = await create_discount(
            save_fixture,
            type=DiscountType.percentage,
            basis_points=1000,
            duration=DiscountDuration.repeating,
            duration_in_months=1,
            organization=organization,
            starts_at=utc_now() - timedelta(days=1),
            ends_at=utc_now() + timedelta(days=1),
            max_redemptions=max_redemptions,
        )
        for _ in range(5):
            checkout = await create_checkout(save_fixture, price=product.prices[0])
            await create_discount_redemption(
                save_fixture, discount=discount, checkout=checkout
            )

        assert (
            await discount_service.is_redeemable_discount(session, discount)
        ) is True


@pytest.mark.asyncio
@pytest.mark.skip_db_asserts
class TestRedeemDiscount:
    async def test_concurrency(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        locker: Locker,
        organization: Organization,
        product: Product,
    ) -> None:
        discount = await create_discount(
            save_fixture,
            type=DiscountType.percentage,
            basis_points=1000,
            duration=DiscountDuration.repeating,
            duration_in_months=1,
            organization=organization,
            max_redemptions=1,
        )
        first_checkout = await create_checkout(save_fixture, price=product.prices[0])
        second_checkout = await create_checkout(save_fixture, price=product.prices[0])

        async def _redemption_task(
            session: AsyncSession,
            locker: Locker,
            discount: Discount,
            checkout: Checkout,
        ) -> DiscountRedemption:
            async with discount_service.redeem_discount(
                session, locker, discount
            ) as redemption:
                redemption.checkout = checkout
                session.add(redemption)
                await session.flush()
                return redemption

        first_redemption = asyncio.create_task(
            _redemption_task(session, locker, discount, first_checkout)
        )
        second_redemption = asyncio.create_task(
            _redemption_task(session, locker, discount, second_checkout)
        )

        done, _ = await asyncio.wait(
            [first_redemption, second_redemption], return_when=asyncio.ALL_COMPLETED
        )

        assert first_redemption in done
        assert isinstance(first_redemption.result(), DiscountRedemption)

        assert second_redemption in done
        with pytest.raises(DiscountNotRedeemableError):
            second_redemption.result()
