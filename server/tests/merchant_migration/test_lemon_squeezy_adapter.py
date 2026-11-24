from datetime import UTC, datetime
from typing import Any

import httpx2
import pytest

from polar.enums import TaxBehavior
from polar.merchant_migration.adapters.lemon_squeezy import (
    API_BASE_URL,
    LemonSqueezyAdapter,
    LemonSqueezyStoreNotFound,
    LemonSqueezyStoreRequired,
)
from polar.merchant_migration.canonical import (
    CanonicalCustomer,
    CanonicalDiscount,
    CanonicalDiscountDuration,
    CanonicalDiscountType,
    CanonicalPaymentMethodType,
    CanonicalPricingScheme,
    CanonicalProduct,
    CanonicalSubscription,
    CanonicalSubscriptionStatus,
)

STORE = {
    "type": "stores",
    "id": "1",
    "attributes": {"name": "Acme", "currency": "USD", "country": "US"},
}


def _page(
    data: list[dict[str, Any]], included: list[dict[str, Any]] | None = None
) -> dict[str, Any]:
    return {
        "data": data,
        "included": included or [],
        "meta": {"page": {"currentPage": 1, "lastPage": 1}},
    }


def _price(
    price_id: str,
    variant_id: int,
    unit_price: int | None,
    created_at: str,
    **overrides: Any,
) -> dict[str, Any]:
    return {
        "type": "prices",
        "id": price_id,
        "attributes": {
            "variant_id": variant_id,
            "category": "subscription",
            "scheme": "standard",
            "usage_aggregation": None,
            "unit_price": unit_price,
            "renewal_interval_unit": "month",
            "renewal_interval_quantity": 1,
            "created_at": created_at,
            **overrides,
        },
    }


def _subscription(**overrides: Any) -> dict[str, Any]:
    return {
        "type": "subscriptions",
        "id": "100",
        "attributes": {
            "store_id": 1,
            "customer_id": 50,
            "order_id": 70,
            "variant_id": 10,
            "status": "active",
            "cancelled": False,
            "pause": None,
            "card_brand": "visa",
            "card_last_four": "4242",
            "payment_processor": "stripe",
            "trial_ends_at": None,
            "billing_anchor": 15,
            "renews_at": "2026-12-15T00:00:00.000000Z",
            "ends_at": None,
            "order_item_id": 80,
            "first_subscription_item": {"id": 1, "price_id": 21, "quantity": 1},
            "created_at": "2026-11-01T00:00:00.000000Z",
            **overrides,
        },
    }


ROUTES: dict[str, dict[str, Any]] = {
    "/v1/stores": _page([STORE]),
    "/v1/prices": _page(
        [
            _price("20", 10, 900, "2025-01-01T00:00:00Z"),
            _price("21", 10, 1200, "2026-01-01T00:00:00Z"),
            _price("99", 999, 500, "2026-01-01T00:00:00Z"),
        ]
    ),
    "/v1/variants": _page(
        [
            {
                "type": "variants",
                "id": "10",
                "attributes": {"product_id": 5, "name": "Pro", "status": "published"},
            },
            {
                "type": "variants",
                "id": "999",
                "attributes": {"product_id": 6, "name": "Other", "status": "published"},
            },
        ],
        included=[
            {
                "type": "products",
                "id": "5",
                "attributes": {"store_id": 1, "name": "App", "status": "published"},
            },
            {
                "type": "products",
                "id": "6",
                "attributes": {"store_id": 2, "name": "Other store"},
            },
        ],
    ),
    "/v1/discounts": _page(
        [
            {
                "type": "discounts",
                "id": "30",
                "attributes": {
                    "name": "Launch",
                    "code": "LAUNCH20",
                    "amount": 20,
                    "amount_type": "percent",
                    "duration": "repeating",
                    "duration_in_months": 3,
                    "is_limited_to_products": True,
                    "is_limited_redemptions": True,
                    "max_redemptions": 5,
                    "expires_at": None,
                    "status": "published",
                },
                "relationships": {
                    "variants": {
                        "links": {
                            "related": f"{API_BASE_URL}/discounts/30/variants",
                        }
                    }
                },
            }
        ]
    ),
    "/v1/discounts/30/variants": _page([{"type": "variants", "id": "10"}]),
    "/v1/customers": _page(
        [
            {
                "type": "customers",
                "id": "50",
                "attributes": {
                    "name": "Ada",
                    "email": "ada@example.com",
                    "country": "FR",
                    "stripe_customer_id": "cus_ls_ada",
                },
            }
        ]
    ),
    "/v1/discount-redemptions": _page(
        [
            {
                "type": "discount-redemptions",
                "id": "40",
                "attributes": {
                    "discount_id": 30,
                    "order_id": 70,
                    "created_at": "2026-10-15T00:00:00Z",
                },
            }
        ]
    ),
    "/v1/subscriptions": _page([_subscription(), _subscription(status="expired")]),
    "/v1/orders": _page(
        [{"type": "orders", "id": "70", "attributes": {"tax_inclusive": False}}]
    ),
    "/v1/license-keys": _page(
        [
            {
                "type": "license-keys",
                "id": "60",
                "attributes": {
                    "order_item_id": 80,
                    "key": "KEY-SUB",
                    "status": "active",
                },
            },
            {
                "type": "license-keys",
                "id": "61",
                "attributes": {"order_item_id": 81, "key": "KEY-OFF", "disabled": True},
            },
        ]
    ),
}


