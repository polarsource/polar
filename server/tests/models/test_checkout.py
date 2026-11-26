import uuid
from collections.abc import Callable
from datetime import UTC, datetime
from decimal import Decimal

import pytest
from sqlalchemy.orm import selectinload

from polar.checkout.repository import CheckoutRepository
from polar.config import Environment, settings
from polar.enums import SubscriptionRecurringInterval
from polar.kit.address import Address, CountryAlpha2
from polar.kit.trial import TrialInterval
from polar.models import Checkout, CheckoutProduct, Meter, Organization, Product
from polar.models.checkout import BillingAddressFieldMode, CheckoutStatus
from polar.models.product_price import (
    ProductPriceMeteredUnit,
    ProductPriceSeatUnit,
    ProductPriceSource,
)
from polar.postgres import AsyncSession
from polar.product.price_set import PriceSet
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import (
    create_checkout,
    create_product,
    create_product_price_seat_unit,
)


@pytest.mark.anyio
@pytest.mark.parametrize(
    ("initial_status", "expected_status"),
    [
        (
            CheckoutStatus.open,
            CheckoutStatus.expired,
        ),
        (
            CheckoutStatus.confirmed,
            CheckoutStatus.confirmed,
        ),
        (
            CheckoutStatus.failed,
            CheckoutStatus.failed,
        ),
    ],
)
async def test_checkout_expired_status_update(
    initial_status: CheckoutStatus,
    expected_status: CheckoutStatus,
    save_fixture: SaveFixture,
    session: AsyncSession,
    product_one_time: Product,
) -> None:
    checkout = await create_checkout(
        save_fixture, products=[product_one_time], status=initial_status
    )
    assert checkout.status == initial_status

    checkout.expires_at = datetime(2024, 1, 1, 0, 0, 0, 0, tzinfo=UTC)
    session.add(checkout)
    await session.flush()

    assert checkout.status == expected_status


@pytest.mark.anyio
@pytest.mark.parametrize(
    ("country", "require_billing_address", "expected_state_mode"),
    [
        ("FR", False, BillingAddressFieldMode.disabled),
        ("FR", True, BillingAddressFieldMode.optional),
        ("US", True, BillingAddressFieldMode.required),
        ("CA", True, BillingAddressFieldMode.required),
    ],
)
async def test_billing_address_fields(
    country: CountryAlpha2,
    require_billing_address: bool,
    expected_state_mode: BillingAddressFieldMode,
    save_fixture: SaveFixture,
    product_one_time: Product,
) -> None:
    checkout = await create_checkout(
        save_fixture,
        products=[product_one_time],
        require_billing_address=require_billing_address,
        customer_billing_address=Address(country=country),
    )

    assert (
        checkout.billing_address_fields["country"] == BillingAddressFieldMode.required
    )
    assert checkout.billing_address_fields["state"] == expected_state_mode


@pytest.mark.anyio
@pytest.mark.parametrize(
    ("country", "expected_fields"),
    [
        (
            "FR",
            {
                "state": BillingAddressFieldMode.disabled,
                "line1": BillingAddressFieldMode.disabled,
                "line2": BillingAddressFieldMode.disabled,
                "city": BillingAddressFieldMode.disabled,
                "postal_code": BillingAddressFieldMode.disabled,
            },
        ),
        (
            "US",
            {
                "state": BillingAddressFieldMode.required,
                "line1": BillingAddressFieldMode.required,
                "line2": BillingAddressFieldMode.optional,
                "city": BillingAddressFieldMode.required,
                "postal_code": BillingAddressFieldMode.required,
            },
        ),
        (
            "CA",
            {
                "state": BillingAddressFieldMode.required,
                "line1": BillingAddressFieldMode.disabled,
                "line2": BillingAddressFieldMode.disabled,
                "city": BillingAddressFieldMode.disabled,
                "postal_code": BillingAddressFieldMode.disabled,
            },
        ),
        (
            "ES",
            {
                "state": BillingAddressFieldMode.disabled,
                "line1": BillingAddressFieldMode.disabled,
                "line2": BillingAddressFieldMode.disabled,
                "city": BillingAddressFieldMode.disabled,
                "postal_code": BillingAddressFieldMode.required,
            },
        ),
        (
            "PT",
            {
                "state": BillingAddressFieldMode.disabled,
                "line1": BillingAddressFieldMode.disabled,
                "line2": BillingAddressFieldMode.disabled,
                "city": BillingAddressFieldMode.disabled,
                "postal_code": BillingAddressFieldMode.required,
            },
        ),
        (
            "BR",
            {
                "state": BillingAddressFieldMode.required,
                "line1": BillingAddressFieldMode.optional,
                "line2": BillingAddressFieldMode.optional,
                "city": BillingAddressFieldMode.required,
                "postal_code": BillingAddressFieldMode.optional,
            },
        ),
        (
            "IN",
            {
                "state": BillingAddressFieldMode.required,
                "line1": BillingAddressFieldMode.disabled,
                "line2": BillingAddressFieldMode.disabled,
                "city": BillingAddressFieldMode.disabled,
                "postal_code": BillingAddressFieldMode.disabled,
            },
        ),
    ],
)
async def test_billing_address_fields_country_requirements(
    country: CountryAlpha2,
    expected_fields: dict[str, BillingAddressFieldMode],
    save_fixture: SaveFixture,
    product_one_time: Product,
) -> None:
    checkout = await create_checkout(
        save_fixture,
        products=[product_one_time],
        customer_billing_address=Address(country=country),
    )

    assert checkout.billing_address_fields == {
        "country": BillingAddressFieldMode.required,
        **expected_fields,
    }


