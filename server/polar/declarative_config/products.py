from typing import Any
from uuid import UUID

from polar.custom_field.schemas import AttachedCustomFieldCreate
from polar.exceptions import PolarRequestValidationError
from polar.exceptions import ValidationError as RequestValidationError
from polar.models import Product, ProductPrice
from polar.product.schemas import (
    ExistingProductPrice,
    ProductCreateOneTime,
    ProductCreateRecurring,
    ProductPriceCreate,
    ProductPriceCustomCreate,
    ProductPriceFixedCreate,
    ProductPriceMeteredTiersCreate,
    ProductPriceMeteredUnitCreate,
    ProductPriceSeatBasedCreate,
    ProductPriceUnitBasedCreate,
    ProductPriceUpdate,
    ProductUpdate,
)

from .schemas import (
    ConfigProduct,
    ConfigProductPrice,
    ConfigProductPriceCustom,
    ConfigProductPriceFixed,
    ConfigProductPriceMeteredTiers,
    ConfigProductPriceMeteredUnit,
    ConfigProductPriceSeatBased,
    ConfigProductPriceUnitBased,
)
from .validation import PriceKey, ProductChange, price_config, price_key

_PRICE_INPUT_FIELDS = {
    "amount_type",
    "price_currency",
    "tax_behavior",
    "price_amount",
    "unit_amount",
    "cap_amount",
}


def product_error(
    error: PolarRequestValidationError,
    index: int,
    external_ids: dict[str, str],
) -> PolarRequestValidationError:
    errors: list[RequestValidationError] = []
    for detail in error.errors():
        path = list(detail["loc"][1:])
        if path and path[-1] == "meter_id":
            path[-1] = "meter"
        errors.append(
            RequestValidationError(
                type=detail["type"],
                loc=("body", "products", index, *path),
                msg=detail["msg"],
                input=detail["input"]
                if path and path[-1] in _PRICE_INPUT_FIELDS
                else external_ids.get(str(detail["input"])),
            )
        )
    return PolarRequestValidationError(errors)


def price_create(
    price: ConfigProductPrice,
    meter_ids: dict[str, UUID],
) -> ProductPriceCreate:
    match price:
        case ConfigProductPriceMeteredUnit():
            return ProductPriceMeteredUnitCreate(
                **price.model_dump(exclude={"meter"}),
                meter_id=meter_ids[price.meter],
            )
        case ConfigProductPriceMeteredTiers():
            return ProductPriceMeteredTiersCreate(
                **price.model_dump(exclude={"meter"}),
                meter_id=meter_ids[price.meter],
            )
        case ConfigProductPriceCustom():
            return ProductPriceCustomCreate(**price.model_dump())
        case ConfigProductPriceSeatBased():
            return ProductPriceSeatBasedCreate(**price.model_dump())
        case ConfigProductPriceUnitBased():
            return ProductPriceUnitBasedCreate(**price.model_dump())
        case ConfigProductPriceFixed():
            return ProductPriceFixedCreate(**price.model_dump())


def _attached_custom_fields(
    config: ConfigProduct, custom_field_ids: dict[str, UUID]
) -> list[AttachedCustomFieldCreate]:
    return [
        AttachedCustomFieldCreate(
            custom_field_id=custom_field_ids[custom_field.slug],
            required=custom_field.required,
        )
        for custom_field in config.custom_fields
    ]


def product_create(
    config: ConfigProduct,
    organization_id: UUID | None,
    meter_ids: dict[str, UUID],
    custom_field_ids: dict[str, UUID],
) -> ProductCreateRecurring | ProductCreateOneTime:
    fields = {
        **config.model_dump(include={"name", "description", "visibility", "metadata"}),
        "attached_custom_fields": _attached_custom_fields(config, custom_field_ids),
    }
    prices: list[ProductPriceCreate] = [
        price_create(price, meter_ids) for price in config.prices
    ]
    if config.recurring_interval is None:
        return ProductCreateOneTime(
            **fields, prices=prices, organization_id=organization_id
        )
    return ProductCreateRecurring(
        **fields,
        **config.model_dump(
            include={
                "trial_interval",
                "trial_interval_count",
                "meter_interval",
                "meter_interval_count",
            }
        ),
        recurring_interval=config.recurring_interval,
        recurring_interval_count=config.recurring_interval_count or 1,
        prices=prices,
        organization_id=organization_id,
    )


_TRIAL_FIELDS = {"trial_interval", "trial_interval_count"}


def product_update(
    change: ProductChange,
    product: Product,
    meter_ids: dict[str, UUID],
    external_ids: dict[str, str],
    custom_field_ids: dict[str, UUID],
) -> ProductUpdate:
    update: dict[str, Any] = {
        "metadata" if name == "user_metadata" else name: value
        for name, value in change.update_dict.items()
        if name not in {"prices", "benefits", "custom_fields"}
    }
    if "custom_fields" in change.update_dict:
        update["attached_custom_fields"] = _attached_custom_fields(
            change.config, custom_field_ids
        )
    if update.keys() & _TRIAL_FIELDS:
        update.update(change.config.model_dump(include=_TRIAL_FIELDS))
    if "prices" in change.update_dict:
        existing_prices: dict[PriceKey, ProductPrice] = {}
        for price in product.prices:
            existing_config = price_config(price, external_ids)
            if existing_config is not None:
                existing_prices[price_key(existing_config)] = price
        prices: list[ProductPriceUpdate] = []
        for config_price in change.config.prices:
            existing_price = existing_prices.pop(
                price_key(config_price.model_dump()), None
            )
            prices.append(
                ExistingProductPrice(id=existing_price.id)
                if existing_price is not None
                else price_create(config_price, meter_ids)
            )
        update["prices"] = prices
    return ProductUpdate(**update)
