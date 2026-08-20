import typing
from typing import TypeIs

from polar.enums import SubscriptionRecurringInterval
from polar.models.product import Product
from polar.models.product_price import (
    LegacyRecurringProductPriceCustom,
    LegacyRecurringProductPriceFixed,
    ProductPrice,
    ProductPriceCustom,
    ProductPriceFixed,
    ProductPriceMeteredUnit,
    ProductPriceSeatUnit,
    ProductPriceUnit,
)

type StaticPrice = (
    ProductPriceFixed
    | LegacyRecurringProductPriceFixed
    | ProductPriceCustom
    | LegacyRecurringProductPriceCustom
    | ProductPriceSeatUnit
    | ProductPriceUnit
)

type FixedPrice = ProductPriceFixed | LegacyRecurringProductPriceFixed

type CustomPrice = ProductPriceCustom | LegacyRecurringProductPriceCustom

type MeteredPrice = ProductPriceMeteredUnit

type SeatPrice = ProductPriceSeatUnit

type UnitPrice = ProductPriceUnit

type LegacyPrice = LegacyRecurringProductPriceFixed | LegacyRecurringProductPriceCustom


def is_legacy_price(price: ProductPrice) -> TypeIs[LegacyPrice]:
    return isinstance(
        price,
        LegacyRecurringProductPriceFixed | LegacyRecurringProductPriceCustom,
    )


def is_fixed_price(price: ProductPrice) -> TypeIs[FixedPrice]:
    return isinstance(price, ProductPriceFixed | LegacyRecurringProductPriceFixed)


def is_custom_price(price: ProductPrice) -> TypeIs[CustomPrice]:
    return isinstance(price, ProductPriceCustom | LegacyRecurringProductPriceCustom)


def is_static_price(price: ProductPrice) -> TypeIs[StaticPrice]:
    return price.is_static


def is_metered_price(price: ProductPrice) -> TypeIs[MeteredPrice]:
    return price.is_metered


def is_seat_price(price: ProductPrice) -> TypeIs[SeatPrice]:
    return isinstance(price, ProductPriceSeatUnit)


def is_unit_price(price: ProductPrice) -> TypeIs[UnitPrice]:
    return isinstance(price, ProductPriceUnit)


def is_discount_applicable(
    price: ProductPrice,
) -> TypeIs[FixedPrice | CustomPrice | MeteredPrice | SeatPrice | UnitPrice]:
    if price.is_free:
        return False
    return (
        is_fixed_price(price)
        or is_custom_price(price)
        or is_metered_price(price)
        or is_seat_price(price)
        or is_unit_price(price)
    )


if typing.TYPE_CHECKING:

    class RecurringProduct(Product):
        recurring_interval: SubscriptionRecurringInterval  # pyright: ignore
        recurring_interval_count: int  # pyright: ignore
else:
    RecurringProduct = Product


def is_recurring_product(product: Product) -> TypeIs[RecurringProduct]:
    return product.recurring_interval is not None
