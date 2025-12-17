from typing_extensions import TypeIs

from polar.models.product_price import (
    HasPriceCurrency,
    LegacyRecurringProductPriceCustom,
    LegacyRecurringProductPriceFixed,
    LegacyRecurringProductPriceFree,
    ProductPrice,
    ProductPriceCustom,
    ProductPriceFixed,
    ProductPriceFree,
    ProductPriceMeteredUnit,
    ProductPriceSeatUnit,
)

type StaticPrice = (
    ProductPriceFixed
    | LegacyRecurringProductPriceFixed
    | ProductPriceFree
    | LegacyRecurringProductPriceFree
    | ProductPriceCustom
    | LegacyRecurringProductPriceCustom
)

type FixedPrice = ProductPriceFixed | LegacyRecurringProductPriceFixed

type CustomPrice = ProductPriceCustom | LegacyRecurringProductPriceCustom

type FreePrice = ProductPriceFree | LegacyRecurringProductPriceFree

type MeteredPrice = ProductPriceMeteredUnit

type SeatPrice = ProductPriceSeatUnit

type LegacyPrice = (
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


def is_seat_price(price: ProductPrice) -> TypeIs[SeatPrice]:
    return isinstance(price, ProductPriceSeatUnit)


def is_discount_applicable(
    price: ProductPrice,
) -> TypeIs[FixedPrice | CustomPrice | MeteredPrice | SeatPrice]:
    return (
        is_fixed_price(price)
        or is_custom_price(price)
        or is_metered_price(price)
        or is_seat_price(price)
    )
