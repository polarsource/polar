"""Reads a merchant's Stripe account with its own restricted-key client
(never Polar's platform key) and normalizes it into CanonicalRecords."""

from collections.abc import AsyncIterator
from datetime import UTC, datetime
from typing import Any

import stripe as stripe_lib

from ..canonical import (
    CanonicalCollectionMethod,
    CanonicalCustomer,
    CanonicalPaymentMethod,
    CanonicalPaymentMethodType,
    CanonicalPrice,
    CanonicalPricingScheme,
    CanonicalProduct,
    CanonicalRecord,
    CanonicalSubscription,
    CanonicalSubscriptionStatus,
)

# Period data moved onto the subscription item in this version; read it per item.
STRIPE_API_VERSION = "2026-01-28.clover"
PAGE_SIZE = 100

SKIPPED_SUBSCRIPTION_STATUSES = frozenset(
    {"canceled", "incomplete", "incomplete_expired"}
)


class StripeAdapter:
    def __init__(self, access_token: str) -> None:
        self._client = stripe_lib.StripeClient(
            access_token, stripe_version=STRIPE_API_VERSION
        )

    async def extract(self) -> AsyncIterator[CanonicalRecord]:
        async for product in self._extract_products():
            yield product
        async for customer in self._extract_customers():
            yield customer
        async for subscription in self._extract_subscriptions():
            yield subscription

    async def _extract_products(self) -> AsyncIterator[CanonicalProduct]:
        # Buffer + group prices per (product, interval); catalogs are small,
        # unlike customers, so holding them in memory is fine.
        grouped: dict[str, CanonicalProduct] = {}
        prices = await self._client.v1.prices.list_async(
            params={
                "active": True,
                "limit": PAGE_SIZE,
                "expand": ["data.product"],
            }
        )
        async for price in prices.auto_paging_iter():
            product = price.product
            # A deleted product deserializes as a Product with no `active`/`name`;
            # `not active` skips deleted and archived alike.
            if not isinstance(product, stripe_lib.Product) or not product.get("active"):
                continue
            recurring = price.recurring
            interval = recurring.interval if recurring else None
            interval_count = recurring.interval_count if recurring else 1
            key = f"{product.id}:{interval}:{interval_count}"
            canonical = grouped.get(key)
            if canonical is None:
                canonical = CanonicalProduct(
                    source_id=key,
                    product_source_id=product.id,
                    name=product.name or "",
                    recurring_interval=interval,
                    recurring_interval_count=interval_count,
                    prices=[],
                )
                grouped[key] = canonical
            canonical.prices.append(self._map_price(price))
        for canonical in grouped.values():
            yield canonical

    async def _extract_customers(self) -> AsyncIterator[CanonicalCustomer]:
        customers = await self._client.v1.customers.list_async(
            params={"limit": PAGE_SIZE}
        )
        async for customer in customers.auto_paging_iter():
            yield self._map_customer(customer)

    async def _extract_subscriptions(self) -> AsyncIterator[CanonicalSubscription]:
        subscriptions = await self._client.v1.subscriptions.list_async(
            params={
                "status": "all",
                "limit": PAGE_SIZE,
                "expand": [
                    "data.default_payment_method",
                    "data.customer.invoice_settings.default_payment_method",
                    "data.customer.default_source",
                ],
            }
        )
        async for subscription in subscriptions.auto_paging_iter():
            if subscription.status in SKIPPED_SUBSCRIPTION_STATUSES:
                continue
            if not subscription["items"]["data"]:
                continue
            yield self._map_subscription(subscription)

    def _map_price(self, price: stripe_lib.Price) -> CanonicalPrice:
        return CanonicalPrice(
            source_id=price.id,
            currency=price.currency,
            amount=price.unit_amount,
            pricing_scheme=self._map_pricing_scheme(price),
        )

    def _map_pricing_scheme(self, price: stripe_lib.Price) -> CanonicalPricingScheme:
        if price.billing_scheme == "tiered":
            return CanonicalPricingScheme.tiered
        recurring = price.recurring
        if recurring is not None and recurring.usage_type == "metered":
            return CanonicalPricingScheme.metered
        return CanonicalPricingScheme.fixed

    def _map_subscription(
        self, subscription: stripe_lib.Subscription
    ) -> CanonicalSubscription:
        items = subscription["items"]["data"]
        first_item = items[0]
        return CanonicalSubscription(
            source_id=subscription.id,
            customer_source_id=self._id_of(subscription.customer),
            price_source_id=self._id_of(first_item["price"]),
            status=self._map_status(subscription.status),
            collection_method=self._map_collection_method(
                subscription.collection_method
            ),
            current_period_start=self._to_datetime(
                first_item.get("current_period_start")
            ),
            current_period_end=self._to_datetime(first_item.get("current_period_end")),
            trialing=subscription.status == "trialing",
            paused_collection=subscription.pause_collection is not None,
            line_item_count=len(items),
            quantity=first_item.get("quantity") or 1,
            payment_method=self._resolve_payment_method(subscription),
        )

    def _map_customer(self, customer: stripe_lib.Customer) -> CanonicalCustomer:
        address = customer.address
        return CanonicalCustomer(
            source_id=customer.id,
            email=customer.email or "",
            name=customer.name,
            country=address.country if address is not None else None,
        )

    def _resolve_payment_method(
        self, subscription: stripe_lib.Subscription
    ) -> CanonicalPaymentMethod | None:
        # Fall back to the customer's default like Stripe does when the sub has
        # no explicit method, so a re-entry-only method isn't silently missed.
        payment_method = self._map_payment_method(subscription.default_payment_method)
        if payment_method is not None:
            return payment_method
        customer = subscription.customer
        if not isinstance(customer, stripe_lib.Customer):
            return None
        invoice_settings = customer.invoice_settings
        if invoice_settings is not None:
            payment_method = self._map_payment_method(
                invoice_settings.default_payment_method
            )
            if payment_method is not None:
                return payment_method
        default_source = customer.default_source
        if default_source is not None and not isinstance(default_source, str):
            # Legacy `source`/`card` object (not a PaymentMethod): doesn't PAN-copy.
            return CanonicalPaymentMethod(
                source_id=default_source["id"], type=CanonicalPaymentMethodType.other
            )
        return None

    def _map_status(self, status: str) -> CanonicalSubscriptionStatus:
        try:
            return CanonicalSubscriptionStatus(status)
        except ValueError:
            return CanonicalSubscriptionStatus.other

    def _map_collection_method(self, method: str | None) -> CanonicalCollectionMethod:
        if method == "send_invoice":
            return CanonicalCollectionMethod.send_invoice
        return CanonicalCollectionMethod.charge_automatically

    def _map_payment_method(self, payment_method: Any) -> CanonicalPaymentMethod | None:
        if not isinstance(payment_method, stripe_lib.PaymentMethod):
            return None
        try:
            type = CanonicalPaymentMethodType(payment_method.type)
        except ValueError:
            type = CanonicalPaymentMethodType.other
        return CanonicalPaymentMethod(source_id=payment_method.id, type=type)

    def _id_of(self, value: Any) -> str:
        if isinstance(value, str):
            return value
        return value["id"]

    def _to_datetime(self, timestamp: int | None) -> datetime | None:
        if timestamp is None:
            return None
        return datetime.fromtimestamp(timestamp, tz=UTC)
