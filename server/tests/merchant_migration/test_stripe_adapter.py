from datetime import UTC, datetime
from typing import Any

import pytest
import stripe as stripe_lib
from pytest_mock import MockerFixture

from polar.enums import TaxBehavior
from polar.merchant_migration.adapters.stripe import (
    CANCELLATION_COMMENT_PREFIX,
    StripeAdapter,
    StripeMissingScope,
)
from polar.merchant_migration.canonical import (
    CanonicalDiscount,
    CanonicalDiscountType,
    CanonicalPaymentMethod,
    CanonicalPaymentMethodType,
    CanonicalPricingScheme,
    CanonicalProduct,
    CanonicalSubscription,
    CanonicalSubscriptionStatus,
)


def _adapter(mocker: MockerFixture) -> tuple[StripeAdapter, Any]:
    adapter = StripeAdapter("rk_test")
    client: Any = mocker.MagicMock()
    adapter._client = client
    return adapter, client


def _all_scopes_present(mocker: MockerFixture, client: Any) -> None:
    for resource in (
        "customers",
        "products",
        "prices",
        "subscriptions",
        "payment_methods",
        "coupons",
        "promotion_codes",
    ):
        getattr(client.v1, resource).list_async = mocker.AsyncMock(
            return_value=mocker.MagicMock(data=[])
        )
    # The write probe hits a non-existent subscription: with the permission it
    # fails "no such subscription", which is not a PermissionError.
    client.v1.subscriptions.cancel_async = mocker.AsyncMock(
        side_effect=stripe_lib.InvalidRequestError("no such subscription", "id")
    )
    client.v1.accounts.retrieve_current_async = mocker.AsyncMock(
        return_value=mocker.MagicMock(id="acct_123", country="US")
    )


@pytest.mark.asyncio
class TestVerifyScopes:
    async def test_all_scopes_present(self, mocker: MockerFixture) -> None:
        adapter, client = _adapter(mocker)
        _all_scopes_present(mocker, client)

        assert await adapter.verify_scopes() == []

    async def test_missing_read_scope_reported(self, mocker: MockerFixture) -> None:
        adapter, client = _adapter(mocker)
        _all_scopes_present(mocker, client)
        client.v1.prices.list_async = mocker.AsyncMock(
            side_effect=stripe_lib.PermissionError("missing price scope")
        )

        assert await adapter.verify_scopes() == ["Prices"]

    async def test_missing_write_scope_reported(self, mocker: MockerFixture) -> None:
        adapter, client = _adapter(mocker)
        _all_scopes_present(mocker, client)
        client.v1.subscriptions.cancel_async = mocker.AsyncMock(
            side_effect=stripe_lib.PermissionError("missing write scope")
        )

        assert await adapter.verify_scopes() == ["Subscriptions (write)"]

    async def test_missing_account_read_scope_reported(
        self, mocker: MockerFixture
    ) -> None:
        adapter, client = _adapter(mocker)
        _all_scopes_present(mocker, client)
        client.v1.accounts.retrieve_current_async = mocker.AsyncMock(
            side_effect=stripe_lib.PermissionError("missing account scope")
        )

        assert await adapter.verify_scopes() == ["All accounts"]

    async def test_account_probe_caches_for_get_account_id(
        self, mocker: MockerFixture
    ) -> None:
        adapter, client = _adapter(mocker)
        _all_scopes_present(mocker, client)

        assert await adapter.verify_scopes() == []
        assert await adapter.get_account_id() == "acct_123"
        client.v1.accounts.retrieve_current_async.assert_awaited_once()

    async def test_invalid_key_raises(self, mocker: MockerFixture) -> None:
        adapter, client = _adapter(mocker)
        _all_scopes_present(mocker, client)
        client.v1.customers.list_async = mocker.AsyncMock(
            side_effect=stripe_lib.AuthenticationError("bad key")
        )

        with pytest.raises(stripe_lib.AuthenticationError):
            await adapter.verify_scopes()

    async def test_transient_error_propagates(self, mocker: MockerFixture) -> None:
        # A non-permission error must NOT be swallowed as "scope granted" — it
        # propagates so the caller fails closed instead of accepting the key.
        adapter, client = _adapter(mocker)
        _all_scopes_present(mocker, client)
        client.v1.prices.list_async = mocker.AsyncMock(
            side_effect=stripe_lib.RateLimitError("rate limited")
        )

        with pytest.raises(stripe_lib.StripeError):
            await adapter.verify_scopes()


