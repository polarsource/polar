from typing import Annotated

from pydantic import UUID4, Field
from pydantic.json_schema import SkipJsonSchema

from polar.kit.schemas import SetSchemaReference
from polar.product.legacy_schemas import ProductPriceCreateList

from . import schemas
from .schemas import (
    CHECKOUT_PRICES_DESCRIPTION,
    CheckoutPriceCreate,
    CheckoutProductCreate,
)


class CheckoutProductsCreate(schemas.CheckoutProductsCreate):
    """
    Create a new checkout session from a list of products.
    Customers will be able to switch between those products.

    Metadata set on the checkout will be copied
    to the resulting order and/or subscription.
    """

    prices: dict[UUID4, ProductPriceCreateList] | None = Field(  # type: ignore[assignment]
        default=None, description=CHECKOUT_PRICES_DESCRIPTION
    )


CheckoutCreate = Annotated[
    CheckoutProductsCreate
    | SkipJsonSchema[CheckoutProductCreate]
    | SkipJsonSchema[CheckoutPriceCreate],
    SetSchemaReference("CheckoutCreate"),
]
