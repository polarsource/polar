"""Reads a merchant's Lemon Squeezy store through its JSON:API with the
merchant's own API key and normalizes it into CanonicalRecords.

Lemon Squeezy sells one variant per checkout and bills subscriptions on a
single item, so a variant maps to one Polar product and its price history to
that product's prices. Cards live in Lemon Squeezy's own vault and never show
up here beyond brand and last four: moving them is a PAN import.
"""

import asyncio
import hashlib
import uuid
from collections.abc import AsyncIterator
from datetime import datetime
from decimal import Decimal
from enum import StrEnum
from typing import Any, Literal

import httpx2

from polar.benefit.strategies.base.schemas import BENEFIT_DESCRIPTION_MAX_LENGTH
from polar.enums import RecurringInterval, TaxBehavior
from polar.kit.schemas import Schema

from ..canonical import (
    CanonicalAccount,
    CanonicalBenefit,
    CanonicalBenefitFile,
    CanonicalBenefitLink,
    CanonicalBenefitType,
    CanonicalCollectionMethod,
    CanonicalCustomer,
    CanonicalDiscount,
    CanonicalDiscountDuration,
    CanonicalDiscountType,
    CanonicalLicenseKey,
    CanonicalLicenseKeyActivation,
    CanonicalLicenseKeySettings,
    CanonicalPaymentMethod,
    CanonicalPaymentMethodType,
    CanonicalPrice,
    CanonicalPricingScheme,
    CanonicalProduct,
    CanonicalPurchase,
    CanonicalRecord,
    CanonicalSubscription,
    CanonicalSubscriptionStatus,
    parse_datetime,
    polar_discount_code,
)
from ..errors import MerchantMigrationError
from .base import ExtractionPage

API_BASE_URL = "https://api.lemonsqueezy.com/v1"
PAGE_SIZE = 100
# The API allows 300 calls a minute; a large store's full read goes over it.
RATE_LIMIT_RETRY_DELAYS = (2, 5, 15, 30, 60)

# `expired` is over; `cancelled` still runs until `ends_at` and is taken over
# as a pending cancellation.
SKIPPED_SUBSCRIPTION_STATUSES = frozenset({"expired"})

LICENSE_LENGTH_UNITS: dict[str, Literal["day", "month", "year"]] = {
    "days": "day",
    "months": "month",
    "years": "year",
}


class LemonSqueezyStoreRequired(MerchantMigrationError):
    def __init__(self, store_ids: list[str]) -> None:
        super().__init__(
            "This Lemon Squeezy API key can read several stores "
            f"({', '.join(store_ids)}). Pick the one to migrate.",
            400,
        )


class LemonSqueezyStoreNotFound(MerchantMigrationError):
    def __init__(self, store_id: str) -> None:
        super().__init__(
            f"This Lemon Squeezy API key can't read store {store_id}.", 400
        )


class LemonSqueezyExtractionPhase(StrEnum):
    variants = "variants"
    discounts = "discounts"
    customers = "customers"
    subscriptions = "subscriptions"


_PHASES = list(LemonSqueezyExtractionPhase)


class LemonSqueezyExtractionCursor(Schema):
    phase: LemonSqueezyExtractionPhase = LemonSqueezyExtractionPhase.variants
    page: int = 1