@pytest.mark.asyncio
class TestGetAccountId:
    async def test_returns_account_id(self, mocker: MockerFixture) -> None:
        adapter, client = _adapter(mocker)
        client.v1.accounts.retrieve_current_async = mocker.AsyncMock(
            return_value=mocker.MagicMock(id="acct_123")
        )

        assert await adapter.get_account_id() == "acct_123"

    async def test_scope_gap_returns_none(self, mocker: MockerFixture) -> None:
        adapter, client = _adapter(mocker)
        client.v1.accounts.retrieve_current_async = mocker.AsyncMock(
            side_effect=stripe_lib.PermissionError("missing scope")
        )

        assert await adapter.get_account_id() is None

    async def test_account_is_read_once(self, mocker: MockerFixture) -> None:
        # Creating a migration needs both the id and the country; one read serves
        # both.
        adapter, client = _adapter(mocker)
        client.v1.accounts.retrieve_current_async = mocker.AsyncMock(
            return_value=mocker.MagicMock(id="acct_123", country="US")
        )
        client.v1.accounts.list_async = mocker.AsyncMock(
            side_effect=stripe_lib.PermissionError("not a platform")
        )

        assert (await adapter.get_source_account()).country == "US"
        assert await adapter.get_account_id() == "acct_123"

        client.v1.accounts.retrieve_current_async.assert_awaited_once()

    async def test_failed_read_is_not_cached(self, mocker: MockerFixture) -> None:
        # A rate limit on the first read must not cost the account id for the
        # rest of the adapter's life.
        adapter, client = _adapter(mocker)
        client.v1.accounts.retrieve_current_async = mocker.AsyncMock(
            side_effect=[
                stripe_lib.RateLimitError("rate limited"),
                mocker.MagicMock(id="acct_123"),
            ]
        )

        assert await adapter.get_account_id() is None
        assert await adapter.get_account_id() == "acct_123"


@pytest.mark.asyncio
class TestGetSourceAccount:
    async def test_platform_with_connected_accounts_is_flagged(
        self, mocker: MockerFixture
    ) -> None:
        adapter, client = _adapter(mocker)
        client.v1.accounts.retrieve_current_async = mocker.AsyncMock(
            return_value=mocker.MagicMock(country="US")
        )
        client.v1.accounts.list_async = mocker.AsyncMock(
            return_value=mocker.MagicMock(data=[mocker.MagicMock(id="acct_123")])
        )

        account = await adapter.get_source_account()

        assert account.has_connected_accounts is True

    async def test_empty_account_list_is_not_flagged(
        self, mocker: MockerFixture
    ) -> None:
        adapter, client = _adapter(mocker)
        client.v1.accounts.retrieve_current_async = mocker.AsyncMock(
            return_value=mocker.MagicMock(country="US")
        )
        client.v1.accounts.list_async = mocker.AsyncMock(
            return_value=mocker.MagicMock(data=[])
        )

        account = await adapter.get_source_account()

        assert account.has_connected_accounts is False
        assert account.country == "US"

    async def test_missing_connect_scope_is_not_flagged(
        self, mocker: MockerFixture
    ) -> None:
        adapter, client = _adapter(mocker)
        client.v1.accounts.retrieve_current_async = mocker.AsyncMock(
            return_value=mocker.MagicMock(country="US")
        )
        client.v1.accounts.list_async = mocker.AsyncMock(
            side_effect=stripe_lib.PermissionError("no connect access")
        )

        account = await adapter.get_source_account()

        assert account.has_connected_accounts is False
        assert account.country == "US"

    async def test_scope_gap_is_tolerated(self, mocker: MockerFixture) -> None:
        adapter, client = _adapter(mocker)
        client.v1.accounts.retrieve_current_async = mocker.AsyncMock(
            side_effect=stripe_lib.PermissionError("missing scope")
        )
        client.v1.accounts.list_async = mocker.AsyncMock(
            side_effect=stripe_lib.PermissionError("missing scope")
        )

        account = await adapter.get_source_account()

        assert account.country is None
        assert account.has_connected_accounts is False


def _stripe_subscription(
    *,
    id: str = "sub_1",
    status: str = "active",
    cancel_at_period_end: bool = False,
    trial_end: int | None = None,
    billing_cycle_anchor: int | None = 1_700_000_000,
    cancellation_comment: str | None = None,
    currency: str = "usd",
    items: list[dict[str, Any]] | None = None,
    payment_method: dict[str, Any] | None = None,
    automatic_tax: dict[str, Any] | None = None,
    default_tax_rates: list[dict[str, Any]] | None = None,
    price_tax_behavior: str | None = None,
) -> stripe_lib.Subscription:
    price: dict[str, Any] = {"id": "price_1", "currency": "usd"}
    if price_tax_behavior is not None:
        price["tax_behavior"] = price_tax_behavior
    return stripe_lib.Subscription.construct_from(
        {
            "id": id,
            "customer": "cus_1",
            "currency": currency,
            "automatic_tax": automatic_tax,
            "status": status,
            "collection_method": "charge_automatically",
            "cancel_at_period_end": cancel_at_period_end,
            "pause_collection": None,
            "trial_end": trial_end,
            "billing_cycle_anchor": billing_cycle_anchor,
            "default_payment_method": payment_method,
            "default_tax_rates": default_tax_rates or [],
            "discounts": [],
            "cancellation_details": (
                {"comment": cancellation_comment} if cancellation_comment else None
            ),
            "items": {
                "data": items
                if items is not None
                else [
                    {
                        "price": price,
                        "quantity": 1,
                        "tax_rates": [],
                        "current_period_start": 1_700_000_000,
                        "current_period_end": 1_702_000_000,
                    }
                ]
            },
        },
        None,
    )