def _adapter(
    routes: dict[str, Any] | None = None, store_id: str | None = None
) -> tuple[LemonSqueezyAdapter, list[httpx2.Request]]:
    requests: list[httpx2.Request] = []
    table = {**ROUTES, **(routes or {})}

    def handler(request: httpx2.Request) -> httpx2.Response:
        requests.append(request)
        body = table.get(request.url.path)
        if isinstance(body, list):
            return body.pop(0)
        if body is None:
            return httpx2.Response(404, json={"errors": []})
        return httpx2.Response(200, json=body)

    client = httpx2.AsyncClient(
        base_url=API_BASE_URL, transport=httpx2.MockTransport(handler)
    )
    return LemonSqueezyAdapter("key", store_id, client=client), requests


@pytest.mark.anyio
class TestExtract:
    async def test_maps_store(self) -> None:
        adapter, _ = _adapter()

        records = [record async for record in adapter.extract()]

        products = [r for r in records if isinstance(r, CanonicalProduct)]
        assert len(products) == 1
        product = products[0]
        assert product.name == "App - Pro"
        assert product.recurring_interval == "month"
        assert [
            (p.source_id, p.amount, p.is_default, p.active) for p in product.prices
        ] == [
            ("20", 900, False, False),
            ("21", 1200, True, True),
        ]
        assert product.prices[0].currency == "usd"

        [discount] = [r for r in records if isinstance(r, CanonicalDiscount)]
        assert discount.discount_type == CanonicalDiscountType.percentage
        assert discount.basis_points == 2000
        assert discount.duration == CanonicalDiscountDuration.repeating
        assert discount.product_source_ids == ["10"]
        assert discount.max_redemptions == 4

        [customer] = [r for r in records if isinstance(r, CanonicalCustomer)]
        assert customer.email == "ada@example.com"
        assert customer.country == "FR"
        assert customer.stripe_customer_id == "cus_ls_ada"

        [subscription] = [r for r in records if isinstance(r, CanonicalSubscription)]
        assert subscription.status == CanonicalSubscriptionStatus.active
        assert subscription.price_source_id == "21"
        assert subscription.current_period_end == datetime(2026, 12, 15, tzinfo=UTC)
        assert subscription.current_period_start == datetime(2026, 11, 15, tzinfo=UTC)
        assert subscription.discount_source_ids == ["30"]
        assert subscription.payment_method is not None
        assert subscription.payment_method.type == CanonicalPaymentMethodType.card
        assert subscription.payment_method.last4 == "4242"
        assert subscription.price_tax_behavior == TaxBehavior.exclusive
        assert subscription.import_tax_behavior() == TaxBehavior.exclusive
        assert subscription.license_key is None

    async def test_usage_price_reads_decimal_cents(self) -> None:
        usage = {"usage_aggregation": "sum"}
        adapter, _ = _adapter(
            {
                "/v1/prices": _page(
                    [
                        _price(
                            "20",
                            10,
                            None,
                            "2025-01-01T00:00:00Z",
                            **usage,
                            unit_price_decimal="0.5000000000",
                        ),
                        _price(
                            "21",
                            10,
                            None,
                            "2026-01-01T00:00:00Z",
                            **usage,
                            unit_price_decimal="10.0000000000",
                        ),
                    ]
                )
            }
        )

        records = [record async for record in adapter.extract()]

        [product] = [r for r in records if isinstance(r, CanonicalProduct)]
        assert [(p.amount, p.pricing_scheme) for p in product.prices] == [
            (None, CanonicalPricingScheme.metered),
            (10, CanonicalPricingScheme.metered),
        ]

    async def test_one_time_price_is_not_recurring(self) -> None:
        adapter, _ = _adapter(
            {
                "/v1/prices": _page(
                    [
                        _price(
                            "21", 10, 1200, "2026-01-01T00:00:00Z", category="one_time"
                        )
                    ]
                )
            }
        )

        records = [record async for record in adapter.extract()]

        [product] = [r for r in records if isinstance(r, CanonicalProduct)]
        assert product.recurring_interval is None
        assert product.recurring_interval_count == 1

    async def test_tiered_price_has_no_single_amount(self) -> None:
        adapter, _ = _adapter(
            {
                "/v1/prices": _page(
                    [_price("21", 10, 1200, "2026-01-01T00:00:00Z", scheme="volume")]
                )
            }
        )

        records = [record async for record in adapter.extract()]

        [product] = [r for r in records if isinstance(r, CanonicalProduct)]
        assert product.prices[0].amount is None
        assert product.prices[0].pricing_scheme == CanonicalPricingScheme.tiered

    async def test_default_variant_is_sold_under_the_product_name(self) -> None:
        variants = ROUTES["/v1/variants"]
        adapter, _ = _adapter(
            {
                "/v1/variants": {
                    **variants,
                    "data": [
                        {
                            "type": "variants",
                            "id": "10",
                            "attributes": {
                                "product_id": 5,
                                "name": "Default",
                                "status": "pending",
                            },
                        }
                    ],
                }
            }
        )

        records = [record async for record in adapter.extract()]

        [product] = [r for r in records if isinstance(r, CanonicalProduct)]
        assert product.name == "App"
        assert product.archived is False

    async def test_limited_discount_without_variants_is_left_out(self) -> None:
        adapter, _ = _adapter({"/v1/discounts/30/variants": _page([])})

        records = [record async for record in adapter.extract()]

        assert not [r for r in records if isinstance(r, CanonicalDiscount)]


