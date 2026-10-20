from typing import Annotated

from pydantic import UUID4, Field, field_validator
from pydantic.json_schema import SkipJsonSchema

from polar.kit.schemas import SetSchemaReference
from polar.product.legacy_schemas import ProductPriceCreateList

from . import schemas
from .schemas import (
    CHECKOUT_PRICES_DESCRIPTION,
    CheckoutPriceCreate,
    CheckoutProductCreate,
)


class CheckoutProductsCreate(schemas.CheckoutProductsCreateBase):
    """
    Create a new checkout session from a list of products.
    Customers will be able to switch between those products.

    Metadata set on the checkout will be copied
    to the resulting order and/or subscription.
    """

    products: list[UUID4] = Field(
        description=(
            "List of product IDs available to select at that checkout. "
            "The first one will be selected by default."
        ),
        min_length=1,
    )
    prices: dict[UUID4, ProductPriceCreateList] | None = Field(
        default=None, description=CHECKOUT_PRICES_DESCRIPTION
    )

    @field_validator("products")
    @classmethod
    def products_must_be_unique(cls, v: list[UUID4]) -> list[UUID4]:
        if len(v) != len(set(v)):
            raise ValueError("Product IDs must be unique.")
        return v


CheckoutCreate = Annotated[
    CheckoutProductsCreate
    | SkipJsonSchema[CheckoutProductCreate]
    | SkipJsonSchema[CheckoutPriceCreate],
    SetSchemaReference("CheckoutCreate"),
]