class LemonSqueezyAdapter:
    def __init__(
        self,
        api_key: str,
        store_id: str | None = None,
        *,
        client: httpx2.AsyncClient | None = None,
    ) -> None:
        self.store_id = store_id
        self._client = client or httpx2.AsyncClient(
            base_url=API_BASE_URL,
            headers={
                "Authorization": f"Bearer {api_key}",
                "Accept": "application/vnd.api+json",
                "Content-Type": "application/vnd.api+json",
            },
            timeout=30.0,
        )
        self._store: dict[str, Any] | None = None
        self._prices_by_variant: dict[str, list[dict[str, Any]]] = {}
        self._prices_by_id: dict[str, dict[str, Any]] = {}
        self._redemptions_by_order: dict[str, list[dict[str, Any]]] | None = None
        self._redemption_counts: dict[str, int] = {}
        self._order_tax_behaviors: dict[str, TaxBehavior] | None = None
        self._license_keys: dict[str, CanonicalLicenseKey | None] | None = None

    async def _request(
        self, method: str, path: str, params: dict[str, Any] | None = None
    ) -> httpx2.Response:
        for delay in RATE_LIMIT_RETRY_DELAYS:
            response = await self._client.request(method, path, params=params)
            if response.status_code != 429:
                return response
            retry_after = response.headers.get("Retry-After")
            await asyncio.sleep(float(retry_after) if retry_after else delay)
        return await self._client.request(method, path, params=params)

    async def _list(
        self, path: str, page: int, params: dict[str, Any] | None = None
    ) -> tuple[list[dict[str, Any]], bool, list[dict[str, Any]]]:
        response = await self._request(
            "GET",
            path,
            {**(params or {}), "page[number]": page, "page[size]": PAGE_SIZE},
        )
        response.raise_for_status()
        body = response.json()
        pagination = body.get("meta", {}).get("page", {})
        has_more = pagination.get("currentPage", page) < pagination.get("lastPage", 1)
        return body["data"], has_more, body.get("included", [])

    async def resolve_store(self) -> dict[str, Any]:
        if self._store is not None:
            return self._store
        stores, _, _ = await self._list("/stores", 1)
        if self.store_id is None:
            if len(stores) != 1:
                raise LemonSqueezyStoreRequired([store["id"] for store in stores])
            self.store_id = stores[0]["id"]
        store = next((store for store in stores if store["id"] == self.store_id), None)
        if store is None:
            raise LemonSqueezyStoreNotFound(self.store_id)
        self._store = store
        return store

    @property
    def _store_filter(self) -> dict[str, Any]:
        return {"filter[store_id]": self.store_id}

    async def _currency(self) -> str:
        store = await self.resolve_store()
        return store["attributes"]["currency"].lower()

    async def get_source_account(self) -> CanonicalAccount:
        store = await self.resolve_store()
        return CanonicalAccount(
            country=store["attributes"].get("country"),
            has_connected_accounts=False,
        )

    async def extract(self) -> AsyncIterator[CanonicalRecord]:
        cursor: dict[str, Any] | None = None
        while True:
            page = await self.extract_page(cursor)
            for record in page.records:
                yield record
            cursor = page.next_cursor
            if cursor is None:
                return

    async def extract_page(
        self, cursor: dict[str, Any] | None = None
    ) -> ExtractionPage:
        await self.resolve_store()
        extraction_cursor = LemonSqueezyExtractionCursor.model_validate(cursor or {})
        match extraction_cursor.phase:
            case LemonSqueezyExtractionPhase.variants:
                records, has_more = await self._extract_variants(extraction_cursor)
            case LemonSqueezyExtractionPhase.discounts:
                records, has_more = await self._extract_discounts(extraction_cursor)
            case LemonSqueezyExtractionPhase.customers:
                records, has_more = await self._extract_customers(extraction_cursor)
            case LemonSqueezyExtractionPhase.subscriptions:
                records, has_more = await self._extract_subscriptions(extraction_cursor)
        return ExtractionPage(
            records=records, next_cursor=self._next_cursor(extraction_cursor, has_more)
        )

    def _next_cursor(
        self, cursor: LemonSqueezyExtractionCursor, has_more: bool
    ) -> dict[str, Any] | None:
        if has_more:
            return LemonSqueezyExtractionCursor(
                phase=cursor.phase, page=cursor.page + 1
            ).model_dump(mode="json")
        index = _PHASES.index(cursor.phase)
        if index + 1 == len(_PHASES):
            return None
        return LemonSqueezyExtractionCursor(phase=_PHASES[index + 1]).model_dump(
            mode="json"
        )

    async def _extract_variants(
        self, cursor: LemonSqueezyExtractionCursor
    ) -> tuple[list[CanonicalRecord], bool]:
        await self._load_all_prices()
        variants, has_more, included = await self._list(
            "/variants", cursor.page, {"include": "product"}
        )
        products = {item["id"]: item for item in included if item["type"] == "products"}
        currency = await self._currency()
        records: list[CanonicalRecord] = []
        for variant in variants:
            product = products.get(str(variant["attributes"]["product_id"]))
            if product is None or str(product["attributes"]["store_id"]) != str(
                self.store_id
            ):
                continue
            record = self._map_variant(variant, product, currency)
            if record is not None:
                records.append(record)
        return records, has_more

    async def _load_all_prices(self) -> None:
        """Every price, grouped per variant: a variant's history is its Polar
        product's prices, and a subscription's price dates its period. Read in
        full, never per page, so a resumed extraction can't see half of them.
        `/prices` has no store filter; other stores' prices go unused."""
        if self._prices_by_id:
            return
        page = 1
        while True:
            prices, has_more, _ = await self._list("/prices", page)
            for price in prices:
                variant_id = str(price["attributes"]["variant_id"])
                self._prices_by_variant.setdefault(variant_id, []).append(price)
                self._prices_by_id[price["id"]] = price
            if not has_more:
                return
            page += 1

    def _map_variant(
        self, variant: dict[str, Any], product: dict[str, Any], currency: str
    ) -> CanonicalProduct | None:
        attributes = variant["attributes"]
        prices = sorted(
            self._prices_by_variant.get(variant["id"], []),
            key=lambda price: price["attributes"]["created_at"],
        )
        if not prices:
            return None
        latest = prices[-1]
        latest_attributes = latest["attributes"]
        recurring = _renews(latest)
        recurring_interval = (
            latest_attributes.get("renewal_interval_unit") if recurring else None
        )
        product_name = product["attributes"]["name"]
        # A product sold without variants has one, `pending`: the default.
        is_default_variant = attributes.get("status") == "pending"
        name = (
            product_name
            if is_default_variant or attributes["name"] == product_name
            else f"{product_name} - {attributes['name']}"
        )
        return CanonicalProduct(
            source_id=variant["id"],
            product_source_id=variant["id"],
            name=name,
            recurring_interval=recurring_interval,
            recurring_interval_count=(
                latest_attributes.get("renewal_interval_quantity")
                if recurring
                else None
            )
            or 1,
            prices=[
                self._map_price(price, currency, is_default=price is latest)
                for price in prices
            ],
            archived="draft"
            in (attributes.get("status"), product["attributes"].get("status")),
        )

    def _map_price(
        self, price: dict[str, Any], currency: str, *, is_default: bool
    ) -> CanonicalPrice:
        attributes = price["attributes"]
        return CanonicalPrice(
            source_id=price["id"],
            currency=currency,
            amount=self._price_amount(attributes),
            pricing_scheme=self._map_pricing_scheme(attributes),
            is_default=is_default,
            created_at=parse_datetime(attributes.get("created_at")),
            active=is_default,
        )

    def _price_amount(self, attributes: dict[str, Any]) -> int | None:
        """Cents, or None when one amount can't describe the price: tiered
        prices charge per tier and pay-what-you-want has no fixed amount."""
        if attributes.get("category") == "pwyw" or attributes.get("scheme") in (
            "graduated",
            "volume",
        ):
            return None
        if attributes.get("usage_aggregation") is not None:
            # Usage prices carry a decimal string of cents and may be sub-cent.
            decimal = attributes.get("unit_price_decimal")
            if decimal is None:
                return None
            cents = Decimal(decimal)
            return int(cents) if cents == cents.to_integral_value() else None
        unit_price = attributes.get("unit_price")
        return int(unit_price) if unit_price is not None else None

    def _map_pricing_scheme(self, attributes: dict[str, Any]) -> CanonicalPricingScheme:
        if attributes.get("usage_aggregation") is not None:
            return CanonicalPricingScheme.metered
        match attributes.get("scheme"):
            case "graduated" | "volume":
                return CanonicalPricingScheme.tiered
            case "package":
                return CanonicalPricingScheme.package
            case _:
                return CanonicalPricingScheme.fixed

    async def _extract_discounts(
        self, cursor: LemonSqueezyExtractionCursor
    ) -> tuple[list[CanonicalRecord], bool]:
        discounts, has_more, _ = await self._list(
            "/discounts",
            cursor.page,
            {**self._store_filter, "include": "variants"},
        )
        await self._load_redemptions()
        currency = await self._currency()
        records: list[CanonicalRecord] = []
        for discount in discounts:
            variant_ids = await self._discount_variant_ids(discount)
            record = self._map_discount(discount, variant_ids, currency)
            if record is not None:
                records.append(record)
        return records, has_more

    async def _discount_variant_ids(self, discount: dict[str, Any]) -> list[str] | None:
        """The variants a product-limited discount applies to, or None when
        they can't be read: the discount is then left out, never widened to
        the whole store."""
        if not discount["attributes"].get("is_limited_to_products"):
            return []
        relationship = discount.get("relationships", {}).get("variants", {})
        included = relationship.get("data")
        if included:
            return [item["id"] for item in included]
        variant_ids: list[str] = []
        page = 1
        while True:
            variants, has_more, _ = await self._list(
                f"/discounts/{discount['id']}/variants", page
            )
            variant_ids.extend(variant["id"] for variant in variants)
            if not has_more:
                break
            page += 1
        return variant_ids or None

    def _map_discount(
        self,
        discount: dict[str, Any],
        variant_ids: list[str] | None,
        currency: str,
    ) -> CanonicalDiscount | None:
        attributes = discount["attributes"]
        if attributes.get("status") != "published" or variant_ids is None:
            return None
        percent = attributes["amount_type"] == "percent"
        return CanonicalDiscount(
            source_id=discount["id"],
            name=attributes["name"],
            discount_type=CanonicalDiscountType.percentage
            if percent
            else CanonicalDiscountType.fixed,
            duration=CanonicalDiscountDuration(attributes["duration"]),
            duration_in_months=attributes.get("duration_in_months"),
            basis_points=int(attributes["amount"]) * 100 if percent else None,
            amounts={} if percent else {currency: int(attributes["amount"])},
            code=polar_discount_code(attributes.get("code")),
            ends_at=parse_datetime(attributes.get("expires_at")),
            max_redemptions=max(
                attributes["max_redemptions"]
                - self._redemption_counts.get(discount["id"], 0),
                0,
            )
            if attributes.get("is_limited_redemptions")
            else None,
            product_source_ids=variant_ids,
        )

    async def _extract_customers(
        self, cursor: LemonSqueezyExtractionCursor
    ) -> tuple[list[CanonicalRecord], bool]:
        customers, has_more, _ = await self._list(
            "/customers", cursor.page, self._store_filter
        )
        return [self._map_customer(customer) for customer in customers], has_more

    def _map_customer(self, customer: dict[str, Any]) -> CanonicalCustomer:
        attributes = customer["attributes"]
        # No street address and no tax ID: Lemon Squeezy keeps those on the
        # order's checkout data, which the API doesn't return.
        return CanonicalCustomer(
            source_id=customer["id"],
            email=attributes["email"],
            name=attributes.get("name") or None,
            country=attributes.get("country") or None,
            stripe_customer_id=attributes.get("stripe_customer_id") or None,
        )

    async def _extract_subscriptions(
        self, cursor: LemonSqueezyExtractionCursor
    ) -> tuple[list[CanonicalRecord], bool]:
        subscriptions, has_more, included = await self._list(
            "/subscriptions",
            cursor.page,
            {**self._store_filter, "include": "customer"},
        )
        customer_countries = _customer_countries(included)
        await self._load_all_prices()
        discounts_by_order = await self._load_redemptions()
        tax_behaviors = await self._load_order_tax_behaviors()
        currency = await self._currency()
        records: list[CanonicalRecord] = [
            self._map_subscription(
                subscription,
                discounts_by_order,
                tax_behaviors,
                currency,
                customer_countries,
            )
            for subscription in subscriptions
            if subscription["attributes"]["status"] not in SKIPPED_SUBSCRIPTION_STATUSES
        ]
        return records, has_more

    async def _load_order_tax_behaviors(self) -> dict[str, TaxBehavior]:
        """Whether each order's price included tax. Prices don't say; the order
        a subscription started from does, and its renewals follow it."""
        if self._order_tax_behaviors is not None:
            return self._order_tax_behaviors
        behaviors: dict[str, TaxBehavior] = {}
        page = 1
        while True:
            orders, has_more, _ = await self._list("/orders", page, self._store_filter)
            for order in orders:
                tax_inclusive = order["attributes"].get("tax_inclusive")
                if tax_inclusive is not None:
                    behaviors[order["id"]] = (
                        TaxBehavior.inclusive
                        if tax_inclusive
                        else TaxBehavior.exclusive
                    )
            if not has_more:
                break
            page += 1
        self._order_tax_behaviors = behaviors
        return behaviors

    async def _load_redemptions(self) -> dict[str, list[dict[str, Any]]]:
        """Redemptions, per order and counted per discount. A subscription keeps
        the discount its first order redeemed, which only the redemption says,
        and a discount's cap moves over minus what's already been redeemed."""
        if self._redemptions_by_order is not None:
            return self._redemptions_by_order
        by_order: dict[str, list[dict[str, Any]]] = {}
        page = 1
        while True:
            redemptions, has_more, _ = await self._list("/discount-redemptions", page)
            for redemption in redemptions:
                attributes = redemption["attributes"]
                by_order.setdefault(str(attributes["order_id"]), []).append(redemption)
                discount_id = str(attributes["discount_id"])
                self._redemption_counts[discount_id] = (
                    self._redemption_counts.get(discount_id, 0) + 1
                )
            if not has_more:
                break
            page += 1
        self._redemptions_by_order = by_order
        return by_order

    async def _load_license_keys(self) -> dict[str, CanonicalLicenseKey | None]:
        """Keys per order item, with their activations: a one-time purchase's
        key belongs to its only item. None marks an item whose key was disabled
        or has expired."""
        if self._license_keys is not None:
            return self._license_keys
        usable: dict[str, dict[str, Any]] = {}
        keys: dict[str, CanonicalLicenseKey | None] = {}
        page = 1
        while True:
            license_keys, has_more, _ = await self._list(
                "/license-keys", page, self._store_filter
            )
            for license_key in license_keys:
                order_item_id = str(license_key["attributes"]["order_item_id"])
                if _usable_key(license_key):
                    usable.setdefault(order_item_id, license_key)
                else:
                    keys.setdefault(order_item_id, None)
            if not has_more:
                break
            page += 1
        activations = (
            await self._load_activations()
            if any(_activated(license_key) for license_key in usable.values())
            else {}
        )
        for order_item_id, license_key in usable.items():
            keys[order_item_id] = CanonicalLicenseKey(
                key=str(license_key["attributes"]["key"]),
                activations=activations.get(str(license_key["id"]), []),
                expires_at=parse_datetime(license_key["attributes"].get("expires_at")),
            )
        self._license_keys = keys
        return keys

    async def _load_activations(
        self, license_key_id: str | None = None
    ) -> dict[str, list[CanonicalLicenseKeyActivation]]:
        """Activations per license key id, of one key or of every key the API
        key can read: `/license-key-instances` has no store filter."""
        params = {"filter[license_key_id]": license_key_id} if license_key_id else None
        activations: dict[str, list[CanonicalLicenseKeyActivation]] = {}
        page = 1
        while True:
            instances, has_more, _ = await self._list(
                "/license-key-instances", page, params
            )
            for instance in instances:
                attributes = instance["attributes"]
                if not _is_uuid4(attributes.get("identifier")):
                    continue
                activations.setdefault(str(attributes["license_key_id"]), []).append(
                    CanonicalLicenseKeyActivation(
                        id=attributes["identifier"],
                        label=attributes.get("name") or "Lemon Squeezy",
                    )
                )
            if not has_more:
                return activations
            page += 1

    async def list_benefits(self) -> list[CanonicalBenefit]:
        """License key settings, files and links per variant, grouped so
        variants that give the same thing share one benefit. Keys are never
        shared across products: a key validates against its benefit, so it
        would unlock every product in the group. Every source id carries the
        store, so a second store's benefits never pass for this one's."""
        await self.resolve_store()
        variants: list[tuple[dict[str, Any], str]] = []
        page = 1
        while True:
            batch, has_more, included = await self._list(
                "/variants", page, {"include": "product"}
            )
            products = {
                item["id"]: item for item in included if item["type"] == "products"
            }
            for variant in batch:
                product = products.get(str(variant["attributes"]["product_id"]))
                if product is not None and str(
                    product["attributes"]["store_id"]
                ) == str(self.store_id):
                    variants.append((variant, product["attributes"]["name"]))
            if not has_more:
                break
            page += 1

        files_by_variant = await self._load_files({v["id"] for v, _ in variants})
        await self._load_all_prices()
        groups: dict[str, CanonicalBenefit] = {}

        def add(
            variant_id: str,
            type: CanonicalBenefitType,
            key: str,
            description: str,
            **payload: Any,
        ) -> None:
            source_id = f"{self.store_id}:{type}:{key}"
            benefit = groups.setdefault(
                source_id,
                CanonicalBenefit(
                    source_id=source_id,
                    type=type,
                    description=description,
                    product_source_ids=[],
                    **payload,
                ),
            )
            benefit.product_source_ids.append(variant_id)
            if self._prices_by_variant.get(
                variant_id
            ) and not self._is_subscription_variant(variant_id):
                benefit.for_one_time = True

        for variant, product_name in variants:
            attributes = variant["attributes"]
            if attributes.get("has_license_keys"):
                settings = _license_key_settings(attributes)
                add(
                    variant["id"],
                    "license_keys",
                    f"{attributes['product_id']}:"
                    f"{settings.activation_limit or 'unlimited'}:"
                    f"{settings.expires_ttl or 'never'}:"
                    f"{settings.expires_timeframe or 'never'}",
                    _description(product_name, "license key"),
                    license_keys=settings,
                )
            if files := files_by_variant.get(variant["id"]):
                add(
                    variant["id"],
                    "downloadables",
                    _digest(",".join(sorted(file.source_id for file in files))),
                    _description(product_name, "files"),
                    files=files,
                )
            links = [
                CanonicalBenefitLink(
                    title=link.get("title") or link["url"], url=link["url"]
                )
                for link in attributes.get("links") or []
                if link.get("url")
            ]
            if links:
                add(
                    variant["id"],
                    "custom",
                    _digest(",".join(f"{link.title}|{link.url}" for link in links)),
                    _description(product_name, "links"),
                    links=links,
                )
        return sorted(groups.values(), key=lambda benefit: _TYPE_ORDER[benefit.type])

    async def _load_files(
        self, variant_ids: set[str]
    ) -> dict[str, list[CanonicalBenefitFile]]:
        """Published files of this store's variants. `/files` has no store
        filter; other stores' files are left out by their variant."""
        files: dict[str, list[CanonicalBenefitFile]] = {}
        page = 1
        while True:
            batch, has_more, _ = await self._list("/files", page)
            for file in batch:
                attributes = file["attributes"]
                variant_id = str(attributes["variant_id"])
                if (
                    variant_id not in variant_ids
                    or attributes.get("status") != "published"
                ):
                    continue
                files.setdefault(variant_id, []).append(
                    CanonicalBenefitFile(
                        source_id=file["id"],
                        name=attributes["name"],
                        size=int(attributes.get("size") or 0),
                    )
                )
            if not has_more:
                return files
            page += 1

    async def file_download_url(self, file_source_id: str) -> str:
        """A fresh signed link: Lemon Squeezy's expire after an hour."""
        response = await self._request("GET", f"/files/{file_source_id}")
        response.raise_for_status()
        return response.json()["data"]["attributes"]["download_url"]

    async def list_purchases(self, page: int) -> tuple[list[CanonicalPurchase], bool]:
        """One page of paid one-time orders, a partly refunded one included.
        An order that started a subscription moves with the subscription."""
        orders, has_more, _ = await self._list("/orders", page, self._store_filter)
        license_keys = await self._load_license_keys()
        await self._load_all_prices()
        purchases: list[CanonicalPurchase] = []
        for order in orders:
            attributes = order["attributes"]
            item = attributes.get("first_order_item") or {}
            if attributes.get("status") not in ("paid", "partial_refund"):
                continue
            if not item or not attributes.get("user_email"):
                continue
            if self._is_subscription_order(item):
                continue
            purchases.append(
                CanonicalPurchase(
                    source_id=order["id"],
                    product_source_id=str(item["variant_id"]),
                    email=attributes["user_email"],
                    name=attributes.get("user_name"),
                    license_key=license_keys.get(str(item["id"])),
                    license_key_disabled=str(item["id"]) in license_keys
                    and license_keys[str(item["id"])] is None,
                )
            )
        return purchases, has_more

    def _is_subscription_order(self, item: dict[str, Any]) -> bool:
        """Whether the order started a subscription, from the price it was paid
        at: the variant may have switched to a subscription since."""
        price = self._prices_by_id.get(str(item.get("price_id")))
        if price is not None:
            return _renews(price)
        return self._is_subscription_variant(str(item["variant_id"]))

    def _is_subscription_variant(self, variant_id: str) -> bool:
        prices = self._prices_by_variant.get(variant_id, [])
        return bool(prices) and _renews(
            max(prices, key=lambda price: price["attributes"]["created_at"])
        )

    async def get_subscription(self, source_id: str) -> CanonicalSubscription | None:
        body = await self._retrieve_subscription(source_id)
        if (
            body is None
            or body["data"]["attributes"]["status"] in SKIPPED_SUBSCRIPTION_STATUSES
        ):
            return None
        await self._load_all_prices()
        return self._map_subscription(
            body["data"],
            await self._load_redemptions(),
            await self._load_order_tax_behaviors(),
            await self._currency(),
            _customer_countries(body.get("included", [])),
        )

    async def get_license_key(
        self, subscription: CanonicalSubscription
    ) -> CanonicalLicenseKey | None:
        """The usable key of the order item that started the subscription, with
        its activations, read on its own so the cutover never pages every key
        of the store."""
        if subscription.order_item_source_id is None:
            return None
        license_keys, _, _ = await self._list(
            "/license-keys",
            1,
            {
                **self._store_filter,
                "filter[order_item_id]": subscription.order_item_source_id,
            },
        )
        license_key = next(
            (license_key for license_key in license_keys if _usable_key(license_key)),
            None,
        )
        if license_key is None:
            return None
        activations = (
            await self._load_activations(str(license_key["id"]))
            if _activated(license_key)
            else {}
        )
        return CanonicalLicenseKey(
            key=str(license_key["attributes"]["key"]),
            activations=activations.get(str(license_key["id"]), []),
            expires_at=parse_datetime(license_key["attributes"].get("expires_at")),
        )

    async def stop_source_subscription(
        self,
        source_id: str,
        *,
        reference: str,
        cancel_at_period_end: bool = False,
    ) -> None:
        """Cancel on Lemon Squeezy. It never charges again but stays
        `cancelled` until `ends_at`, the period the customer already paid for.

        Lemon Squeezy has nowhere to record ``reference``: a cancelled
        subscription reads the same whether we or the customer stopped it.
        """
        body = await self._retrieve_subscription(source_id)
        if body is None or body["data"]["attributes"]["status"] in (
            "cancelled",
            "expired",
        ):
            return
        response = await self._request("DELETE", f"/subscriptions/{source_id}")
        if response.status_code == 404:
            return
        response.raise_for_status()

    async def _retrieve_subscription(self, source_id: str) -> dict[str, Any] | None:
        response = await self._request(
            "GET", f"/subscriptions/{source_id}", {"include": "customer"}
        )
        if response.status_code == 404:
            return None
        response.raise_for_status()
        return response.json()

    def _map_subscription(
        self,
        subscription: dict[str, Any],
        discounts_by_order: dict[str, list[dict[str, Any]]],
        tax_behaviors: dict[str, TaxBehavior],
        currency: str,
        customer_countries: dict[str, str],
    ) -> CanonicalSubscription:
        attributes = subscription["attributes"]
        status = attributes["status"]
        item = attributes.get("first_subscription_item") or {}
        cancelled = bool(attributes.get("cancelled"))
        price_id = self._price_id(item, attributes["variant_id"])
        current_period_end = parse_datetime(
            attributes.get("ends_at")
            if cancelled
            else (status == "on_trial" and attributes.get("trial_ends_at"))
            or attributes.get("renews_at")
        )
        redemptions = discounts_by_order.get(str(attributes["order_id"]), [])
        discount_ids = [
            str(redemption["attributes"]["discount_id"]) for redemption in redemptions
        ]
        discount_started_at = (
            parse_datetime(redemptions[0]["attributes"]["created_at"])
            if redemptions
            else None
        )
        return CanonicalSubscription(
            source_id=subscription["id"],
            customer_source_id=str(attributes["customer_id"]),
            price_source_id=price_id,
            status=self._map_status(status),
            collection_method=CanonicalCollectionMethod.charge_automatically,
            # A trial runs from the subscription's start to its trial end,
            # not one billing interval back.
            current_period_start=parse_datetime(attributes.get("created_at"))
            if status == "on_trial"
            else self._period_start(
                current_period_end, price_id, attributes.get("billing_anchor")
            ),
            current_period_end=current_period_end,
            trialing=status == "on_trial",
            paused_collection=attributes.get("pause") is not None,
            line_item_count=1,
            quantity=int(item.get("quantity") or 1),
            payment_method=self._map_payment_method(
                subscription, customer_countries.get(str(attributes["customer_id"]))
            ),
            has_discount=bool(discount_ids),
            discount_source_ids=discount_ids,
            discount_started_at=discount_started_at,
            discount_starts={
                discount_id: discount_started_at for discount_id in discount_ids
            }
            if discount_started_at
            else {},
            cancel_at_period_end=cancelled,
            trial_end=parse_datetime(attributes.get("trial_ends_at")),
            latest_invoice_unpaid=status in ("past_due", "unpaid"),
            anchor_day=attributes.get("billing_anchor"),
            currency=currency,
            # Lemon Squeezy is the merchant of record and always computes tax.
            automatic_tax=True,
            price_tax_behavior=tax_behaviors.get(str(attributes["order_id"])),
            order_item_source_id=str(attributes["order_item_id"])
            if attributes.get("order_item_id") is not None
            else None,
        )

    def _price_id(self, item: dict[str, Any], variant_id: Any) -> str:
        """Some trials have no subscription item yet; they'll renew on the
        variant's current price."""
        if item.get("price_id") is not None:
            return str(item["price_id"])
        prices = self._prices_by_variant.get(str(variant_id), [])
        if not prices:
            return ""
        latest = max(prices, key=lambda price: price["attributes"]["created_at"])
        return latest["id"]

    def _period_start(
        self, period_end: datetime | None, price_id: str, anchor_day: int | None
    ) -> datetime | None:
        """Lemon Squeezy only dates the next renewal: the start is one
        interval back."""
        price = self._prices_by_id.get(price_id)
        if period_end is None or price is None:
            return None
        attributes = price["attributes"]
        try:
            interval = RecurringInterval(attributes.get("renewal_interval_unit"))
        except ValueError:
            return None
        return interval.get_next_period(
            period_end,
            anchor_day or period_end.day,
            -(attributes.get("renewal_interval_quantity") or 1),
        )

    def _map_status(self, status: str) -> CanonicalSubscriptionStatus:
        match status:
            case "active" | "cancelled":
                return CanonicalSubscriptionStatus.active
            case "on_trial":
                return CanonicalSubscriptionStatus.trialing
            case "past_due":
                return CanonicalSubscriptionStatus.past_due
            case "unpaid":
                return CanonicalSubscriptionStatus.unpaid
            case "paused":
                return CanonicalSubscriptionStatus.paused
            case _:
                return CanonicalSubscriptionStatus.other

    def _map_payment_method(
        self, subscription: dict[str, Any], customer_country: str | None
    ) -> CanonicalPaymentMethod | None:
        attributes = subscription["attributes"]
        processor = attributes.get("payment_processor")
        # Both card fields are empty strings for non-card payments.
        brand = attributes.get("card_brand") or None
        if processor is None and brand is None:
            return None
        # No payment method id: the subscription is the only handle on its
        # card, and the PAN export has to key cards the same way.
        if processor == "paypal":
            type = CanonicalPaymentMethodType.paypal
        elif processor == "stripe" and brand is not None:
            type = CanonicalPaymentMethodType.card
        else:
            type = CanonicalPaymentMethodType.other
        return CanonicalPaymentMethod(
            source_id=f"lsq_sub_{subscription['id']}",
            type=type,
            last4=attributes.get("card_last_four") or None,
            brand=brand,
            # No issuer country in the API: the customer's is what's left to
            # tell an India-issued card by.
            billing_country=customer_country,
        )