CONTROL_CHECKOUT_ID = uuid.UUID(int=1)
TREATMENT_CHECKOUT_ID = uuid.UUID(int=2)


@pytest.mark.parametrize(
    (
        "environment",
        "checkout_id",
        "address",
        "require_billing_address",
        "variant",
        "street_mode",
    ),
    [
        pytest.param(
            Environment.production,
            TREATMENT_CHECKOUT_ID,
            Address(country=CountryAlpha2("US")),
            False,
            "treatment",
            BillingAddressFieldMode.disabled,
            id="treatment",
        ),
        pytest.param(
            Environment.production,
            CONTROL_CHECKOUT_ID,
            Address(country=CountryAlpha2("US")),
            False,
            "control",
            BillingAddressFieldMode.required,
            id="control",
        ),
        pytest.param(
            Environment.production,
            TREATMENT_CHECKOUT_ID,
            Address(country=CountryAlpha2("US")),
            True,
            None,
            BillingAddressFieldMode.required,
            id="merchant requires billing address",
        ),
        pytest.param(
            Environment.production,
            TREATMENT_CHECKOUT_ID,
            Address(country=CountryAlpha2("US"), line1="350 5th Ave"),
            False,
            None,
            BillingAddressFieldMode.required,
            id="prefilled street",
        ),
        pytest.param(
            Environment.production,
            TREATMENT_CHECKOUT_ID,
            Address(country=CountryAlpha2("FR")),
            False,
            None,
            BillingAddressFieldMode.disabled,
            id="not US",
        ),
        pytest.param(
            Environment.sandbox,
            TREATMENT_CHECKOUT_ID,
            Address(country=CountryAlpha2("US")),
            False,
            None,
            BillingAddressFieldMode.required,
            id="not production",
        ),
    ],
)
def test_us_short_billing_address_experiment(
    environment: Environment,
    checkout_id: uuid.UUID,
    address: Address,
    require_billing_address: bool,
    variant: str | None,
    street_mode: BillingAddressFieldMode,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(settings, "ENV", environment)
    checkout = Checkout(
        id=checkout_id,
        customer_billing_address=address,
        require_billing_address=require_billing_address,
        is_business_customer=False,
        payment_method_type=None,
    )

    assert checkout.us_short_billing_address_variant == variant
    assert checkout.billing_address_fields["line1"] == street_mode


@pytest.mark.anyio
@pytest.mark.parametrize(
    ("success_url_input", "expected_factory"),
    [
        pytest.param(
            "https://example.com/success?checkout_id={CHECKOUT_ID}",
            lambda checkout: f"https://example.com/success?checkout_id={checkout.id}",
            id="checkout_id_replacement",
        ),
        pytest.param(
            "https://example.com/success",
            lambda checkout: "https://example.com/success",
            id="no_placeholder",
        ),
        pytest.param(
            'https://example.com/callback?data={"key":"value"}',
            lambda checkout: 'https://example.com/callback?data={"key":"value"}',
            id="literal_brace",
        ),
        pytest.param(
            None,
            lambda checkout: settings.generate_frontend_url(
                f"/checkout/{checkout.client_secret}/confirmation"
            ),
            id="none_url",
        ),
        pytest.param(
            "https://example.com/success?checkout_id={CHECKOUT_ID.__class__.__init__.__globals__[os].environ}",
            lambda checkout: (
                "https://example.com/success?checkout_id={CHECKOUT_ID.__class__.__init__.__globals__[os].environ}"
            ),
            id="internal Python attribute traversal should not be allowed",
        ),
    ],
)
async def test_success_url(
    save_fixture: SaveFixture,
    product_one_time: Product,
    success_url_input: str | None,
    expected_factory: Callable[[Checkout], str],
) -> None:
    checkout = await create_checkout(save_fixture, products=[product_one_time])
    checkout._success_url = success_url_input

    expected = expected_factory(checkout)
    assert checkout.success_url == expected


@pytest.mark.anyio
async def test_is_free_product_price_for_zero_fixed_price(
    save_fixture: SaveFixture,
    organization: Organization,
) -> None:
    """A fixed price of 0 must be treated as a free product price, so checkout skips
    the payment form just like a free-typed price."""
    product = await create_product(
        save_fixture,
        organization=organization,
        recurring_interval=None,
        prices=[(0, "usd")],
    )
    checkout = await create_checkout(save_fixture, products=[product])

    assert checkout.is_free_product_price is True
    assert checkout.is_payment_form_required is False


@pytest.mark.anyio
class TestIsFreeProductPrice:
    @pytest.mark.parametrize(
        ("currency", "expected_free"), [("usd", True), ("eur", False)]
    )
    async def test_selected_currency(
        self,
        save_fixture: SaveFixture,
        organization: Organization,
        currency: str,
        expected_free: bool,
    ) -> None:
        product = await create_product(
            save_fixture,
            organization=organization,
            recurring_interval=SubscriptionRecurringInterval.month,
            prices=[(0, "usd"), (1000, "eur")],
        )
        checkout = await create_checkout(
            save_fixture, products=[product], currency=currency
        )

        assert checkout.is_free_product_price is expected_free

    async def test_free_base_with_paid_component(
        self,
        save_fixture: SaveFixture,
        organization: Organization,
    ) -> None:
        product = await create_product(
            save_fixture,
            organization=organization,
            recurring_interval=SubscriptionRecurringInterval.month,
            prices=[(0, "usd"), ("seat", 1000, "usd"), (0, "eur")],
        )
        checkout = await create_checkout(save_fixture, products=[product], seats=1)

        assert checkout.is_free_product_price is False


@pytest.mark.anyio
class TestHasMeteredPrices:
    @pytest.mark.parametrize(
        ("currency", "expected_metered"), [("usd", False), ("eur", True)]
    )
    async def test_selected_currency(
        self,
        save_fixture: SaveFixture,
        organization: Organization,
        meter: Meter,
        currency: str,
        expected_metered: bool,
    ) -> None:
        product = await create_product(
            save_fixture,
            organization=organization,
            recurring_interval=SubscriptionRecurringInterval.month,
            prices=[(0, None, None, "usd"), (meter, Decimal("0.01"), None, "eur")],
        )
        checkout = await create_checkout(
            save_fixture, products=[product], currency=currency
        )
        checkout.amount = 0
        checkout.net_amount = 0

        assert checkout.has_metered_prices is expected_metered


@pytest.mark.anyio
class TestHasFutureCharges:
    async def test_pay_what_you_want_zero(
        self, save_fixture: SaveFixture, organization: Organization
    ) -> None:
        product = await create_product(
            save_fixture,
            organization=organization,
            recurring_interval=SubscriptionRecurringInterval.month,
            prices=[(0, None, None, "usd")],
        )
        checkout = await create_checkout(save_fixture, products=[product])
        checkout.amount = 0

        assert checkout.has_future_charges is False

    async def test_metered_with_zero_amount(
        self, save_fixture: SaveFixture, organization: Organization, meter: Meter
    ) -> None:
        product = await create_product(
            save_fixture,
            organization=organization,
            recurring_interval=SubscriptionRecurringInterval.month,
            prices=[(0, "usd"), (meter, Decimal("0.01"), None, "usd")],
        )
        checkout = await create_checkout(save_fixture, products=[product])

        assert checkout.amount == 0
        assert checkout.has_future_charges is True

    async def test_seat_price_with_free_first_tier(
        self, save_fixture: SaveFixture, organization: Organization
    ) -> None:
        product = await create_product(
            save_fixture,
            organization=organization,
            recurring_interval=SubscriptionRecurringInterval.month,
            prices=[],
        )
        price = await create_product_price_seat_unit(
            save_fixture,
            product=product,
            tiers=[
                {"min_seats": 1, "max_seats": 1, "price_per_seat": 0},
                {"min_seats": 2, "max_seats": None, "price_per_seat": 1000},
            ],
        )
        product.prices.append(price)
        product.all_prices.append(price)
        checkout = await create_checkout(save_fixture, products=[product], seats=1)

        assert checkout.amount == 0
        assert checkout.has_future_charges is True
        assert checkout.is_payment_setup_required is True


@pytest.mark.anyio
class TestIsDiscountApplicable:
    @pytest.mark.parametrize(
        ("currency", "expected_applicable"), [("usd", False), ("eur", True)]
    )
    async def test_selected_currency(
        self,
        save_fixture: SaveFixture,
        organization: Organization,
        currency: str,
        expected_applicable: bool,
    ) -> None:
        product = await create_product(
            save_fixture,
            organization=organization,
            recurring_interval=None,
            prices=[(0, "usd"), (1000, "eur")],
        )
        checkout = await create_checkout(
            save_fixture, products=[product], currency=currency
        )

        assert checkout.is_discount_applicable is expected_applicable


@pytest.mark.anyio
async def test_active_trial_interval_none_for_non_recurring_product(
    save_fixture: SaveFixture,
    product_one_time: Product,
) -> None:
    checkout = await create_checkout(
        save_fixture,
        products=[product_one_time],
        trial_interval=TrialInterval.day,
        trial_interval_count=14,
    )

    assert checkout.active_trial_interval is None


@pytest.mark.anyio
async def test_active_trial_interval_count_none_for_non_recurring_product(
    save_fixture: SaveFixture,
    product_one_time: Product,
) -> None:
    checkout = await create_checkout(
        save_fixture,
        products=[product_one_time],
        trial_interval=TrialInterval.day,
        trial_interval_count=14,
    )

    assert checkout.active_trial_interval_count is None


@pytest.mark.anyio
class TestPrices:
    async def test_seat_and_metered_product(
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
            prices=[(meter, Decimal(100), None, "usd"), ("seat", 1000, "usd")],
        )
        checkout = await create_checkout(save_fixture, products=[product])

        session.expunge_all()
        repository = CheckoutRepository.from_session(session)
        reloaded = await repository.get_by_id(
            checkout.id, options=repository.get_eager_options()
        )

        assert reloaded is not None
        prices = reloaded.prices[product.id]
        assert isinstance(prices[0], ProductPriceSeatUnit)
        assert isinstance(prices[1], ProductPriceMeteredUnit)
        assert prices[0] == PriceSet.from_prices(prices, "usd").get_default_price()
        assert prices[0] == reloaded.product_price

    async def test_ad_hoc_prices_static_first_across_reloads(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        product: Product,
        meter: Meter,
    ) -> None:
        checkout = await create_checkout(save_fixture, products=[product])
        checkout_product = checkout.checkout_products[0]
        metered_price = ProductPriceMeteredUnit(
            price_currency="usd",
            unit_amount=Decimal(100),
            meter=meter,
            product=product,
            source=ProductPriceSource.ad_hoc,
            checkout_product=checkout_product,
        )
        await save_fixture(metered_price)
        seat_price = ProductPriceSeatUnit(
            price_currency="usd",
            seat_tiers={
                "seat_tier_type": "volume",
                "tiers": [{"min_seats": 1, "max_seats": None, "price_per_seat": 1000}],
            },
            product=product,
            source=ProductPriceSource.ad_hoc,
            checkout_product=checkout_product,
        )
        await save_fixture(seat_price)

        repository = CheckoutRepository.from_session(session)
        loaded_price_ids: list[list[uuid.UUID]] = []
        for options in (
            (selectinload(Checkout.checkout_products),),
            (selectinload(Checkout.checkout_products),),
            (
                selectinload(Checkout.checkout_products).joinedload(
                    CheckoutProduct.ad_hoc_prices
                ),
            ),
        ):
            session.expunge_all()
            reloaded = await repository.get_by_id(checkout.id, options=options)
            assert reloaded is not None
            loaded_price_ids.append(
                [price.id for price in reloaded.checkout_products[0].ad_hoc_prices]
            )

        assert loaded_price_ids == [[seat_price.id, metered_price.id]] * 3