@pytest.mark.anyio
class TestGetSourceAccount:
    async def test_maps_store(self) -> None:
        adapter, _ = _adapter()

        account = await adapter.get_source_account()

        assert account.country == "US"
        assert account.has_connected_accounts is False

    async def test_several_stores_require_a_choice(self) -> None:
        adapter, _ = _adapter({"/v1/stores": _page([STORE, {**STORE, "id": "2"}])})

        with pytest.raises(LemonSqueezyStoreRequired):
            await adapter.get_source_account()

    async def test_unknown_store(self) -> None:
        adapter, _ = _adapter(store_id="2")

        with pytest.raises(LemonSqueezyStoreNotFound):
            await adapter.get_source_account()

    async def test_retries_when_rate_limited(self) -> None:
        adapter, requests = _adapter(
            {
                "/v1/stores": [
                    httpx2.Response(429, headers={"Retry-After": "0"}),
                    httpx2.Response(200, json=_page([STORE])),
                ]
            }
        )

        account = await adapter.get_source_account()

        assert account.country == "US"
        assert len(requests) == 2


@pytest.mark.anyio
class TestGetSubscription:
    async def test_reads_the_subscriptions_license_key(self) -> None:
        adapter, requests = _adapter(
            {"/v1/subscriptions/100": {"data": _subscription()}}
        )

        subscription = await adapter.get_subscription("100")

        assert subscription is not None
        assert subscription.license_key == "KEY-SUB"
        [lookup] = [r for r in requests if r.url.path == "/v1/license-keys"]
        assert lookup.url.params["filter[order_item_id]"] == "80"

    async def test_period_start_keeps_month_end_anchor(self) -> None:
        adapter, _ = _adapter(
            {
                "/v1/subscriptions/100": {
                    "data": _subscription(
                        billing_anchor=31, renews_at="2027-02-28T00:00:00Z"
                    )
                }
            }
        )

        subscription = await adapter.get_subscription("100")

        assert subscription is not None
        assert subscription.current_period_start == datetime(2027, 1, 31, tzinfo=UTC)

    async def test_cancelled_is_a_pending_end(self) -> None:
        adapter, _ = _adapter(
            {
                "/v1/subscriptions/100": {
                    "data": _subscription(
                        status="cancelled",
                        cancelled=True,
                        ends_at="2026-12-15T00:00:00Z",
                    )
                }
            }
        )

        subscription = await adapter.get_subscription("100")

        assert subscription is not None
        assert subscription.status == CanonicalSubscriptionStatus.active
        assert subscription.cancel_at_period_end is True
        assert subscription.current_period_end == datetime(2026, 12, 15, tzinfo=UTC)

    async def test_trial_without_item_uses_current_price(self) -> None:
        adapter, _ = _adapter(
            {
                "/v1/subscriptions/100": {
                    "data": _subscription(
                        status="on_trial",
                        first_subscription_item=None,
                        trial_ends_at="2026-12-01T00:00:00Z",
                    )
                }
            }
        )

        subscription = await adapter.get_subscription("100")

        assert subscription is not None
        assert subscription.trialing is True
        assert subscription.price_source_id == "21"
        assert subscription.current_period_start == datetime(2026, 11, 1, tzinfo=UTC)
        assert subscription.current_period_end == datetime(2026, 12, 1, tzinfo=UTC)

    async def test_paypal_must_be_reentered(self) -> None:
        adapter, _ = _adapter(
            {
                "/v1/subscriptions/100": {
                    "data": _subscription(
                        payment_processor="paypal", card_brand="", card_last_four=""
                    )
                }
            }
        )

        subscription = await adapter.get_subscription("100")

        assert subscription is not None
        assert subscription.payment_method is not None
        assert subscription.payment_method.type == CanonicalPaymentMethodType.paypal
        assert subscription.payment_method.last4 is None

    async def test_non_card_on_stripe_must_be_reentered(self) -> None:
        adapter, _ = _adapter(
            {
                "/v1/subscriptions/100": {
                    "data": _subscription(card_brand="", card_last_four="")
                }
            }
        )

        subscription = await adapter.get_subscription("100")

        assert subscription is not None
        assert subscription.payment_method is not None
        assert subscription.payment_method.type == CanonicalPaymentMethodType.other

    async def test_card_carries_the_customer_country(self) -> None:
        adapter, requests = _adapter(
            {
                "/v1/subscriptions/100": {
                    "data": _subscription(),
                    "included": [
                        {
                            "type": "customers",
                            "id": "50",
                            "attributes": {"country": "IN"},
                        }
                    ],
                }
            }
        )

        subscription = await adapter.get_subscription("100")

        assert subscription is not None
        assert subscription.payment_method is not None
        assert subscription.payment_method.billing_country == "IN"
        assert requests[0].url.params["include"] == "customer"

    async def test_missing(self) -> None:
        adapter, _ = _adapter()

        assert await adapter.get_subscription("404") is None