def _customer_countries(included: list[dict[str, Any]]) -> dict[str, str]:
    return {
        item["id"]: item["attributes"]["country"]
        for item in included
        if item["type"] == "customers" and item["attributes"].get("country")
    }


def _license_key_settings(attributes: dict[str, Any]) -> CanonicalLicenseKeySettings:
    unlimited_activations = attributes.get("is_license_limit_unlimited") or not (
        attributes.get("license_activation_limit")
    )
    timeframe = LICENSE_LENGTH_UNITS.get(attributes.get("license_length_unit") or "")
    never_expires = (
        attributes.get("is_license_length_unlimited")
        or not attributes.get("license_length_value")
        or timeframe is None
    )
    return CanonicalLicenseKeySettings(
        activation_limit=None
        if unlimited_activations
        else int(attributes["license_activation_limit"]),
        expires_ttl=None if never_expires else int(attributes["license_length_value"]),
        expires_timeframe=None if never_expires else timeframe,
    )


_TYPE_ORDER: dict[CanonicalBenefitType, int] = {
    "license_keys": 0,
    "downloadables": 1,
    "custom": 2,
}


def _renews(price: dict[str, Any]) -> bool:
    # One-time prices carry a renewal interval too; only the category says
    # whether the price renews.
    return price["attributes"].get("category") == "subscription"


def _activated(license_key: dict[str, Any]) -> bool:
    return bool(license_key["attributes"].get("instances_count"))


def _is_uuid4(value: object) -> bool:
    try:
        return uuid.UUID(str(value)).version == 4
    except ValueError:
        return False


def _usable_key(license_key: dict[str, Any]) -> bool:
    # An expired key isn't revived: Polar would restart its term from today.
    attributes = license_key["attributes"]
    return (
        bool((attributes.get("key") or "").strip())
        and not attributes.get("disabled")
        and attributes.get("status") not in ("disabled", "expired")
    )


def _digest(value: str) -> str:
    return hashlib.sha256(value.encode()).hexdigest()[:16]


def _description(product_name: str, suffix: str) -> str:
    # "Icon Links" stays as it is, not "Icon Links links". "Profile" doesn't.
    name, stem = product_name.lower().rstrip("s"), suffix.rstrip("s")
    if name == stem or name.endswith(f" {stem}"):
        return product_name[:BENEFIT_DESCRIPTION_MAX_LENGTH].strip()
    room = BENEFIT_DESCRIPTION_MAX_LENGTH - len(suffix) - 1
    return f"{product_name[:room].strip()} {suffix}"
