from typing import TypeAlias

from typing_extensions import TypeIs

from polar.models import (
    LegacyRecurringProductPriceCustom,
    LegacyRecurringProductPriceFixed,
    LegacyRecurringProductPriceFree,
    ProductPrice,
    ProductPriceCustom,
    ProductPriceFixed,
    ProductPriceFree,
    ProductPriceMeteredUnit,
)
from polar.models.product_price import HasPriceCurrency

StaticPrice: TypeAlias = (
    ProductPriceFixed
    | LegacyRecurringProductPriceFixed
    | ProductPriceFree
    | LegacyRecurringProductPriceFree
    | ProductPriceCustom
    | LegacyRecurringProductPriceCustom
)

FixedPrice: TypeAlias = ProductPriceFixed | LegacyRecurringProductPriceFixed

CustomPrice: TypeAlias = ProductPriceCustom | LegacyRecurringProductPriceCustom

FreePrice: TypeAlias = ProductPriceFree | LegacyRecurringProductPriceFree

MeteredPrice: TypeAlias = ProductPriceMeteredUnit

LegacyPrice: TypeAlias = (
    LegacyRecurringProductPriceFixed
    | LegacyRecurringProductPriceFree
    | LegacyRecurringProductPriceCustom
)


def is_legacy_price(price: ProductPrice) -> TypeIs[LegacyPrice]:
    return isinstance(
        price,
        LegacyRecurringProductPriceFixed
        | LegacyRecurringProductPriceFree
        | LegacyRecurringProductPriceCustom,
    )


def is_currency_price(
    price: ProductPrice,
) -> TypeIs[FixedPrice | CustomPrice | MeteredPrice]:
    return isinstance(price, HasPriceCurrency)


def is_fixed_price(price: ProductPrice) -> TypeIs[FixedPrice]:
    return isinstance(price, ProductPriceFixed | LegacyRecurringProductPriceFixed)


def is_custom_price(price: ProductPrice) -> TypeIs[CustomPrice]:
    return isinstance(price, ProductPriceCustom | LegacyRecurringProductPriceCustom)


def is_free_price(price: ProductPrice) -> TypeIs[FreePrice]:
    return isinstance(price, ProductPriceFree | LegacyRecurringProductPriceFree)


def is_static_price(price: ProductPrice) -> TypeIs[StaticPrice]:
    return price.is_static


def is_metered_price(price: ProductPrice) -> TypeIs[MeteredPrice]:
    return price.is_metered