@pytest.mark.anyio
class TestStopSourceSubscription:
    async def test_cancels(self) -> None:
        adapter, requests = _adapter(
            {"/v1/subscriptions/100": {"data": _subscription()}}
        )

        await adapter.stop_source_subscription("100", reference="mig")

        assert (requests[-1].method, requests[-1].url.path) == (
            "DELETE",
            "/v1/subscriptions/100",
        )

    async def test_already_cancelled_is_left_alone(self) -> None:
        adapter, requests = _adapter(
            {
                "/v1/subscriptions/100": {
                    "data": _subscription(status="cancelled", cancelled=True)
                }
            }
        )

        await adapter.stop_source_subscription("100", reference="mig")

        assert [request.method for request in requests] == ["GET"]


def _variant(variant_id: str, product_id: int, **attributes: Any) -> dict[str, Any]:
    return {
        "type": "variants",
        "id": variant_id,
        "attributes": {
            "product_id": product_id,
            "name": variant_id,
            "status": "published",
            **attributes,
        },
    }


def _file(file_id: str, variant_id: int, **attributes: Any) -> dict[str, Any]:
    return {
        "type": "files",
        "id": file_id,
        "attributes": {
            "variant_id": variant_id,
            "name": f"{file_id}.zip",
            "size": 1024,
            "status": "published",
            **attributes,
        },
    }


