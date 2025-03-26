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


def is_legacy_price(
    price: ProductPrice,
) -> TypeIs[
    LegacyRecurringProductPriceFixed
    | LegacyRecurringProductPriceFree
    | LegacyRecurringProductPriceCustom
]:
    return isinstance(
        price,
        LegacyRecurringProductPriceFixed
        | LegacyRecurringProductPriceFree
        | LegacyRecurringProductPriceCustom,
    )


def is_custom_price(
    price: ProductPrice,
) -> TypeIs[ProductPriceCustom | LegacyRecurringProductPriceCustom]:
    return isinstance(price, ProductPriceCustom | LegacyRecurringProductPriceCustom)


def is_free_price(
    price: ProductPrice,
) -> TypeIs[ProductPriceFree | LegacyRecurringProductPriceFree]:
    return isinstance(price, ProductPriceFree | LegacyRecurringProductPriceFree)


def is_static_price(
    price: ProductPrice,
) -> TypeIs[
    ProductPriceFixed
    | LegacyRecurringProductPriceFixed
    | ProductPriceFree
    | LegacyRecurringProductPriceFree
    | ProductPriceCustom
    | LegacyRecurringProductPriceCustom
]:
    return price.is_static


def is_metered_price(price: ProductPrice) -> TypeIs[ProductPriceMeteredUnit]:
    return price.is_metered