def _stripe_price(
    *,
    id: str = "price_1",
    currency: str = "usd",
    unit_amount: int | None = 1000,
    currency_options: dict[str, Any] | None = None,
    product_id: str = "prod_1",
    product_active: bool = True,
    price_active: bool = True,
    product_name: str = "Pro",
) -> stripe_lib.Price:
    price: dict[str, Any] = {
        "id": id,
        "object": "price",
        "active": price_active,
        "currency": currency,
        "unit_amount": unit_amount,
        "billing_scheme": "per_unit",
        "recurring": {
            "interval": "month",
            "interval_count": 1,
            "usage_type": "licensed",
        },
        "product": {
            "id": product_id,
            "object": "product",
            "active": product_active,
            "name": product_name,
        },
    }
    if currency_options is not None:
        price["currency_options"] = currency_options
    return stripe_lib.Price.construct_from(price, None)


def _listed_prices(
    mocker: MockerFixture,
    client: Any,
    *prices: stripe_lib.Price,
    has_more: bool = False,
) -> None:
    async def list_async(*, params: dict[str, Any]) -> Any:
        active = params.get("active", True)
        matching = [price for price in prices if bool(price.get("active")) is active]
        return mocker.MagicMock(data=matching, has_more=has_more)

    client.v1.prices.list_async = mocker.AsyncMock(side_effect=list_async)


_PRICE_PHASES = frozenset({"prices", "inactive_prices"})


async def _extracted_products(adapter: StripeAdapter) -> list[CanonicalProduct]:
    products: list[CanonicalProduct] = []
    cursor: dict[str, Any] | None = None
    while True:
        page = await adapter.extract_page(cursor)
        products.extend(
            record for record in page.records if isinstance(record, CanonicalProduct)
        )
        cursor = page.next_cursor
        if cursor is None or cursor.get("phase") not in _PRICE_PHASES:
            return products


@pytest.mark.asyncio
class TestExtractProducts:
    async def test_single_currency_price_keeps_the_source_id(
        self, mocker: MockerFixture
    ) -> None:
        adapter, client = _adapter(mocker)
        _listed_prices(mocker, client, _stripe_price())

        products = await _extracted_products(adapter)

        assert len(products) == 1
        price = products[0].prices[0]
        assert (price.source_id, price.currency, price.amount) == (
            "price_1",
            "usd",
            1000,
        )
        assert price.pricing_scheme == CanonicalPricingScheme.fixed

    async def test_multi_currency_price_yields_one_price_per_currency(
        self, mocker: MockerFixture
    ) -> None:
        adapter, client = _adapter(mocker)
        _listed_prices(
            mocker,
            client,
            _stripe_price(
                currency="eur",
                unit_amount=900,
                currency_options={
                    "eur": {"unit_amount": 900},
                    "usd": {"unit_amount": 1000},
                },
            ),
        )

        products = await _extracted_products(adapter)

        assert len(products) == 1
        assert [
            (price.source_id, price.currency, price.amount)
            for price in products[0].prices
        ] == [("price_1", "eur", 900), ("price_1", "usd", 1000)]

    async def test_only_maps_configured_currency_options(
        self, mocker: MockerFixture
    ) -> None:
        adapter, client = _adapter(mocker)
        _listed_prices(
            mocker,
            client,
            _stripe_price(
                currency="eur",
                unit_amount=900,
                currency_options={
                    "eur": {"unit_amount": 900},
                    "gbp": {"unit_amount": 800},
                },
            ),
        )

        products = await _extracted_products(adapter)

        assert {price.currency for price in products[0].prices} == {"eur", "gbp"}

    async def test_currency_options_are_expanded(self, mocker: MockerFixture) -> None:
        adapter, client = _adapter(mocker)
        _listed_prices(mocker, client)

        await _extracted_products(adapter)

        _, kwargs = client.v1.prices.list_async.call_args
        assert "data.currency_options" in kwargs["params"]["expand"]

    async def test_page_cursor_resumes_after_last_price(
        self, mocker: MockerFixture
    ) -> None:
        adapter, client = _adapter(mocker)
        _listed_prices(
            mocker,
            client,
            _stripe_price(id="price_2"),
            has_more=True,
        )

        page = await adapter.extract_page(
            {"phase": "prices", "starting_after": "price_1"}
        )

        assert page.next_cursor == {
            "phase": "prices",
            "starting_after": "price_2",
        }
        client.v1.prices.list_async.assert_awaited_once_with(
            params={
                "limit": 100,
                "expand": ["data.product", "data.currency_options"],
                "active": True,
                "starting_after": "price_1",
            }
        )

    async def test_last_active_price_page_advances_to_inactive_prices(
        self, mocker: MockerFixture
    ) -> None:
        adapter, client = _adapter(mocker)
        _listed_prices(mocker, client, _stripe_price())

        page = await adapter.extract_page()

        assert page.next_cursor == {
            "phase": "inactive_prices",
            "starting_after": None,
        }

    async def test_last_inactive_price_page_advances_to_coupons(
        self, mocker: MockerFixture
    ) -> None:
        adapter, client = _adapter(mocker)
        _listed_prices(
            mocker,
            client,
            _stripe_price(id="price_archived", price_active=False),
        )

        page = await adapter.extract_page({"phase": "inactive_prices"})

        assert page.next_cursor == {
            "phase": "coupons",
            "starting_after": None,
        }
        client.v1.prices.list_async.assert_awaited_once_with(
            params={
                "limit": 100,
                "expand": ["data.product", "data.currency_options"],
                "active": False,
            }
        )

    async def test_archived_catalog_product_is_extracted(
        self, mocker: MockerFixture
    ) -> None:
        adapter, client = _adapter(mocker)
        _listed_prices(
            mocker,
            client,
            _stripe_price(
                id="price_archived",
                product_id="prod_archived",
                product_active=False,
                price_active=False,
                product_name="Legacy",
                currency_options={"eur": {"unit_amount": 900}},
            ),
        )

        products = await _extracted_products(adapter)

        assert len(products) == 1
        assert products[0].product_source_id == "prod_archived"
        assert products[0].source_id == "prod_archived:month:1"
        assert products[0].archived is True
        assert products[0].name == "Legacy"
        assert {(p.source_id, p.currency, p.amount) for p in products[0].prices} == {
            ("price_archived", "usd", 1000),
            ("price_archived", "eur", 900),
        }

    async def test_archived_price_on_live_product_is_a_catalog_sibling(
        self, mocker: MockerFixture
    ) -> None:
        adapter, client = _adapter(mocker)
        _listed_prices(
            mocker,
            client,
            _stripe_price(),
            _stripe_price(id="price_archived", price_active=False, unit_amount=500),
        )

        products = await _extracted_products(adapter)
        by_id = {product.source_id: product for product in products}

        assert set(by_id) == {"prod_1:month:1", "prod_1:month:1:archived"}
        assert by_id["prod_1:month:1"].archived is False
        assert {(p.source_id, p.amount) for p in by_id["prod_1:month:1"].prices} == {
            ("price_1", 1000),
        }
        assert by_id["prod_1:month:1:archived"].archived is True
        assert by_id["prod_1:month:1:archived"].product_source_id == "prod_1"
        assert {
            (p.source_id, p.amount) for p in by_id["prod_1:month:1:archived"].prices
        } == {("price_archived", 500)}

    async def test_deleted_catalog_product_is_not_extracted(
        self, mocker: MockerFixture
    ) -> None:
        adapter, client = _adapter(mocker)
        price = _stripe_price(product_id="prod_deleted")
        price["product"]["deleted"] = True
        _listed_prices(mocker, client, price)

        products = await _extracted_products(adapter)

        assert products == []


