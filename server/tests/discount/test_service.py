import asyncio
from datetime import timedelta
from typing import Literal

import pytest

from polar.auth.models import AuthSubject, User
from polar.checkout.schemas import CheckoutUpdatePublic
from polar.checkout.service import checkout as checkout_service
from polar.discount.schemas import (
    DiscountFixedOnceForeverDurationCreate,
    DiscountUpdate,
)
from polar.discount.service import DiscountNotRedeemableError
from polar.discount.service import discount as discount_service
from polar.exceptions import PolarRequestValidationError
from polar.kit.utils import utc_now
from polar.locker import Locker
from polar.models import (
    Checkout,
    Discount,
    DiscountRedemption,
    Organization,
    Product,
    UserOrganization,
)
from polar.models.discount import (
    DiscountDuration,
    DiscountFixed,
    DiscountPercentage,
    DiscountType,
)
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
class TestCreate:
    @pytest.mark.auth
    async def test_long_name(
        self,
        auth_subject: AuthSubject[User],
        session: AsyncSession,
        organization: Organization,
        user_organization: UserOrganization,
        product: Product,
    ) -> None:
        discount = await discount_service.create(
            session,
            DiscountFixedOnceForeverDurationCreate(
                duration=DiscountDuration.once,
                type=DiscountType.fixed,
                amount=1000,
                currency="usd",
                name="A" * 256,
                code=None,
                starts_at=None,
                ends_at=None,
                max_redemptions=None,
                products=[product.id],
                organization_id=organization.id,
            ),
            auth_subject,
        )

        assert discount.name == "A" * 256


