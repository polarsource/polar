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


class CheckoutConfirmStripe(schemas.CheckoutConfirmStripe):
    """Confirm a checkout session using a Stripe confirmation token."""

    confirmation_token_id: str | None = Field(
        None,
        description=(
            "ID of the Stripe confirmation token. "
            "Required for fixed prices and custom prices."
        ),
    )
    shared_payment_token_id: SkipJsonSchema[None] = None


CheckoutConfirm = CheckoutConfirmStripe