@pytest.mark.asyncio
class TestExtractPages:
    async def test_customer_page_resumes_and_advances_to_subscriptions(
        self, mocker: MockerFixture
    ) -> None:
        adapter, client = _adapter(mocker)
        customer = stripe_lib.Customer.construct_from(
            {
                "id": "cus_2",
                "email": "customer@example.com",
                "name": "Customer",
                "address": {"country": "US"},
            },
            None,
        )
        client.v1.customers.list_async = mocker.AsyncMock(
            return_value=mocker.MagicMock(data=[customer], has_more=False)
        )

        page = await adapter.extract_page(
            {"phase": "customers", "starting_after": "cus_1"}
        )

        assert [record.source_id for record in page.records] == ["cus_2"]
        assert page.next_cursor == {
            "phase": "subscriptions",
            "starting_after": None,
        }
        client.v1.customers.list_async.assert_awaited_once_with(
            params={
                "limit": 100,
                "expand": ["data.invoice_settings.default_payment_method"],
                "starting_after": "cus_1",
            }
        )

    async def test_skipped_subscription_still_advances_the_page_cursor(
        self, mocker: MockerFixture
    ) -> None:
        adapter, client = _adapter(mocker)
        subscription = _stripe_subscription(id="sub_2", status="incomplete")
        client.v1.subscriptions.list_async = mocker.AsyncMock(
            return_value=mocker.MagicMock(
                data=[subscription],
                has_more=True,
            )
        )

        page = await adapter.extract_page(
            {"phase": "subscriptions", "starting_after": "sub_1"}
        )

        assert page.records == []
        assert page.next_cursor == {
            "phase": "subscriptions",
            "starting_after": "sub_2",
        }

    async def test_last_subscription_page_finishes_extraction(
        self, mocker: MockerFixture
    ) -> None:
        adapter, client = _adapter(mocker)
        client.v1.subscriptions.list_async = mocker.AsyncMock(
            return_value=mocker.MagicMock(
                data=[_stripe_subscription()],
                has_more=False,
            )
        )

        page = await adapter.extract_page(
            {"phase": "subscriptions", "starting_after": None}
        )

        assert len(page.records) == 1
        assert page.next_cursor is None

    async def test_live_subscription_does_not_stage_a_catalog_product(
        self, mocker: MockerFixture
    ) -> None:
        adapter, client = _adapter(mocker)
        subscription = _stripe_subscription(
            items=[
                {
                    "price": _stripe_price(),
                    "quantity": 1,
                    "current_period_start": 1_700_000_000,
                    "current_period_end": 1_702_000_000,
                }
            ]
        )
        client.v1.subscriptions.list_async = mocker.AsyncMock(
            return_value=mocker.MagicMock(
                data=[subscription],
                has_more=False,
            )
        )

        page = await adapter.extract_page({"phase": "subscriptions"})

        assert [
            record for record in page.records if isinstance(record, CanonicalProduct)
        ] == []
        assert len(page.records) == 1
        assert isinstance(page.records[0], CanonicalSubscription)


