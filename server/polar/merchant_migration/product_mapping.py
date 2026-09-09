"""Match a staged Stripe product onto an existing Polar product.

Polar recurrence lives on the product, so the grain is one CanonicalProduct
(source product + interval). A mapping is valid only when amount, currency, and
cadence match: otherwise the first Polar renewal would charge a different price.
"""

from collections import Counter
from collections.abc import Sequence
from dataclasses import dataclass
from uuid import UUID

from polar.models import MerchantMigration, Product
from polar.models.product_price import ProductPriceFixed

from .canonical import (
    CanonicalProduct,
    CanonicalSubscription,
    price_key,
    subscription_price_key,
)
from .precheck import Reason
from .schemas import ProductMappingIncompatibility

UNSET = object()

PRODUCT_MAPPINGS_KEY = "product_mappings"

MAPPING_REQUIRED = Reason(
    "product_mapping_required",
    "A Polar product already uses this name, but amount or billing interval "
    "don't match. Map it to an existing product, or choose to create a new one.",
)
MAPPING_INCOMPATIBLE = Reason(
    "product_mapping_incompatible",
    "The chosen Polar product doesn't match this Stripe product's amount, "
    "currency, or billing interval.",
)
MAPPING_NOT_FOUND = Reason(
    "product_mapping_not_found",
    "The chosen Polar product is missing, archived, or belongs to another "
    "organization.",
)


@dataclass(frozen=True)
class MappingDecision:
    """What import should do with one staged product."""

    product: Product | None = None
    skip: Reason | None = None
    create_new: bool = False


def polar_interval(product: Product) -> str | None:
    if product.recurring_interval is None:
        return None
    return product.recurring_interval.value


def polar_interval_count(product: Product) -> int:
    return product.recurring_interval_count or 1


def fixed_prices(product: Product) -> dict[str, ProductPriceFixed]:
    return {
        price.price_currency.lower(): price
        for price in product.prices
        if isinstance(price, ProductPriceFixed)
    }


def incompatibilities(
    canonical: CanonicalProduct, product: Product
) -> list[ProductMappingIncompatibility]:
    if product.is_archived or polar_interval(product) is None:
        return [ProductMappingIncompatibility.not_recurring]
    found: list[ProductMappingIncompatibility] = []
    if (
        polar_interval(product) != canonical.recurring_interval
        or polar_interval_count(product) != canonical.recurring_interval_count
    ):
        found.append(ProductMappingIncompatibility.interval_mismatch)
    polar_by_currency = fixed_prices(product)
    for price in canonical.prices:
        if price.amount is None:
            continue
        currency = price.currency.lower()
        polar_price = polar_by_currency.get(currency)
        if polar_price is None:
            found.append(
                ProductMappingIncompatibility.currency_mismatch
                if polar_by_currency
                else ProductMappingIncompatibility.missing_fixed_price
            )
            continue
        if polar_price.price_amount != price.amount:
            found.append(ProductMappingIncompatibility.amount_mismatch)
    return list(dict.fromkeys(found))


def is_compatible(canonical: CanonicalProduct, product: Product) -> bool:
    return not incompatibilities(canonical, product)


def name_collision(canonical: CanonicalProduct, product: Product) -> bool:
    return product.name.lower() == canonical.name.lower()


def suggest_product(
    canonical: CanonicalProduct, products: Sequence[Product]
) -> Product | None:
    """The unique Polar product that matches cadence, amount, and currency.

    Prefer a case-insensitive name match when several are compatible. Ambiguous
    matches (two Polar products at the same price and interval) return None.
    """
    compatible = [product for product in products if is_compatible(canonical, product)]
    if not compatible:
        return None
    named = [product for product in compatible if name_collision(canonical, product)]
    pool = named or compatible
    if len(pool) != 1:
        return None
    return pool[0]


def has_name_collision(
    canonical: CanonicalProduct, products: Sequence[Product]
) -> bool:
    return any(name_collision(canonical, product) for product in products)


def subscriber_counts(
    products: Sequence[CanonicalProduct],
    subscriptions: Sequence[CanonicalSubscription],
) -> dict[str, int]:
    product_by_price = {
        price_key(price.source_id, price.currency): product.source_id
        for product in products
        for price in product.prices
    }
    counts: Counter[str] = Counter()
    for subscription in subscriptions:
        key = subscription_price_key(subscription)
        source_id = product_by_price.get(key) if key is not None else None
        if source_id is not None:
            counts[source_id] += 1
    return dict(counts)


def read_product_mappings(migration: MerchantMigration) -> dict[str, UUID | None]:
    raw = migration.source_credentials.get(PRODUCT_MAPPINGS_KEY)
    if not isinstance(raw, dict):
        return {}
    mappings: dict[str, UUID | None] = {}
    for source_id, value in raw.items():
        if not isinstance(source_id, str):
            continue
        if value is None:
            mappings[source_id] = None
            continue
        try:
            mappings[source_id] = UUID(str(value))
        except ValueError:
            continue
    return mappings


def serialize_product_mappings(
    mappings: dict[str, UUID | None],
) -> dict[str, str | None]:
    return {
        source_id: str(product_id) if product_id is not None else None
        for source_id, product_id in mappings.items()
    }


def decide_mapping(
    canonical: CanonicalProduct,
    products: Sequence[Product],
    chosen: UUID | None | object = UNSET,
) -> MappingDecision:
    """Resolve one staged product against stored choice, suggestion, and collisions."""
    if chosen is not UNSET:
        if chosen is None:
            return MappingDecision(create_new=True)
        product = next((item for item in products if item.id == chosen), None)
        if product is None:
            return MappingDecision(skip=MAPPING_NOT_FOUND)
        if not is_compatible(canonical, product):
            return MappingDecision(skip=MAPPING_INCOMPATIBLE)
        return MappingDecision(product=product)

    suggested = suggest_product(canonical, products)
    if suggested is not None:
        return MappingDecision(product=suggested)
    if has_name_collision(canonical, products):
        return MappingDecision(skip=MAPPING_REQUIRED)
    return MappingDecision(create_new=True)
