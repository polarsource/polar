import uuid
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
from polar.discount.service import discount as discount_service
from polar.exceptions import PolarRequestValidationError
from polar.kit.utils import utc_now
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
from tests.fixtures.random_objects import (
    create_checkout,
    create_customer,
    create_discount,
)


async def create_discount_redemption(
    save_fixture: SaveFixture,
    *,
    discount: Discount,
    checkout: Checkout,
    customer_id: uuid.UUID | None = None,
    customer_email: str | None = None,
) -> DiscountRedemption:
    discount_redemption = DiscountRedemption(
        discount=discount,
        checkout=checkout,
        customer_id=customer_id,
        customer_email=customer_email,
    )
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

    async def test_max_redemptions_per_customer_reached(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        organization: Organization,
        product: Product,
    ) -> None:
        max_redemptions_per_customer = 2
        customer = await create_customer(
            save_fixture, organization=organization, email="customer@example.com"
        )
        discount = await create_discount(
            save_fixture,
            type=DiscountType.percentage,
            basis_points=1000,
            duration=DiscountDuration.repeating,
            duration_in_months=1,
            organization=organization,
            max_redemptions_per_customer=max_redemptions_per_customer,
        )
        for _ in range(max_redemptions_per_customer):
            checkout = await create_checkout(save_fixture, products=[product])
            await create_discount_redemption(
                save_fixture,
                discount=discount,
                checkout=checkout,
                customer_id=customer.id,
                customer_email="customer@example.com",
            )

        assert (
            await discount_service.is_redeemable_discount(
                session, discount, customer_email="customer@example.com"
            )
        ) is False

    async def test_max_redemptions_per_customer_not_reached(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        organization: Organization,
        product: Product,
    ) -> None:
        max_redemptions_per_customer = 3
        customer = await create_customer(
            save_fixture, organization=organization, email="customer@example.com"
        )
        discount = await create_discount(
            save_fixture,
            type=DiscountType.percentage,
            basis_points=1000,
            duration=DiscountDuration.repeating,
            duration_in_months=1,
            organization=organization,
            max_redemptions_per_customer=max_redemptions_per_customer,
        )
        # Only 1 redemption, limit is 3
        checkout = await create_checkout(save_fixture, products=[product])
        await create_discount_redemption(
            save_fixture,
            discount=discount,
            checkout=checkout,
            customer_id=customer.id,
            customer_email="customer@example.com",
        )

        assert (
            await discount_service.is_redeemable_discount(
                session, discount, customer_email="customer@example.com"
            )
        ) is True

    async def test_max_redemptions_per_customer_no_email(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        organization: Organization,
        product: Product,
    ) -> None:
        """Per-customer limit is not checked when customer_email is not provided."""
        max_redemptions_per_customer = 1
        customer = await create_customer(
            save_fixture, organization=organization, email="customer@example.com"
        )
        discount = await create_discount(
            save_fixture,
            type=DiscountType.percentage,
            basis_points=1000,
            duration=DiscountDuration.repeating,
            duration_in_months=1,
            organization=organization,
            max_redemptions_per_customer=max_redemptions_per_customer,
        )
        # Create redemption that would exceed the limit
        checkout = await create_checkout(save_fixture, products=[product])
        await create_discount_redemption(
            save_fixture,
            discount=discount,
            checkout=checkout,
            customer_id=customer.id,
            customer_email="customer@example.com",
        )

        # Without customer_email, the per-customer limit is not checked
        assert (
            await discount_service.is_redeemable_discount(session, discount)
        ) is True

    async def test_max_redemptions_per_customer_different_customers(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        organization: Organization,
        product: Product,
    ) -> None:
        """Each customer has their own redemption limit."""
        max_redemptions_per_customer = 1
        customer1 = await create_customer(
            save_fixture, organization=organization, email="customer1@example.com"
        )
        customer2 = await create_customer(
            save_fixture, organization=organization, email="customer2@example.com"
        )
        discount = await create_discount(
            save_fixture,
            type=DiscountType.percentage,
            basis_points=1000,
            duration=DiscountDuration.repeating,
            duration_in_months=1,
            organization=organization,
            max_redemptions_per_customer=max_redemptions_per_customer,
        )

        # customer1 uses their redemption
        checkout1 = await create_checkout(save_fixture, products=[product])
        await create_discount_redemption(
            save_fixture,
            discount=discount,
            checkout=checkout1,
            customer_id=customer1.id,
            customer_email="customer1@example.com",
        )

        # customer1 has reached their limit
        assert (
            await discount_service.is_redeemable_discount(
                session, discount, customer_email="customer1@example.com"
            )
        ) is False

        # customer2 can still redeem
        assert (
            await discount_service.is_redeemable_discount(
                session, discount, customer_email="customer2@example.com"
            )
        ) is True

    async def test_max_redemptions_and_per_customer_combined(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        organization: Organization,
        product: Product,
    ) -> None:
        """
        Test that max_redemptions and max_redemptions_per_customer work together.

        With max_redemptions=3 and max_redemptions_per_customer=1:
        - The discount can be redeemed 3 times total
        - Each customer can only redeem once
        """
        max_redemptions = 3
        max_redemptions_per_customer = 1
        customer1 = await create_customer(
            save_fixture, organization=organization, email="customer1@example.com"
        )
        customer2 = await create_customer(
            save_fixture, organization=organization, email="customer2@example.com"
        )
        customer3 = await create_customer(
            save_fixture, organization=organization, email="customer3@example.com"
        )
        customer4 = await create_customer(
            save_fixture, organization=organization, email="customer4@example.com"
        )
        discount = await create_discount(
            save_fixture,
            type=DiscountType.percentage,
            basis_points=1000,
            duration=DiscountDuration.repeating,
            duration_in_months=1,
            organization=organization,
            max_redemptions=max_redemptions,
            max_redemptions_per_customer=max_redemptions_per_customer,
        )

        # Initially, all customers can redeem
        assert (
            await discount_service.is_redeemable_discount(
                session, discount, customer_email="customer1@example.com"
            )
        ) is True
        assert (
            await discount_service.is_redeemable_discount(
                session, discount, customer_email="customer2@example.com"
            )
        ) is True
        assert (
            await discount_service.is_redeemable_discount(
                session, discount, customer_email="customer3@example.com"
            )
        ) is True
        assert (
            await discount_service.is_redeemable_discount(
                session, discount, customer_email="customer4@example.com"
            )
        ) is True

        # Customer1 redeems
        checkout1 = await create_checkout(save_fixture, products=[product])
        await create_discount_redemption(
            save_fixture,
            discount=discount,
            checkout=checkout1,
            customer_id=customer1.id,
            customer_email="customer1@example.com",
        )

        # Customer1 can no longer redeem (per-customer limit reached)
        assert (
            await discount_service.is_redeemable_discount(
                session, discount, customer_email="customer1@example.com"
            )
        ) is False
        # Other customers can still redeem
        assert (
            await discount_service.is_redeemable_discount(
                session, discount, customer_email="customer2@example.com"
            )
        ) is True

        # Customer2 redeems
        checkout2 = await create_checkout(save_fixture, products=[product])
        await create_discount_redemption(
            save_fixture,
            discount=discount,
            checkout=checkout2,
            customer_id=customer2.id,
            customer_email="customer2@example.com",
        )

        # Customer3 redeems (last available redemption)
        checkout3 = await create_checkout(save_fixture, products=[product])
        await create_discount_redemption(
            save_fixture,
            discount=discount,
            checkout=checkout3,
            customer_id=customer3.id,
            customer_email="customer3@example.com",
        )

        # Total max_redemptions reached (3 redemptions)
        # Customer4 cannot redeem anymore even though they haven't used theirs
        assert (
            await discount_service.is_redeemable_discount(
                session, discount, customer_email="customer4@example.com"
            )
        ) is False

        # Without customer_email, discount is not redeemable (total limit reached)
        assert (
            await discount_service.is_redeemable_discount(session, discount)
        ) is False

    async def test_email_alias_bypass_prevention(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        organization: Organization,
        product: Product,
    ) -> None:
        """
        Test that email aliases (e.g., user+1@example.com) are normalized
        and counted as the same customer for per-customer limits.
        """
        max_redemptions_per_customer = 1
        customer1 = await create_customer(
            save_fixture,
            organization=organization,
            email="user+alias1@example.com",
        )
        discount = await create_discount(
            save_fixture,
            type=DiscountType.percentage,
            basis_points=1000,
            duration=DiscountDuration.repeating,
            duration_in_months=1,
            organization=organization,
            max_redemptions_per_customer=max_redemptions_per_customer,
        )

        # Redeem with user+alias1@example.com (normalized to user@example.com)
        checkout1 = await create_checkout(save_fixture, products=[product])
        await create_discount_redemption(
            save_fixture,
            discount=discount,
            checkout=checkout1,
            customer_id=customer1.id,
            customer_email="user@example.com",
        )

        # Trying with user+alias2@example.com should be blocked
        # (normalizes to user@example.com, same as first redemption)
        assert (
            await discount_service.is_redeemable_discount(
                session, discount, customer_email="user+alias2@example.com"
            )
        ) is False

        # A genuinely different email should still be allowed
        assert (
            await discount_service.is_redeemable_discount(
                session, discount, customer_email="other@example.com"
            )
        ) is True