def _stripe_coupon(
    *,
    id: str = "coupon_1",
    name: str = "Launch",
    percent_off: float | None = 10,
    amount_off: int | None = None,
    currency: str | None = None,
    duration: str = "forever",
    duration_in_months: int | None = None,
    max_redemptions: int | None = None,
    times_redeemed: int = 0,
    redeem_by: int | None = None,
    applies_to: dict[str, Any] | None = None,
) -> stripe_lib.Coupon:
    payload: dict[str, Any] = {
        "id": id,
        "name": name,
        "percent_off": percent_off,
        "amount_off": amount_off,
        "currency": currency,
        "duration": duration,
        "duration_in_months": duration_in_months,
        "max_redemptions": max_redemptions,
        "times_redeemed": times_redeemed,
        "redeem_by": redeem_by,
        "currency_options": None,
        "applies_to": applies_to,
    }
    return stripe_lib.Coupon.construct_from(payload, None)


def _stripe_promotion_code(
    *,
    id: str = "promo_1",
    code: str = "LAUNCH-10",
    coupon: stripe_lib.Coupon | None = None,
    max_redemptions: int | None = None,
    times_redeemed: int = 0,
    expires_at: int | None = None,
    customer: str | None = None,
    first_time_transaction: bool = False,
    minimum_amount: int | None = None,
) -> stripe_lib.PromotionCode:
    return stripe_lib.PromotionCode.construct_from(
        {
            "id": id,
            "code": code,
            "max_redemptions": max_redemptions,
            "times_redeemed": times_redeemed,
            "expires_at": expires_at,
            "customer": customer,
            "promotion": {"coupon": coupon or _stripe_coupon()},
            "restrictions": {
                "first_time_transaction": first_time_transaction,
                "minimum_amount": minimum_amount,
            },
        },
        None,
    )


