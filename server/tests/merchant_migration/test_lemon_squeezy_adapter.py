from datetime import UTC, datetime
from typing import Any

import httpx2
import pytest

from polar.merchant_migration.adapters.lemon_squeezy import (
    API_BASE_URL,
    LemonSqueezyAdapter,
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
    price_id: str, variant_id: int, unit_price: int, created_at: str, **overrides: Any
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
            "first_subscription_item": {"id": 1, "price_id": 21, "quantity": 1},
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
                "attributes": {"store_id": 1, "name": "App"},
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
                    "is_limited_redemptions": False,
                    "max_redemptions": 0,
                    "expires_at": None,
                    "status": "published",
                },
                "relationships": {
                    "variants": {"data": [{"type": "variants", "id": "10"}]}
                },
            }
        ]
    ),
    "/v1/customers": _page(
        [
            {
                "type": "customers",
                "id": "50",
                "attributes": {
                    "name": "Ada",
                    "email": "ada@example.com",
                    "country": "FR",
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
}


def _adapter(
    routes: dict[str, Any] | None = None, store_id: str | None = None
) -> tuple[LemonSqueezyAdapter, list[httpx2.Request]]:
    requests: list[httpx2.Request] = []
    table = {**ROUTES, **(routes or {})}

    def handler(request: httpx2.Request) -> httpx2.Response:
        requests.append(request)
        body = table.get(request.url.path)
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

        [customer] = [r for r in records if isinstance(r, CanonicalCustomer)]
        assert customer.email == "ada@example.com"
        assert customer.country == "FR"

        [subscription] = [r for r in records if isinstance(r, CanonicalSubscription)]
        assert subscription.status == CanonicalSubscriptionStatus.active
        assert subscription.price_source_id == "21"
        assert subscription.current_period_end == datetime(2026, 12, 15, tzinfo=UTC)
        assert subscription.current_period_start == datetime(2026, 11, 15, tzinfo=UTC)
        assert subscription.discount_source_ids == ["30"]
        assert subscription.payment_method is not None
        assert subscription.payment_method.type == CanonicalPaymentMethodType.card
        assert subscription.payment_method.last4 == "4242"

    async def test_several_stores_require_a_choice(self) -> None:
        adapter, _ = _adapter({"/v1/stores": _page([STORE, {**STORE, "id": "2"}])})

        with pytest.raises(LemonSqueezyStoreRequired):
            await adapter.get_source_account()

    async def test_usage_price_is_metered(self) -> None:
        adapter, _ = _adapter(
            {
                "/v1/prices": _page(
                    [
                        _price(
                            "21",
                            10,
                            10,
                            "2026-01-01T00:00:00Z",
                            usage_aggregation="sum",
                        )
                    ]
                )
            }
        )

        records = [record async for record in adapter.extract()]

        [product] = [r for r in records if isinstance(r, CanonicalProduct)]
        assert product.prices[0].pricing_scheme == CanonicalPricingScheme.metered


@pytest.mark.anyio
class TestGetSubscription:
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

    async def test_paypal_must_be_reentered(self) -> None:
        adapter, _ = _adapter(
            {
                "/v1/subscriptions/100": {
                    "data": _subscription(payment_processor="paypal", card_brand=None)
                }
            }
        )

        subscription = await adapter.get_subscription("100")

        assert subscription is not None
        assert subscription.payment_method is not None
        assert subscription.payment_method.type == CanonicalPaymentMethodType.other

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
