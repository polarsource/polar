from typing import Any
from uuid import UUID

from polar.discount.schemas import (
    DiscountFixedCreate,
    DiscountPercentageCreate,
    DiscountUpdate,
)
from polar.exceptions import PolarRequestValidationError
from polar.exceptions import ValidationError as RequestValidationError

from .schemas import ConfigDiscount, ConfigDiscountFixed
from .validation import DiscountChange


def discount_error(
    error: PolarRequestValidationError,
    index: int,
    external_ids: dict[str, str],
) -> PolarRequestValidationError:
    return PolarRequestValidationError(
        [
            RequestValidationError(
                type=detail["type"],
                loc=("body", "discounts", index, *detail["loc"][1:]),
                msg=detail["msg"],
                input=external_ids.get(str(detail["input"]), detail["input"]),
            )
            for detail in error.errors()
        ]
    )


def discount_create(
    config: ConfigDiscount,
    organization_id: UUID | None,
    product_ids: dict[str, UUID],
) -> DiscountFixedCreate | DiscountPercentageCreate:
    fields = config.model_dump(exclude={"type", "products"})
    products = [product_ids[product] for product in config.products] or None
    if isinstance(config, ConfigDiscountFixed):
        return DiscountFixedCreate(
            **fields, products=products, organization_id=organization_id
        )
    return DiscountPercentageCreate(
        **fields, products=products, organization_id=organization_id
    )


def discount_update(
    change: DiscountChange, product_ids: dict[str, UUID]
) -> DiscountUpdate:
    update: dict[str, Any] = {
        "metadata" if name == "user_metadata" else name: value
        for name, value in change.update_dict.items()
        if name != "products"
    }
    if "products" in change.update_dict:
        update["products"] = [
            product_ids[product] for product in change.config.products
        ]
    return DiscountUpdate(**update)