@pytest.mark.asyncio
class TestExtractCoupons:
    async def test_coupon_page_maps_remaining_and_advances(
        self, mocker: MockerFixture
    ) -> None:
        adapter, client = _adapter(mocker)
        client.v1.coupons.list_async = mocker.AsyncMock(
            return_value=mocker.MagicMock(
                data=[
                    _stripe_coupon(),
                    _stripe_coupon(
                        id="coupon_exhausted", max_redemptions=10, times_redeemed=10
                    ),
                ],
                has_more=False,
            )
        )

        page = await adapter.extract_page({"phase": "coupons"})

        launch, exhausted = page.records
        assert isinstance(launch, CanonicalDiscount)
        assert launch.discount_type == CanonicalDiscountType.percentage
        assert launch.basis_points == 1000
        assert isinstance(exhausted, CanonicalDiscount)
        assert exhausted.max_redemptions == 0
        assert page.next_cursor == {
            "phase": "promotion_codes",
            "starting_after": None,
        }

    async def test_promotion_code_caps_remaining_and_advances(
        self, mocker: MockerFixture
    ) -> None:
        adapter, client = _adapter(mocker)
        client.v1.promotion_codes.list_async = mocker.AsyncMock(
            return_value=mocker.MagicMock(
                data=[
                    _stripe_promotion_code(
                        code="LAUNCH-10",
                        coupon=_stripe_coupon(max_redemptions=100, times_redeemed=0),
                        max_redemptions=10,
                        times_redeemed=7,
                    )
                ],
                has_more=False,
            )
        )

        page = await adapter.extract_page({"phase": "promotion_codes"})

        discount = page.records[0]
        assert isinstance(discount, CanonicalDiscount)
        assert discount.source_id == "coupon_1"
        assert discount.code == "LAUNCH10"
        assert discount.max_redemptions == 3
        assert page.next_cursor == {
            "phase": "customers",
            "starting_after": None,
        }

    async def test_restricted_promotion_codes_are_not_staged(
        self, mocker: MockerFixture
    ) -> None:
        adapter, client = _adapter(mocker)
        client.v1.promotion_codes.list_async = mocker.AsyncMock(
            return_value=mocker.MagicMock(
                data=[
                    _stripe_promotion_code(id="promo_customer", customer="cus_1"),
                    _stripe_promotion_code(
                        id="promo_first", first_time_transaction=True
                    ),
                    _stripe_promotion_code(id="promo_min", minimum_amount=1000),
                ],
                has_more=False,
            )
        )

        page = await adapter.extract_page({"phase": "promotion_codes"})

        assert page.records == []

    async def test_promotion_code_caps_ends_at_with_expires_at(
        self, mocker: MockerFixture
    ) -> None:
        adapter, client = _adapter(mocker)
        client.v1.promotion_codes.list_async = mocker.AsyncMock(
            return_value=mocker.MagicMock(
                data=[
                    _stripe_promotion_code(
                        coupon=_stripe_coupon(redeem_by=2_000_000_000),
                        expires_at=1_800_000_000,
                    )
                ],
                has_more=False,
            )
        )

        page = await adapter.extract_page({"phase": "promotion_codes"})

        discount = page.records[0]
        assert isinstance(discount, CanonicalDiscount)
        assert discount.ends_at == datetime(2027, 1, 15, 8, 0, tzinfo=UTC)

    async def test_subscription_page_maps_each_coupon_start(
        self, mocker: MockerFixture
    ) -> None:
        adapter, client = _adapter(mocker)
        subscription = _stripe_subscription()
        subscription["discounts"] = [
            {
                "id": "di_1",
                "start": 1_700_000_000,
                "source": {"coupon": {"id": "coupon_old"}},
            },
            {
                "id": "di_2",
                "start": 1_710_000_000,
                "source": {"coupon": {"id": "coupon_kept"}},
            },
            "di_unexpanded",
        ]
        client.v1.subscriptions.list_async = mocker.AsyncMock(
            return_value=mocker.MagicMock(data=[subscription], has_more=False)
        )

        page = await adapter.extract_page({"phase": "subscriptions"})

        kwargs = client.v1.subscriptions.list_async.await_args.kwargs
        assert "data.discounts" in kwargs["params"]["expand"]
        record = page.records[0]
        assert isinstance(record, CanonicalSubscription)
        assert record.has_discount is True
        assert record.discount_source_ids == ["coupon_old", "coupon_kept"]
        assert record.discount_started_at == datetime(
            2023, 11, 14, 22, 13, 20, tzinfo=UTC
        )
        assert record.discount_starts["coupon_kept"] == datetime(
            2024, 3, 9, 16, 0, tzinfo=UTC
        )

    async def test_missing_coupon_scope_is_named(self, mocker: MockerFixture) -> None:
        adapter, client = _adapter(mocker)
        client.v1.coupons.list_async = mocker.AsyncMock(
            side_effect=stripe_lib.PermissionError("missing coupon scope")
        )

        with pytest.raises(StripeMissingScope) as exc:
            await adapter.extract_page({"phase": "coupons"})

        assert exc.value.label == "Coupons"
        assert exc.value.status_code == 400


