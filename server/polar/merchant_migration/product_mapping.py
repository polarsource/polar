"""Match a staged Stripe product onto an existing Polar product.

Grain is one CanonicalProduct (source product + interval). Interval and currency
must match; amount need not. Imported subscribers keep the Stripe amount when
Polar's catalog has moved on.
"""

from collections import Counter
from collections.abc import Sequence
from dataclasses import dataclass
from uuid import UUID

from polar.models import MerchantMigration, Product
from polar.models.product_price import ProductPriceFixed
from polar.product.guard import is_recurring_product

from .canonical import CanonicalProduct, CanonicalSubscription, subscription_price_key
from .precheck import Reason, product_by_price_key
from .schemas import ProductMappingIncompatibility

UNSET = object()

PRODUCT_MAPPINGS_KEY = "product_mappings"

MAPPING_REQUIRED = Reason(
    "product_mapping_required",
    "A Polar product already uses this name, but the billing interval "
    "doesn't match. Map it to an existing product, or choose to create a new one.",
)
MAPPING_INCOMPATIBLE = Reason(
    "product_mapping_incompatible",
    "The chosen Polar product doesn't match this Stripe product's currency "
    "or billing interval.",
)
MAPPING_NOT_FOUND = Reason(
    "product_mapping_not_found",
    "The chosen Polar product is missing, archived, or belongs to another "
    "organization.",
)

_BLOCKING = frozenset(
    {
        ProductMappingIncompatibility.not_recurring,
        ProductMappingIncompatibility.interval_mismatch,
        ProductMappingIncompatibility.currency_mismatch,
        ProductMappingIncompatibility.missing_fixed_price,
    }
)


@dataclass(frozen=True)
class MappingDecision:
    product: Product | None = None
    skip: Reason | None = None
    create_new: bool = False


def incompatibilities(
    canonical: CanonicalProduct, product: Product
) -> list[ProductMappingIncompatibility]:
    if product.is_archived:
        return [ProductMappingIncompatibility.not_recurring]
    if not is_recurring_product(product):
        return [ProductMappingIncompatibility.not_recurring]
    found: list[ProductMappingIncompatibility] = []
    if (
        product.recurring_interval.value != canonical.recurring_interval
        or (product.recurring_interval_count or 1) != canonical.recurring_interval_count
    ):
        found.append(ProductMappingIncompatibility.interval_mismatch)
    polar_by_currency = {
        price.price_currency.lower(): price
        for price in product.prices
        if isinstance(price, ProductPriceFixed)
    }
    for price in canonical.prices:
        if price.amount is None:
            continue
        polar_price = polar_by_currency.get(price.currency.lower())
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
    return not _BLOCKING.intersection(incompatibilities(canonical, product))


def _catalog_amounts_match(canonical: CanonicalProduct, product: Product) -> bool:
    codes = incompatibilities(canonical, product)
    return (
        ProductMappingIncompatibility.amount_mismatch not in codes
        and ProductMappingIncompatibility.currency_mismatch not in codes
    )


def suggest_product(
    canonical: CanonicalProduct, products: Sequence[Product]
) -> Product | None:
    compatible = [product for product in products if is_compatible(canonical, product)]
    named = [
        product
        for product in compatible
        if product.name.lower() == canonical.name.lower()
    ]
    if len(named) == 1:
        return named[0]
    if len(named) > 1:
        return None
    amount_matches = [
        product for product in compatible if _catalog_amounts_match(canonical, product)
    ]
    if len(amount_matches) == 1:
        return amount_matches[0]
    return None


def has_name_collision(
    canonical: CanonicalProduct, products: Sequence[Product]
) -> bool:
    return any(
        product.name.lower() == canonical.name.lower() for product in products
    )


def subscriber_counts(
    products: Sequence[CanonicalProduct],
    subscriptions: Sequence[CanonicalSubscription],
) -> dict[str, int]:
    product_by_price = product_by_price_key(products)
    counts: Counter[str] = Counter()
    for subscription in subscriptions:
        key = subscription_price_key(subscription)
        product = product_by_price.get(key) if key is not None else None
        if product is not None:
            counts[product.source_id] += 1
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