@pytest.mark.asyncio
class TestCodeCaseInsensitivity:
    async def test_code_case_insensitive(
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
            checkout_product,
            CheckoutUpdatePublic(
                discount_code="FoObAr",
            ),
        )
        assert checkout_product.discount_id == discount.id


@pytest.mark.asyncio
class TestIsRepetitionExpired:
    async def test_once_first_cycle(
        self,
        save_fixture: SaveFixture,
        organization: Organization,
    ) -> None:
        """Test that 'once' discount applies only to its first billing cycle."""
        discount = await create_discount(
            save_fixture,
            type=DiscountType.percentage,
            basis_points=10_000,
            duration=DiscountDuration.once,
            organization=organization,
        )

        now = utc_now()
        next_month = now + timedelta(days=30)
        # 'once' discount should apply when discount_applied_at equals current_period_start
        # (this is the first cycle where the discount is used)
        assert discount.is_repetition_expired(now, now) is False
        # 'once' discount should expire for subsequent cycles
        assert discount.is_repetition_expired(now, next_month) is True

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
        # Forever discounts never expire, regardless of when applied or current period
        assert discount.is_repetition_expired(now, future) is False

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

        # Should not expire within duration (from when discount was first applied)
        assert discount.is_repetition_expired(now, within_duration) is False
        # Should expire after duration
        assert discount.is_repetition_expired(now, after_duration) is True