@pytest.mark.asyncio
class TestGetSubscription:
    async def test_reads_the_current_state(self, mocker: MockerFixture) -> None:
        adapter, client = _adapter(mocker)
        client.v1.subscriptions.retrieve_async = mocker.AsyncMock(
            return_value=_stripe_subscription(cancel_at_period_end=True)
        )

        subscription = await adapter.get_subscription("sub_1")

        assert subscription is not None
        assert subscription.status == CanonicalSubscriptionStatus.active
        assert subscription.cancel_at_period_end is True
        assert subscription.current_period_end is not None

    async def test_reads_the_price_it_is_billed_in(self, mocker: MockerFixture) -> None:
        adapter, client = _adapter(mocker)
        client.v1.subscriptions.retrieve_async = mocker.AsyncMock(
            return_value=_stripe_subscription(
                currency="usd",
                items=[
                    {
                        "price": {"id": "price_1", "currency": "eur"},
                        "quantity": 1,
                        "current_period_start": 1_700_000_000,
                        "current_period_end": 1_702_000_000,
                    }
                ],
            )
        )

        subscription = await adapter.get_subscription("sub_1")

        assert subscription is not None
        assert subscription.price_source_id == "price_1"
        assert subscription.currency == "usd"

    async def test_default_currency_keeps_the_bare_price_id(
        self, mocker: MockerFixture
    ) -> None:
        adapter, client = _adapter(mocker)
        client.v1.subscriptions.retrieve_async = mocker.AsyncMock(
            return_value=_stripe_subscription(currency="usd")
        )

        subscription = await adapter.get_subscription("sub_1")

        assert subscription is not None
        assert subscription.price_source_id == "price_1"
        assert subscription.currency == "usd"

    async def test_carries_the_card_details_the_copy_keeps(
        self, mocker: MockerFixture
    ) -> None:
        """A copy re-mints the `pm_…` id, so these are what identifies the card
        the subscription was actually charging once it lands on our account."""
        adapter, client = _adapter(mocker)
        client.v1.subscriptions.retrieve_async = mocker.AsyncMock(
            return_value=_stripe_subscription(
                payment_method={
                    "id": "pm_source",
                    "object": "payment_method",
                    "type": "card",
                    "card": {
                        "last4": "4242",
                        "brand": "visa",
                        "exp_month": 4,
                        "exp_year": 2030,
                    },
                }
            )
        )

        subscription = await adapter.get_subscription("sub_1")

        assert subscription is not None
        assert subscription.payment_method == CanonicalPaymentMethod(
            source_id="pm_source",
            type=CanonicalPaymentMethodType.card,
            last4="4242",
            brand="visa",
            exp_month=4,
            exp_year=2030,
        )

    async def test_card_countries_are_hints_not_billing_country(
        self, mocker: MockerFixture
    ) -> None:
        adapter, client = _adapter(mocker)
        client.v1.subscriptions.retrieve_async = mocker.AsyncMock(
            return_value=_stripe_subscription(
                payment_method={
                    "id": "pm_source",
                    "object": "payment_method",
                    "type": "card",
                    "billing_details": {"address": {"country": "DE"}},
                    "card": {
                        "last4": "4242",
                        "brand": "visa",
                        "country": "US",
                        "exp_month": 4,
                        "exp_year": 2030,
                    },
                }
            )
        )

        subscription = await adapter.get_subscription("sub_1")

        assert subscription is not None
        assert subscription.payment_method is not None
        assert subscription.payment_method.billing_country == "DE"
        assert subscription.payment_method.card_country == "US"

    async def test_reads_whether_the_source_calculated_tax(
        self, mocker: MockerFixture
    ) -> None:
        adapter, client = _adapter(mocker)
        client.v1.subscriptions.retrieve_async = mocker.AsyncMock(
            return_value=_stripe_subscription(automatic_tax={"enabled": True})
        )

        subscription = await adapter.get_subscription("sub_1")

        assert subscription is not None
        assert subscription.automatic_tax is True

    async def test_unreported_tax_stays_unknown(self, mocker: MockerFixture) -> None:
        # A restricted key can read a subscription without `automatic_tax`;
        # absent is not the same as "no tax was charged".
        adapter, client = _adapter(mocker)
        client.v1.subscriptions.retrieve_async = mocker.AsyncMock(
            return_value=_stripe_subscription()
        )

        subscription = await adapter.get_subscription("sub_1")

        assert subscription is not None
        assert subscription.automatic_tax is None

    @pytest.mark.parametrize(
        ("kwargs", "expected"),
        [
            (
                {
                    "automatic_tax": {"enabled": True},
                    "price_tax_behavior": "exclusive",
                },
                TaxBehavior.exclusive,
            ),
            (
                {
                    "automatic_tax": {"enabled": True},
                    "price_tax_behavior": "unspecified",
                },
                TaxBehavior.inclusive,
            ),
            (
                {
                    "default_tax_rates": [{"id": "txr_1"}],
                    "price_tax_behavior": "exclusive",
                },
                TaxBehavior.exclusive,
            ),
        ],
    )
    async def test_maps_source_tax_into_import_default(
        self,
        mocker: MockerFixture,
        kwargs: dict[str, Any],
        expected: TaxBehavior,
    ) -> None:
        adapter, client = _adapter(mocker)
        client.v1.subscriptions.retrieve_async = mocker.AsyncMock(
            return_value=_stripe_subscription(**kwargs)
        )

        subscription = await adapter.get_subscription("sub_1")

        assert subscription is not None
        assert subscription.import_tax_behavior() == expected

    async def test_reads_a_running_trial(self, mocker: MockerFixture) -> None:
        """The cutover keeps the trial running rather than billing at once, so
        it needs the end date back as an aware datetime."""
        adapter, client = _adapter(mocker)
        client.v1.subscriptions.retrieve_async = mocker.AsyncMock(
            return_value=_stripe_subscription(
                status="trialing", trial_end=1_702_000_000
            )
        )

        subscription = await adapter.get_subscription("sub_1")

        assert subscription is not None
        assert subscription.status == CanonicalSubscriptionStatus.trialing
        assert subscription.trial_end == datetime(2023, 12, 8, 1, 46, 40, tzinfo=UTC)

    async def test_deleted_subscription_is_gone(self, mocker: MockerFixture) -> None:
        adapter, client = _adapter(mocker)
        client.v1.subscriptions.retrieve_async = mocker.AsyncMock(
            side_effect=stripe_lib.InvalidRequestError(
                "No such subscription", "id", code="resource_missing"
            )
        )

        assert await adapter.get_subscription("sub_1") is None

    async def test_other_errors_propagate(self, mocker: MockerFixture) -> None:
        adapter, client = _adapter(mocker)
        client.v1.subscriptions.retrieve_async = mocker.AsyncMock(
            side_effect=stripe_lib.InvalidRequestError("nope", "id", code="other")
        )

        with pytest.raises(stripe_lib.InvalidRequestError):
            await adapter.get_subscription("sub_1")

    async def test_our_own_cancellation_is_recognised(
        self, mocker: MockerFixture
    ) -> None:
        """Otherwise a retry would read it as the customer having churned."""
        adapter, client = _adapter(mocker)
        client.v1.subscriptions.retrieve_async = mocker.AsyncMock(
            return_value=_stripe_subscription(
                status="canceled",
                cancellation_comment="Migrated to Polar (migration abc)",
            )
        )

        subscription = await adapter.get_subscription("sub_1")

        assert subscription is not None
        assert subscription.stopped_for_migration is True

    async def test_a_customer_cancellation_is_not(self, mocker: MockerFixture) -> None:
        adapter, client = _adapter(mocker)
        client.v1.subscriptions.retrieve_async = mocker.AsyncMock(
            return_value=_stripe_subscription(
                status="canceled", cancellation_comment="Too expensive"
            )
        )

        subscription = await adapter.get_subscription("sub_1")

        assert subscription is not None
        assert subscription.stopped_for_migration is False


