from typing import Annotated

from pydantic import UUID4, BaseModel, Field
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


class CheckoutProductPriceUpdateMixin(BaseModel):
    product_price_id: UUID4 | None = Field(
        default=None,
        description=(
            "ID of the product price to checkout. "
            "Must correspond to a price present in the checkout's product list."
        ),
        deprecated=(
            "Use `product_id` unless you have a product with legacy pricing "
            "including several recurring intervals."
        ),
    )


class CheckoutUpdate(CheckoutProductPriceUpdateMixin, schemas.CheckoutUpdate):
    """Update an existing checkout session using an access token."""


class CheckoutUpdatePublic(
    CheckoutProductPriceUpdateMixin, schemas.CheckoutUpdatePublic
):
    """Update an existing checkout session using the client secret."""


class CheckoutConfirmStripe(
    CheckoutProductPriceUpdateMixin, schemas.CheckoutConfirmStripe
):
    """Confirm a checkout session using a Stripe confirmation token."""


CheckoutConfirm = CheckoutConfirmStripe