@pytest.mark.asyncio
class TestUpdate:
    async def test_duration_change(
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
        )

        with pytest.raises(PolarRequestValidationError):
            await discount_service.update(
                session,
                discount,
                discount_update=DiscountUpdate(duration=DiscountDuration.once),
            )

    async def test_type_change(
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
        )

        with pytest.raises(PolarRequestValidationError):
            await discount_service.update(
                session,
                discount,
                discount_update=DiscountUpdate(type=DiscountType.fixed),
            )

    @pytest.mark.parametrize(
        ("field", "value"),
        [
            ("amount", 1000),
            ("basis_points", 1000),
        ],
    )
    async def test_update_forbidden_field_with_redemptions(
        self,
        field: Literal["amount", "basis_points"],
        value: int,
        save_fixture: SaveFixture,
        session: AsyncSession,
        organization: Organization,
        product: Product,
    ) -> None:
        discount: Discount
        if field == "amount":
            discount = await create_discount(
                save_fixture,
                type=DiscountType.fixed,
                amount=5000,
                currency="usd",
                duration=DiscountDuration.once,
                organization=organization,
            )
        else:
            discount = await create_discount(
                save_fixture,
                type=DiscountType.percentage,
                basis_points=5000,
                duration=DiscountDuration.once,
                organization=organization,
            )
        checkout = await create_checkout(save_fixture, products=[product])
        await create_discount_redemption(
            save_fixture, discount=discount, checkout=checkout
        )
        await session.refresh(discount)

        with pytest.raises(PolarRequestValidationError):
            await discount_service.update(
                session,
                discount,
                discount_update=DiscountUpdate.model_validate(
                    {
                        field: value,
                        # Make sure passing "currency"
                        # doesn't cause AttributeError on percentage discounts
                        "currency": "usd",
                    }
                ),
            )

    @pytest.mark.parametrize(
        ("type", "payload"),
        [
            (
                DiscountType.percentage,
                DiscountUpdate(
                    basis_points=2000,
                    # Make sure passing "currency" doesn't cause AttributeError
                    # on percentage discounts
                    currency="usd",
                ),
            ),
            (
                DiscountType.fixed,
                DiscountUpdate(
                    amount=2000,
                    currency="usd",
                    # Make sure passing "basis_points" doesn't cause AttributeError
                    # on percentage discounts
                    basis_points=2000,
                ),
            ),
        ],
    )
    async def test_update_sensitive_fields(
        self,
        type: DiscountType,
        payload: DiscountUpdate,
        save_fixture: SaveFixture,
        session: AsyncSession,
        organization: Organization,
    ) -> None:
        discount: Discount
        if type == DiscountType.percentage:
            discount = await create_discount(
                save_fixture,
                type=DiscountType.percentage,
                basis_points=1000,
                duration=DiscountDuration.once,
                organization=organization,
            )
        else:
            discount = await create_discount(
                save_fixture,
                type=DiscountType.fixed,
                amount=1000,
                currency="usd",
                duration=DiscountDuration.once,
                organization=organization,
            )

        updated_ends_at = utc_now() + timedelta(days=2)
        payload.ends_at = updated_ends_at
        updated_discount = await discount_service.update(
            session, discount, discount_update=payload
        )

        if isinstance(updated_discount, DiscountPercentage):
            assert updated_discount.basis_points == 2000
        elif isinstance(updated_discount, DiscountFixed):
            assert updated_discount.amount == 2000
            assert updated_discount.currency == "usd"

        assert updated_discount.ends_at == updated_ends_at

    async def test_update_name(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        organization: Organization,
    ) -> None:
        discount = await create_discount(
            save_fixture,
            type=DiscountType.percentage,
            basis_points=1000,
            duration=DiscountDuration.once,
            organization=organization,
        )

        updated_discount = await discount_service.update(
            session,
            discount,
            discount_update=DiscountUpdate(name="Updated Name"),
        )

        assert updated_discount.name == "Updated Name"

    async def test_update_products(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        organization: Organization,
        product: Product,
        product_one_time: Product,
    ) -> None:
        discount = await create_discount(
            save_fixture,
            type=DiscountType.percentage,
            basis_points=1000,
            duration=DiscountDuration.once,
            organization=organization,
            products=[product],
        )

        updated_discount = await discount_service.update(
            session,
            discount,
            discount_update=DiscountUpdate(products=[product_one_time.id]),
        )

        assert updated_discount.products == [product_one_time]

    async def test_update_products_reset(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        organization: Organization,
        product: Product,
    ) -> None:
        discount = await create_discount(
            save_fixture,
            type=DiscountType.percentage,
            basis_points=1000,
            duration=DiscountDuration.once,
            organization=organization,
            products=[product],
        )

        updated_discount = await discount_service.update(
            session,
            discount,
            discount_update=DiscountUpdate(products=[]),
        )

        assert updated_discount.products == []

    async def test_update_discount_past_dates(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        organization: Organization,
    ) -> None:
        discount = await create_discount(
            save_fixture,
            type=DiscountType.percentage,
            basis_points=1000,
            duration=DiscountDuration.once,
            organization=organization,
            starts_at=utc_now() - timedelta(days=7),
            ends_at=utc_now() - timedelta(days=1),
        )

        updated_discount = await discount_service.update(
            session,
            discount,
            discount_update=DiscountUpdate(
                name="Updated Name",
                starts_at=discount.starts_at,
                ends_at=discount.ends_at,
            ),
        )

        assert updated_discount.name == "Updated Name"
        assert updated_discount.starts_at == discount.starts_at
        assert updated_discount.ends_at == discount.ends_at

    async def test_update_code_already_exists(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        organization: Organization,
    ) -> None:
        existing_discount = await create_discount(
            save_fixture,
            type=DiscountType.percentage,
            basis_points=1000,
            duration=DiscountDuration.once,
            organization=organization,
            code="EXISTING",
        )
        discount_to_update = await create_discount(
            save_fixture,
            type=DiscountType.percentage,
            basis_points=2000,
            duration=DiscountDuration.once,
            organization=organization,
            code="OTHER",
        )

        with pytest.raises(PolarRequestValidationError) as exc_info:
            await discount_service.update(
                session,
                discount_to_update,
                discount_update=DiscountUpdate(code="EXISTING"),
            )

        assert exc_info.value.errors()[0]["loc"] == ("body", "code")
        assert "already exists" in exc_info.value.errors()[0]["msg"]

    async def test_update_code_same_discount(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        organization: Organization,
    ) -> None:
        discount = await create_discount(
            save_fixture,
            type=DiscountType.percentage,
            basis_points=1000,
            duration=DiscountDuration.once,
            organization=organization,
            code="MYCODE",
        )

        updated_discount = await discount_service.update(
            session,
            discount,
            discount_update=DiscountUpdate(code="mycode"),
        )

        assert updated_discount.code == "mycode"