@pytest.mark.asyncio
class TestStopSourceSubscription:
    async def test_cancels_with_a_traceable_comment(
        self, mocker: MockerFixture
    ) -> None:
        adapter, client = _adapter(mocker)
        client.v1.subscriptions.cancel_async = mocker.AsyncMock()

        await adapter.stop_source_subscription("sub_1", reference="abc")

        _, kwargs = client.v1.subscriptions.cancel_async.call_args
        comment = kwargs["params"]["cancellation_details"]["comment"]
        assert comment.startswith(CANCELLATION_COMMENT_PREFIX)
        assert "abc" in comment

    async def test_already_cancelled_is_done(self, mocker: MockerFixture) -> None:
        adapter, client = _adapter(mocker)
        client.v1.subscriptions.cancel_async = mocker.AsyncMock(
            side_effect=stripe_lib.InvalidRequestError("already canceled", "id")
        )
        client.v1.subscriptions.retrieve_async = mocker.AsyncMock(
            return_value=_stripe_subscription(status="canceled")
        )

        await adapter.stop_source_subscription("sub_1", reference="abc")

    async def test_a_real_failure_propagates(self, mocker: MockerFixture) -> None:
        """The caller must not activate on Polar while the source keeps billing."""
        adapter, client = _adapter(mocker)
        client.v1.subscriptions.cancel_async = mocker.AsyncMock(
            side_effect=stripe_lib.InvalidRequestError("bad request", "id")
        )
        client.v1.subscriptions.retrieve_async = mocker.AsyncMock(
            return_value=_stripe_subscription(status="active")
        )

        with pytest.raises(stripe_lib.InvalidRequestError):
            await adapter.stop_source_subscription("sub_1", reference="abc")


class TestMapCustomer:
    def test_customer_country_takes_priority(self, mocker: MockerFixture) -> None:
        adapter, _ = _adapter(mocker)
        customer = stripe_lib.Customer.construct_from(
            {
                "id": "cus_1",
                "email": "a@example.com",
                "name": "A",
                "address": {"country": "FR"},
                "invoice_settings": {
                    "default_payment_method": {
                        "id": "pm_1",
                        "object": "payment_method",
                        "type": "card",
                        "billing_details": {"address": {"country": "DE"}},
                        "card": {"country": "US", "last4": "4242", "brand": "visa"},
                    }
                },
            },
            None,
        )

        mapped = adapter._map_customer(customer)

        assert mapped.country == "FR"
        assert mapped.country_hint is None
        assert mapped.billing_address is not None
        assert mapped.billing_address.country == "FR"

    @pytest.mark.parametrize(
        ("fields", "expected"),
        [
            (
                {
                    "invoice_settings": {
                        "default_payment_method": {
                            "id": "pm_1",
                            "object": "payment_method",
                            "type": "card",
                            "billing_details": {"address": {"country": "DE"}},
                            "card": {"country": "US"},
                        }
                    }
                },
                "DE",
            ),
            (
                {
                    "invoice_settings": {
                        "default_payment_method": {
                            "id": "pm_1",
                            "object": "payment_method",
                            "type": "card",
                            "billing_details": {"address": None},
                            "card": {"country": "US"},
                        }
                    }
                },
                "US",
            ),
            (
                {
                    "default_source": {
                        "id": "card_1",
                        "object": "card",
                        "address_country": "IE",
                        "country": "US",
                    }
                },
                "IE",
            ),
            (
                {
                    "tax": {
                        "automatic_tax": "supported",
                        "location": {"country": "IE", "source": "ip_address"},
                    }
                },
                None,
            ),
        ],
    )
    def test_country_fallbacks(
        self,
        mocker: MockerFixture,
        fields: dict[str, object],
        expected: str | None,
    ) -> None:
        adapter, _ = _adapter(mocker)
        customer = stripe_lib.Customer.construct_from(
            {
                "id": "cus_1",
                "email": "a@example.com",
                "name": "A",
                "address": None,
                **fields,
            },
            None,
        )

        mapped = adapter._map_customer(customer)

        assert mapped.country is None
        assert mapped.country_hint == expected