@pytest.mark.anyio
class TestListBenefits:
    async def test_variants_giving_the_same_access_share_a_benefit(self) -> None:
        license = {
            "has_license_keys": True,
            "license_activation_limit": 3,
            "license_length_value": 1,
            "license_length_unit": "years",
        }
        adapter, _ = _adapter(
            {
                "/v1/variants": _page(
                    [
                        _variant("10", 5, **license),
                        _variant(
                            "11",
                            5,
                            links=[{"title": "Docs", "url": "https://example.com"}],
                            **license,
                        ),
                        _variant(
                            "12",
                            5,
                            has_license_keys=True,
                            is_license_limit_unlimited=True,
                            is_license_length_unlimited=True,
                        ),
                        _variant("14", 8, **license),
                        _variant("999", 6, **license),
                    ],
                    included=[
                        {
                            "type": "products",
                            "id": "5",
                            "attributes": {"store_id": 1, "name": "App"},
                        },
                        {
                            "type": "products",
                            "id": "6",
                            "attributes": {"store_id": 2, "name": "Other"},
                        },
                        {
                            "type": "products",
                            "id": "8",
                            "attributes": {"store_id": 1, "name": "Plugin"},
                        },
                    ],
                ),
                "/v1/files": _page(
                    [
                        _file("1", 10),
                        _file("1", 11),
                        _file("2", 12, status="draft"),
                        _file("3", 999),
                    ]
                ),
            },
            store_id="1",
        )

        benefits = await adapter.list_benefits()

        limited, unlimited, other_product, files, links = benefits
        assert limited.product_source_ids == ["10", "11"]
        assert limited.license_keys is not None
        assert limited.license_keys.activation_limit == 3
        assert (limited.for_subscriptions, limited.for_one_time) == (True, False)
        assert (
            limited.license_keys.expires_ttl,
            limited.license_keys.expires_timeframe,
        ) == (1, "year")
        assert other_product.product_source_ids == ["14"]
        assert other_product.source_id != limited.source_id
        assert limited.source_id.startswith("1:")
        assert unlimited.product_source_ids == ["12"]
        assert unlimited.license_keys is not None
        assert unlimited.license_keys.activation_limit is None
        assert unlimited.license_keys.expires_ttl is None
        assert files.product_source_ids == ["10", "11"]
        assert [file.name for file in files.files] == ["1.zip"]
        assert links.product_source_ids == ["11"]
        assert [(link.title, link.url) for link in links.links] == [
            ("Docs", "https://example.com")
        ]


@pytest.mark.anyio
class TestListPurchases:
    async def test_keeps_paid_one_time_orders(self) -> None:
        def order(
            order_id: str, variant_id: int, item_id: int, **attributes: Any
        ) -> dict[str, Any]:
            return {
                "type": "orders",
                "id": order_id,
                "attributes": {
                    "status": "paid",
                    "refunded": False,
                    "user_email": "ada@example.com",
                    "user_name": "Ada",
                    "first_order_item": {"id": item_id, "variant_id": variant_id},
                    **attributes,
                },
            }

        adapter, _ = _adapter(
            {
                "/v1/prices": _page(
                    [
                        _price("21", 10, 1200, "2026-01-01T00:00:00Z"),
                        _price(
                            "22", 12, 1900, "2026-01-01T00:00:00Z", category="one_time"
                        ),
                    ]
                ),
                "/v1/orders": _page(
                    [
                        order("70", 10, 80),
                        order("71", 12, 81),
                        order("72", 12, 82, refunded=True),
                        order("73", 12, 83, status="pending"),
                        order("74", 12, 84),
                    ]
                ),
                "/v1/license-keys": _page(
                    [
                        {
                            "type": "license-keys",
                            "id": "60",
                            "attributes": {"order_item_id": 84, "key": "KEY-LIFETIME"},
                        },
                        {
                            "type": "license-keys",
                            "id": "61",
                            "attributes": {
                                "order_item_id": 81,
                                "key": "KEY-REVOKED",
                                "disabled": True,
                            },
                        },
                    ]
                ),
            },
            store_id="1",
        )

        purchases, has_more = await adapter.list_purchases(1)

        assert not has_more
        assert [
            (p.source_id, p.license_key, p.license_key_disabled) for p in purchases
        ] == [
            ("71", None, True),
            ("74", "KEY-LIFETIME", False),
        ]