@pytest.mark.asyncio
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
            checkout = await create_checkout(save_fixture, products=[product])
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
            checkout = await create_checkout(save_fixture, products=[product])
            await create_discount_redemption(
                save_fixture, discount=discount, checkout=checkout
            )

        assert (
            await discount_service.is_redeemable_discount(session, discount)
        ) is True


@pytest.mark.asyncio
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
        first_checkout = await create_checkout(save_fixture, products=[product])
        second_checkout = await create_checkout(save_fixture, products=[product])

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


@pytest.mark.asyncio
class TestCodeCaseInsensitivity:
    async def test_code_case_insensitive(
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
            max_redemptions=3,
            code="FooBar",
        )

        discount_exact = await discount_service.get_by_code_and_organization(
            session,
            code="FooBar",
            organization=organization,
        )
        assert discount_exact
        assert discount_exact.code == "FooBar"

        discount_lower = await discount_service.get_by_code_and_organization(
            session,
            code="foobar",
            organization=organization,
        )
        assert discount_lower
        assert discount_lower.code == "FooBar"

        discount_upper = await discount_service.get_by_code_and_organization(
            session,
            code="FOOBAR",
            organization=organization,
        )
        assert discount_upper
        assert discount_upper.code == "FooBar"

        checkout_product = await create_checkout(save_fixture, products=[product])
        await checkout_service.update(
            session,
            locker,
            checkout_product,
            CheckoutUpdatePublic(
                discount_code="FoObAr",
            ),
        )
        assert checkout_product.discount_id == discount.id


@pytest.mark.asyncio
class TestIsRepetitionExpired:
    async def test_once_not_trialing(
        self,
        save_fixture: SaveFixture,
        organization: Organization,
    ) -> None:
        """Test that 'once' discount expires immediately when not trialing."""
        discount = await create_discount(
            save_fixture,
            type=DiscountType.percentage,
            basis_points=10_000,
            duration=DiscountDuration.once,
            organization=organization,
        )

        now = utc_now()
        # For non-trialing subscriptions, 'once' discount should expire after first use
        assert discount.is_repetition_expired(now, now, False) is True

    async def test_once_was_trialing(
        self,
        save_fixture: SaveFixture,
        organization: Organization,
    ) -> None:
        """Test that 'once' discount does NOT expire when transitioning from trial."""
        discount = await create_discount(
            save_fixture,
            type=DiscountType.percentage,
            basis_points=10_000,
            duration=DiscountDuration.once,
            organization=organization,
        )

        now = utc_now()
        # When transitioning from trial, 'once' discount should still apply
        assert discount.is_repetition_expired(now, now, True) is False

    async def test_forever_never_expires(
        self,
        save_fixture: SaveFixture,
        organization: Organization,
    ) -> None:
        """Test that 'forever' discount never expires."""
        discount = await create_discount(
            save_fixture,
            type=DiscountType.percentage,
            basis_points=5_000,
            duration=DiscountDuration.forever,
            organization=organization,
        )

        now = utc_now()
        future = now + timedelta(days=365)
        # Forever discounts never expire
        assert discount.is_repetition_expired(now, future, False) is False
        assert discount.is_repetition_expired(now, future, True) is False

    async def test_repeating_expires_after_duration(
        self,
        save_fixture: SaveFixture,
        organization: Organization,
    ) -> None:
        """Test that 'repeating' discount expires after specified months."""
        discount = await create_discount(
            save_fixture,
            type=DiscountType.percentage,
            basis_points=5_000,
            duration=DiscountDuration.repeating,
            duration_in_months=3,
            organization=organization,
        )

        now = utc_now()
        within_duration = now + timedelta(days=30)  # ~1 month
        after_duration = now + timedelta(days=120)  # ~4 months

        # Should not expire within duration
        assert discount.is_repetition_expired(now, within_duration, False) is False
        # Should expire after duration
        assert discount.is_repetition_expired(now, after_duration, False) is True
        # was_trialing should not affect repeating discounts
        assert discount.is_repetition_expired(now, after_duration, True) is True
